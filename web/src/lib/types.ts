// Mirrors server-ts/src/domain/types.ts field-for-field - these are the
// exact JSON shapes the API returns.

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
