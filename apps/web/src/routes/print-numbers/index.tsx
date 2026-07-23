import { Button } from "@dcsp-letter-management/ui/components/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@dcsp-letter-management/ui/components/empty";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/app-shell";
import Loader from "@/components/loader";
import { formatDate } from "@/lib/format";
import { orpc } from "@/utils/orpc";

export const Route = createFileRoute("/print-numbers/")({
  component: PrintNumbersPage,
});

function PrintNumbersPage() {
  const query = useQuery(orpc.letters.printNumbersToday.queryOptions());
  const items = query.data ?? [];

  // One strip per (letter, Relevant Officer) — each officer needs their own
  // cuttable slip, so a letter assigned to 2 officers prints 2 strips under
  // the same reference number, one per officer.
  const strips = items.flatMap((letter) =>
    letter.relevantOfficers.length > 0
      ? letter.relevantOfficers.map((assignment) => ({
          key: assignment.id,
          referenceNumber: letter.referenceNumber,
          fromWhom: letter.fromWhom,
          receivedDate: letter.receivedDate,
        }))
      : [{ key: letter.id, referenceNumber: letter.referenceNumber, fromWhom: letter.fromWhom, receivedDate: letter.receivedDate }],
  );

  return (
    <AppShell>
      <div className="mx-auto flex max-w-3xl flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
          <h1 className="text-lg font-semibold">Print Numbers — Today</h1>
          <Button onClick={() => window.print()} disabled={strips.length === 0}>
            Print
          </Button>
        </div>

        {query.isPending ? (
          <Loader />
        ) : strips.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>No numbers issued today</EmptyTitle>
              <EmptyDescription>Letter numbers created today will appear here.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          // Cut along each line and attach it to the physical letter.
          <div className="flex flex-col">
            {strips.map((strip) => (
              <div key={strip.key} className="break-inside-avoid border-b py-4 text-base font-bold">
                {strip.referenceNumber} - ({strip.fromWhom}) | {formatDate(strip.receivedDate)}
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
