/**
 * Shown to the Subject Officer whenever a letter has more than one Relevant
 * Officer assigned — DCS's multi-assign otherwise isn't obvious from a single
 * "Send to Relevant Officer" button, and each officer needs their own
 * physical copy of the letter (with their own Print Numbers strip attached).
 */
export function MultiOfficerNotice({ officerNames }: { officerNames: string[] }) {
  if (officerNames.length <= 1) {
    return null;
  }

  return (
    <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
      <p className="font-medium">
        Assigned to {officerNames.length} Relevant Officers: {officerNames.join(", ")}
      </p>
      <p className="mt-1">
        Make a photocopy of this letter for each officer, and attach each one's own printed number (from Print Numbers) to their copy before sending it
        on.
      </p>
    </div>
  );
}
