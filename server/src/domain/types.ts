// Field names intentionally mirror the MySQL columns (snake_case) exactly as
// the existing Express API returned them, since the frontend depends on this
// exact JSON shape - see data/schema.sql for column definitions.

export type LetterStatus =
  | "issued"
  | "pending_review"
  | "created"
  | "sent_to_subject"
  | "with_subject_officer"
  | "sent_to_relevant"
  | "with_relevant_officer"
  | "action_taken"
  | "closed";

export type CreatedByRole = "dcs" | "subject_officer";

export type LinkOfficerRole = "subject" | "relevant";

export type SessionRole = "dcs" | "subject_officer";

export interface Officer {
  readonly id: number;
  readonly name: string;
  readonly email: string;
  readonly designation: string | null;
  readonly division: string | null;
  readonly active: number;
  readonly created_at: string;
}

// Shape returned by LetterRepo's LIST_SELECT join (models/Letter.js).
export interface Letter {
  readonly id: number;
  readonly letter_number: string;
  readonly division: string;
  readonly subject: string | null;
  readonly sender_name: string | null;
  readonly received_date: string | null;
  readonly subject_officer_id: number | null;
  readonly relevant_officer_id: number | null;
  readonly created_by_role: CreatedByRole;
  readonly status: LetterStatus;
  readonly subject_officer_received_at: string | null;
  readonly sent_to_relevant_at: string | null;
  readonly relevant_officer_received_at: string | null;
  readonly action_taken_at: string | null;
  readonly action_notes: string | null;
  readonly created_at: string;
  readonly updated_at: string;
  readonly subject_officer_name: string | null;
  readonly subject_officer_email: string | null;
  readonly relevant_officer_name: string | null;
  readonly relevant_officer_email: string | null;
}

export interface Reassignment {
  readonly id: number;
  readonly reassigned_at: string;
  readonly note: string | null;
  readonly from_officer_name: string;
  readonly to_officer_name: string;
}

export interface LinkRow {
  readonly id: number;
  readonly token: string;
  readonly letter_id: number;
  readonly officer_role: LinkOfficerRole;
  readonly expires_at: string;
  readonly used_at: string | null;
  readonly created_at: string;
}

export interface NumberSequenceRow {
  readonly division: string;
  readonly current_number: number;
  readonly year: number;
}

export interface SessionPayload {
  readonly username: string;
  readonly role: SessionRole;
  readonly exp: number;
}

export interface LinkTokenPayload {
  readonly letterId: number;
  readonly role: LinkOfficerRole;
  readonly exp: number;
}
