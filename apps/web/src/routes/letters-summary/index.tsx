import { Button } from "@dcsp-letter-management/ui/components/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@dcsp-letter-management/ui/components/empty";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/app-shell";
import Loader from "@/components/loader";
import { formatDate } from "@/lib/format";
import { orpc } from "@/utils/orpc";

export const Route = createFileRoute("/letters-summary/")({
  component: LettersSummaryPage,
});

function LettersSummaryPage() {
  const query = useQuery(orpc.letters.printSummary.queryOptions());
  const items = query.data ?? [];

  // One row per (letter, Relevant Officer) — each assigned officer needs
  // their own signature line, so a letter assigned to 2 officers gets 2 rows
  // under the same reference number, one per officer.
  const rows = items.flatMap((item) =>
    item.relevantOfficers.length > 0
      ? item.relevantOfficers.map((assignment) => ({ key: assignment.id, item, officerName: assignment.officer.name }))
      : [{ key: item.id, item, officerName: "—" }],
  );

  return (
    <AppShell>
      {/* Scoped to this page's lifetime — landscape only applies while it's mounted. */}
      <style>{"@media print { @page { size: A4 landscape; } }"}</style>
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
          <h1 className="text-lg font-semibold">Letters Summary</h1>
          <Button onClick={() => window.print()} disabled={rows.length === 0}>
            Print
          </Button>
        </div>

        {query.isPending ? (
          <Loader />
        ) : rows.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>No letters to summarize</EmptyTitle>
              <EmptyDescription>Letters that have moved past DCS review will appear here.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <table className="w-full table-fixed border-collapse text-sm">
            <colgroup>
              <col className="w-[8%]" />
              <col className="w-[13%]" />
              <col className="w-[40%]" />
              <col className="w-[13%]" />
              <col className="w-[14%]" />
              <col className="w-[12%]" />
            </colgroup>
            <thead>
              <tr>
                <th className="border border-foreground p-2 text-left">No</th>
                <th className="border border-foreground p-2 text-left">From</th>
                <th className="border border-foreground p-2 text-left">Subject</th>
                <th className="border border-foreground p-2 text-left">Received Date</th>
                <th className="border border-foreground p-2 text-left">Relevant Officer</th>
                <th className="border border-foreground p-2 text-left">Signature</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.key} className="break-inside-avoid">
                  <td className="border border-foreground p-2 break-words">{row.item.referenceNumber}</td>
                  <td className="border border-foreground p-2 break-words">{row.item.fromWhom}</td>
                  <td className="border border-foreground p-2 break-words">{row.item.subject}</td>
                  <td className="border border-foreground p-2 whitespace-nowrap">{formatDate(row.item.receivedDate)}</td>
                  <td className="border border-foreground p-2 break-words">{row.officerName}</td>
                  <td className="h-16 border border-foreground p-2" />
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </AppShell>
  );
}
