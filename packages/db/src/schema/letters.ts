import { DIVISION_CODES } from "@dcsp-letter-management/domain/division";
import { LETTER_STATUSES } from "@dcsp-letter-management/domain/letter-status";
import { relations, sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, unique } from "drizzle-orm/sqlite-core";

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
 * Single global running counter backing the `DCSP/<000001-999999>`
 * reference number (APP_FLOW.md §3.1) — shared across every division, not
 * per-division. Incremented atomically the moment a letter is created, and
 * wraps back to 1 after 999999.
 */
export const letterSequence = sqliteTable("letter_sequence", {
  id: text("id").primaryKey().default("singleton"),
  lastNumber: integer("last_number").default(0).notNull(),
});

export const letter = sqliteTable(
  "letter",
  {
    id: text("id").primaryKey(),
    referenceNumber: text("reference_number").notNull().unique(),
    // Null only while `pending_review` and sent "via DCS" (Flow 2, Option B) —
    // the Subject Officer no longer picks a division for that path; it's
    // derived from whichever Relevant Officer DCS assigns on review.
    division: text("division", { enum: DIVISION_CODES }),
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

    reviewedAt: integer("reviewed_at", { mode: "timestamp_ms" }),
    subjectReceivedAt: integer("subject_received_at", { mode: "timestamp_ms" }),
    subjectForwardedAt: integer("subject_forwarded_at", { mode: "timestamp_ms" }),

    ...timestamps,
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index("letter_status_idx").on(table.status), index("letter_division_idx").on(table.division)],
);

/**
 * One row per Relevant Officer independently assigned to a letter — a letter
 * can go to several officers at once, each acting entirely on their own (own
 * link, own "received"/"action taken", own notes). The letter's overall
 * `status` (APP_FLOW.md §2) is recomputed from these rows: `with_relevant_officer`
 * once any one has received, `action_taken` only once *all* have.
 */
export const letterRelevantOfficer = sqliteTable(
  "letter_relevant_officer",
  {
    id: text("id").primaryKey(),
    letterId: text("letter_id")
      .notNull()
      .references(() => letter.id, { onDelete: "cascade" }),
    officerId: text("officer_id")
      .notNull()
      .references(() => officer.id),
    receivedAt: integer("received_at", { mode: "timestamp_ms" }),
    actionTakenAt: integer("action_taken_at", { mode: "timestamp_ms" }),
    actionNotes: text("action_notes"),
    ...timestamps,
  },
  (table) => [
    index("letter_relevant_officer_letter_idx").on(table.letterId),
    index("letter_relevant_officer_officer_idx").on(table.officerId),
    unique("letter_relevant_officer_letter_officer_unique").on(table.letterId, table.officerId),
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
    // Which officer-track this handoff belongs to — a letter can have several
    // independent Relevant Officer assignments, each with its own history.
    letterRelevantOfficerId: text("letter_relevant_officer_id")
      .notNull()
      .references(() => letterRelevantOfficer.id, { onDelete: "cascade" }),
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
    // Set only for role="relevantOfficer" links — disambiguates which of a
    // letter's (possibly several) independent officer-assignments this
    // specific link belongs to.
    letterRelevantOfficerId: text("letter_relevant_officer_id").references(() => letterRelevantOfficer.id, { onDelete: "cascade" }),
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
  relevantAssignments: many(letterRelevantOfficer),
  reassignmentsFrom: many(letterReassignment, { relationName: "reassignmentFrom" }),
  reassignmentsTo: many(letterReassignment, { relationName: "reassignmentTo" }),
}));

export const letterRelations = relations(letter, ({ one, many }) => ({
  subjectOfficer: one(user, {
    fields: [letter.subjectOfficerId],
    references: [user.id],
  }),
  relevantOfficers: many(letterRelevantOfficer),
  reassignments: many(letterReassignment),
  links: many(letterLink),
}));

export const letterRelevantOfficerRelations = relations(letterRelevantOfficer, ({ one }) => ({
  letter: one(letter, {
    fields: [letterRelevantOfficer.letterId],
    references: [letter.id],
  }),
  officer: one(officer, {
    fields: [letterRelevantOfficer.officerId],
    references: [officer.id],
  }),
}));

export const letterReassignmentRelations = relations(letterReassignment, ({ one }) => ({
  letter: one(letter, {
    fields: [letterReassignment.letterId],
    references: [letter.id],
  }),
  relevantOfficerAssignment: one(letterRelevantOfficer, {
    fields: [letterReassignment.letterRelevantOfficerId],
    references: [letterRelevantOfficer.id],
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
  relevantOfficerAssignment: one(letterRelevantOfficer, {
    fields: [letterLink.letterRelevantOfficerId],
    references: [letterRelevantOfficer.id],
  }),
}));
