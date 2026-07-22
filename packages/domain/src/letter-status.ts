import { z } from "zod";

/** Every possible letter status (APP_FLOW.md §2). Status only ever moves forward. */
export const LETTER_STATUSES = [
  "pending_review",
  "created",
  "sent_to_subject",
  "with_subject_officer",
  "sent_to_relevant",
  "with_relevant_officer",
  "action_taken",
  "closed",
] as const;

export type LetterStatus = (typeof LETTER_STATUSES)[number];

export const letterStatusSchema = z.enum(LETTER_STATUSES);

export const LETTER_STATUS_LABELS: Record<LetterStatus, string> = {
  pending_review: "Pending Review",
  created: "Created",
  sent_to_subject: "Sent to Subject Officer",
  with_subject_officer: "With Subject Officer",
  sent_to_relevant: "Sent to Relevant Officer",
  with_relevant_officer: "With Relevant Officer",
  action_taken: "Action Taken",
  closed: "Closed",
};

/** Badge tone hint for the frontend — kept here so it's derived from the same source of truth. */
export const LETTER_STATUS_TONE: Record<LetterStatus, "neutral" | "warning" | "success"> = {
  pending_review: "warning",
  created: "neutral",
  sent_to_subject: "neutral",
  with_subject_officer: "neutral",
  sent_to_relevant: "neutral",
  with_relevant_officer: "neutral",
  action_taken: "success",
  closed: "success",
};
