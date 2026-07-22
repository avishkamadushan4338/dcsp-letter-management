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

  return (
    <AppShell>
      {/* Scoped to this page's lifetime — landscape only applies while it's mounted. */}
      <style>{"@media print { @page { size: A4 landscape; } }"}</style>
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
          <h1 className="text-lg font-semibold">Letters Summary</h1>
          <Button onClick={() => window.print()} disabled={items.length === 0}>
            Print
          </Button>
        </div>

        {query.isPending ? (
          <Loader />
        ) : items.length === 0 ? (
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
              {items.map((item) => (
                <tr key={item.id} className="break-inside-avoid">
                  <td className="border border-foreground p-2 break-words">{item.referenceNumber}</td>
                  <td className="border border-foreground p-2 break-words">{item.fromWhom}</td>
                  <td className="border border-foreground p-2 break-words">{item.subject}</td>
                  <td className="border border-foreground p-2 whitespace-nowrap">{formatDate(item.receivedDate)}</td>
                  <td className="border border-foreground p-2 break-words">{item.relevantOfficer?.name ?? "—"}</td>
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
