import { LETTER_STATUS_LABELS, LETTER_STATUS_TONE, type LetterStatus } from "@dcsp-letter-management/domain/letter-status";
import { Badge } from "@dcsp-letter-management/ui/components/badge";

const TONE_VARIANT = {
  neutral: "secondary",
  warning: "outline",
  success: "default",
} as const;

export function LetterStatusBadge({ status }: { status: LetterStatus }) {
  return <Badge variant={TONE_VARIANT[LETTER_STATUS_TONE[status]]}>{LETTER_STATUS_LABELS[status]}</Badge>;
}
