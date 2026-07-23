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

/** Badge color per status — one distinct color each, kept here so it's derived from the same source of truth. */
export const LETTER_STATUS_COLORS = ["gray", "amber", "blue", "indigo", "violet", "cyan", "emerald", "teal"] as const;
export type LetterStatusColor = (typeof LETTER_STATUS_COLORS)[number];

export const LETTER_STATUS_COLOR: Record<LetterStatus, LetterStatusColor> = {
  pending_review: "amber",
  created: "gray",
  sent_to_subject: "blue",
  with_subject_officer: "indigo",
  sent_to_relevant: "violet",
  with_relevant_officer: "cyan",
  action_taken: "emerald",
  closed: "teal",
};
