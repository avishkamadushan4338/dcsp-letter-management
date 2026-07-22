import { DIVISION_CODES } from "@dcsp-letter-management/domain/division";
import { LETTER_STATUSES } from "@dcsp-letter-management/domain/letter-status";
import { relations, sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { user } from "./auth";

const timestamps = {
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .notNull(),
};

/**
 * The Relevant Officer roster (APP_FLOW.md §7). Maintained by the Subject
 * Officer, filtered by division wherever DCS or the Subject Officer pick a
 * Relevant Officer. "Removing" an officer only hides them from future
 * assignment (`active: false`) — existing letters keep showing their name.
 */
export const officer = sqliteTable(
  "officer",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    position: text("position").notNull(),
    division: text("division", { enum: DIVISION_CODES }).notNull(),
    active: integer("active", { mode: "boolean" }).default(true).notNull(),
    ...timestamps,
  },
  (table) => [index("officer_division_idx").on(table.division)],
);

/**
 * Singleton row holding whichever user is currently "the" Subject Officer
 * (APP_FLOW.md §6). Only affects letters created after it changes — each
 * letter snapshots its own `subjectOfficerId` at creation time.
 */
export const appConfig = sqliteTable("app_config", {
  id: text("id").primaryKey().default("singleton"),
  currentSubjectOfficerId: text("current_subject_officer_id").references(() => user.id),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
});

/**
 * Per-division running counter backing the `DCSP/<division>/<00001-99999>`
 * reference number (APP_FLOW.md §3.1). Incremented atomically the moment a
 * division is picked — before the rest of the letter form is even filled
 * in — and wraps back to 1 after 99999.
 */
export const letterSequence = sqliteTable("letter_sequence", {
  division: text("division", { enum: DIVISION_CODES }).primaryKey(),
  lastNumber: integer("last_number").default(0).notNull(),
});

export const letter = sqliteTable(
  "letter",
  {
    id: text("id").primaryKey(),
    referenceNumber: text("reference_number").notNull().unique(),
    division: text("division", { enum: DIVISION_CODES }).notNull(),
    number: integer("number").notNull(),
    subject: text("subject").notNull(),
    fromWhom: text("from_whom").notNull(),
    receivedDate: integer("received_date", { mode: "timestamp_ms" }).notNull(),
    status: text("status", { enum: LETTER_STATUSES }).notNull(),

    // Who originated the letter — DCS (Flow 1) or the Subject Officer
    // themselves (Flow 2) — shown in the UI as "Added By" (APP_FLOW.md §1).
    createdByRole: text("created_by_role", { enum: ["dcs", "subjectOfficer"] }).notNull(),

    // Snapshotted at creation time so a later change to "the" Subject Officer
    // (APP_FLOW.md §6) never affects letters already sent.
    subjectOfficerId: text("subject_officer_id")
      .notNull()
      .references(() => user.id),
    // Null only while `pending_review` (Flow 2, Option B) — DCS assigns this
    // on review.
    relevantOfficerId: text("relevant_officer_id").references(() => officer.id),

    reviewedAt: integer("reviewed_at", { mode: "timestamp_ms" }),
    subjectReceivedAt: integer("subject_received_at", { mode: "timestamp_ms" }),
    subjectForwardedAt: integer("subject_forwarded_at", { mode: "timestamp_ms" }),
    relevantReceivedAt: integer("relevant_received_at", { mode: "timestamp_ms" }),
    actionTakenAt: integer("action_taken_at", { mode: "timestamp_ms" }),
    actionNotes: text("action_notes"),

    ...timestamps,
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    index("letter_status_idx").on(table.status),
    index("letter_division_idx").on(table.division),
    index("letter_relevant_officer_idx").on(table.relevantOfficerId),
  ],
);

/**
 * The "wrong person got this" escape hatch (APP_FLOW.md §5, Relevant
 * Officer's link). One row per reassignment; shown as history to the new
 * officer and to DCS.
 */
export const letterReassignment = sqliteTable(
  "letter_reassignment",
  {
    id: text("id").primaryKey(),
    letterId: text("letter_id")
      .notNull()
      .references(() => letter.id, { onDelete: "cascade" }),
    fromOfficerId: text("from_officer_id")
      .notNull()
      .references(() => officer.id),
    toOfficerId: text("to_officer_id")
      .notNull()
      .references(() => officer.id),
    note: text("note"),
    ...timestamps,
  },
  (table) => [index("letter_reassignment_letter_idx").on(table.letterId)],
);

/**
 * The unique per-letter, per-role link emailed to each officer
 * (APP_FLOW.md §1, §5). Reassigning a Relevant Officer invalidates their
 * link and mints a new one for the new officer.
 */
export const letterLink = sqliteTable(
  "letter_link",
  {
    id: text("id").primaryKey(),
    token: text("token").notNull().unique(),
    letterId: text("letter_id")
      .notNull()
      .references(() => letter.id, { onDelete: "cascade" }),
    role: text("role", { enum: ["subjectOfficer", "relevantOfficer"] }).notNull(),
    // Set when this specific officer's link is spent (they forwarded /
    // recorded an action) or invalidated (reassigned away). A fresh row is
    // minted for whoever takes over, rather than mutating this one.
    invalidatedAt: integer("invalidated_at", { mode: "timestamp_ms" }),
    ...timestamps,
  },
  (table) => [index("letter_link_letter_idx").on(table.letterId)],
);

export const appConfigRelations = relations(appConfig, ({ one }) => ({
  currentSubjectOfficer: one(user, {
    fields: [appConfig.currentSubjectOfficerId],
    references: [user.id],
  }),
}));

export const officerRelations = relations(officer, ({ many }) => ({
  letters: many(letter),
  reassignmentsFrom: many(letterReassignment, { relationName: "reassignmentFrom" }),
  reassignmentsTo: many(letterReassignment, { relationName: "reassignmentTo" }),
}));

export const letterRelations = relations(letter, ({ one, many }) => ({
  subjectOfficer: one(user, {
    fields: [letter.subjectOfficerId],
    references: [user.id],
  }),
  relevantOfficer: one(officer, {
    fields: [letter.relevantOfficerId],
    references: [officer.id],
  }),
  reassignments: many(letterReassignment),
  links: many(letterLink),
}));

export const letterReassignmentRelations = relations(letterReassignment, ({ one }) => ({
  letter: one(letter, {
    fields: [letterReassignment.letterId],
    references: [letter.id],
  }),
  fromOfficer: one(officer, {
    fields: [letterReassignment.fromOfficerId],
    references: [officer.id],
    relationName: "reassignmentFrom",
  }),
  toOfficer: one(officer, {
    fields: [letterReassignment.toOfficerId],
    references: [officer.id],
    relationName: "reassignmentTo",
  }),
}));

export const letterLinkRelations = relations(letterLink, ({ one }) => ({
  letter: one(letter, {
    fields: [letterLink.letterId],
    references: [letter.id],
  }),
}));
