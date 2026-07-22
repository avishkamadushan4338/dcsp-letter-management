import { DIVISION_NAMES } from "@dcsp-letter-management/domain/division";
import { Button } from "@dcsp-letter-management/ui/components/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@dcsp-letter-management/ui/components/empty";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/app-shell";
import Loader from "@/components/loader";
import { orpc } from "@/utils/orpc";

export const Route = createFileRoute("/print-numbers/")({
  component: PrintNumbersPage,
});

function PrintNumbersPage() {
  const query = useQuery(orpc.letters.printNumbersToday.queryOptions());
  const items = query.data ?? [];

  return (
    <AppShell>
      <div className="mx-auto flex max-w-3xl flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
          <h1 className="text-lg font-semibold">Print Numbers — Today</h1>
          <Button onClick={() => window.print()} disabled={items.length === 0}>
            Print
          </Button>
        </div>

        {query.isPending ? (
          <Loader />
        ) : items.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>No numbers issued today</EmptyTitle>
              <EmptyDescription>Letter numbers created today will appear here.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          // One strip per letter — cut along each line and attach it to the physical letter.
          <div className="flex flex-col">
            {items.map((letter) => (
              <div key={letter.id} className="break-inside-avoid border-b py-4 text-base font-bold">
                {letter.referenceNumber} - {DIVISION_NAMES[letter.division]} - {letter.relevantOfficer?.name ?? "—"}
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
