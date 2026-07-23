import {
  LETTER_STATUS_COLOR,
  LETTER_STATUS_LABELS,
  type LetterStatus,
  type LetterStatusColor,
} from "@dcsp-letter-management/domain/letter-status";
import { Badge } from "@dcsp-letter-management/ui/components/badge";

const COLOR_CLASSES: Record<LetterStatusColor, string> = {
  gray: "border-gray-200 bg-gray-100 text-gray-700 dark:border-gray-700 dark:bg-gray-800/40 dark:text-gray-300",
  amber: "border-amber-200 bg-amber-100 text-amber-800 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  blue: "border-blue-200 bg-blue-100 text-blue-800 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  indigo: "border-indigo-200 bg-indigo-100 text-indigo-800 dark:border-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300",
  violet: "border-violet-200 bg-violet-100 text-violet-800 dark:border-violet-800 dark:bg-violet-900/30 dark:text-violet-300",
  cyan: "border-cyan-200 bg-cyan-100 text-cyan-800 dark:border-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300",
  emerald: "border-emerald-200 bg-emerald-100 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  teal: "border-teal-200 bg-teal-100 text-teal-800 dark:border-teal-800 dark:bg-teal-900/30 dark:text-teal-300",
};

export function LetterStatusBadge({ status }: { status: LetterStatus }) {
  return <Badge className={COLOR_CLASSES[LETTER_STATUS_COLOR[status]]}>{LETTER_STATUS_LABELS[status]}</Badge>;
}
