import type { LetterStatusColor } from "@dcsp-letter-management/domain/letter-status";

/** Solid fills for chart bars — same hue family as `LetterStatusBadge` so a status reads as one color everywhere it appears. */
export const LETTER_STATUS_BAR_CLASSES: Record<LetterStatusColor, string> = {
  gray: "bg-gray-400 dark:bg-gray-500",
  amber: "bg-amber-500 dark:bg-amber-400",
  blue: "bg-blue-500 dark:bg-blue-400",
  indigo: "bg-indigo-500 dark:bg-indigo-400",
  violet: "bg-violet-500 dark:bg-violet-400",
  cyan: "bg-cyan-500 dark:bg-cyan-400",
  emerald: "bg-emerald-500 dark:bg-emerald-400",
  teal: "bg-teal-500 dark:bg-teal-400",
};
