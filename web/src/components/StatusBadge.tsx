import type { LetterStatus } from "../lib/types.js";

export function StatusBadge({ status }: { status: LetterStatus }) {
  return <span className={`status-badge status-${status}`}>{status}</span>;
}
