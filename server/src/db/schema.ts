import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";

export const officers = sqliteTable(
  "officers",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    email: text("email").notNull(),
    designation: text("designation"),
    division: text("division"),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    created_at: text("created_at").notNull().default("CURRENT_TIMESTAMP"),
  },
  (table) => ({
    emailIdx: index("uq_officers_email").on(table.email),
  })
);

export const appSettings = sqliteTable("app_settings", {
  setting_key: text("setting_key").primaryKey(),
  setting_value: text("setting_value"),
});

export const numberSequence = sqliteTable("number_sequence", {
  division: text("division").primaryKey(),
  current_number: integer("current_number").notNull().default(0),
  year: integer("year").notNull(),
  updated_at: text("updated_at").notNull().default("CURRENT_TIMESTAMP"),
});

export const letters = sqliteTable(
  "letters",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    letter_number: text("letter_number").notNull().unique(),
    division: text("division").notNull(),
    subject: text("subject"),
    sender_name: text("sender_name"),
    received_date: text("received_date"),
    subject_officer_id: integer("subject_officer_id"),
    relevant_officer_id: integer("relevant_officer_id"),
    created_by_role: text("created_by_role", { enum: ["dcs", "subject_officer"] }).notNull().default("dcs"),
    status: text("status", {
      enum: [
        "issued",
        "pending_review",
        "created",
        "sent_to_subject",
        "with_subject_officer",
        "sent_to_relevant",
        "with_relevant_officer",
        "action_taken",
        "closed",
      ],
    }).notNull().default("issued"),
    subject_officer_received_at: text("subject_officer_received_at"),
    sent_to_relevant_at: text("sent_to_relevant_at"),
    relevant_officer_received_at: text("relevant_officer_received_at"),
    action_taken_at: text("action_taken_at"),
    action_notes: text("action_notes"),
    created_at: text("created_at").notNull().default("CURRENT_TIMESTAMP"),
    updated_at: text("updated_at").notNull().default("CURRENT_TIMESTAMP"),
  },
  (table) => ({
    divisionIdx: index("idx_letters_division").on(table.division),
    statusIdx: index("idx_letters_status").on(table.status),
  })
);

export const links = sqliteTable(
  "links",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    token: text("token").notNull().unique(),
    letter_id: integer("letter_id").notNull(),
    officer_role: text("officer_role", { enum: ["subject", "relevant"] }).notNull(),
    expires_at: text("expires_at").notNull(),
    used_at: text("used_at"),
    created_at: text("created_at").notNull().default("CURRENT_TIMESTAMP"),
  },
  (table) => ({
    letterIdx: index("idx_links_letter").on(table.letter_id),
  })
);

export const letterReassignments = sqliteTable(
  "letter_reassignments",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    letter_id: integer("letter_id").notNull(),
    from_officer_id: integer("from_officer_id").notNull(),
    to_officer_id: integer("to_officer_id").notNull(),
    note: text("note"),
    reassigned_at: text("reassigned_at").notNull().default("CURRENT_TIMESTAMP"),
  },
  (table) => ({
    letterIdx: index("idx_reassign_letter").on(table.letter_id),
  })
);
