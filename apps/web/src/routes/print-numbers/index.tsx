import { Button } from "@dcsp-letter-management/ui/components/button";
import { Checkbox } from "@dcsp-letter-management/ui/components/checkbox";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@dcsp-letter-management/ui/components/empty";
import { cn } from "@dcsp-letter-management/ui/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";

import { AppShell } from "@/components/app-shell";
import Loader from "@/components/loader";
import { formatDate } from "@/lib/format";
import { orpc } from "@/utils/orpc";

export const Route = createFileRoute("/print-numbers/")({
  component: PrintNumbersPage,
});

function PrintNumbersPage() {
  const query = useQuery(orpc.letters.printNumbers.queryOptions());
  const items = query.data ?? [];
  const [excluded, setExcluded] = useState<Set<string>>(new Set());

  // One strip per (letter, Relevant Officer) — each officer needs their own
  // cuttable slip, so a letter assigned to 2 officers prints 2 strips under
  // the same reference number, one per officer.
  const strips = useMemo(
    () =>
      items.flatMap((letter) =>
        letter.relevantOfficers.length > 0
          ? letter.relevantOfficers.map((assignment) => ({
              key: assignment.id,
              referenceNumber: letter.referenceNumber,
              fromWhom: letter.fromWhom,
              receivedDate: letter.receivedDate,
            }))
          : [{ key: letter.id, referenceNumber: letter.referenceNumber, fromWhom: letter.fromWhom, receivedDate: letter.receivedDate }],
      ),
    [items],
  );

  const selectedCount = strips.filter((strip) => !excluded.has(strip.key)).length;

  function toggle(key: string) {
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  return (
    <AppShell>
      <div className="mx-auto flex max-w-3xl flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
          <div>
            <h1 className="text-lg font-semibold">Print Numbers — Last 48 Hours</h1>
            <p className="text-sm text-muted-foreground">
              Select which numbers to print — {selectedCount} of {strips.length} selected.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setExcluded(new Set())} disabled={selectedCount === strips.length}>
              Select all
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setExcluded(new Set(strips.map((strip) => strip.key)))}
              disabled={selectedCount === 0}
            >
              Select none
            </Button>
            <Button onClick={() => window.print()} disabled={selectedCount === 0}>
              Print
            </Button>
          </div>
        </div>

        {query.isPending ? (
          <Loader />
        ) : strips.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>No numbers issued in the last 48 hours</EmptyTitle>
              <EmptyDescription>Letter numbers you've created recently will appear here.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          // Cut along each line and attach it to the physical letter. Only
          // checked rows are included when the browser print dialog opens.
          <div className="flex flex-col">
            {strips.map((strip) => {
              const isExcluded = excluded.has(strip.key);
              return (
                <label
                  key={strip.key}
                  className={cn(
                    "flex items-center gap-3 break-inside-avoid border-b py-4 text-base font-bold",
                    isExcluded && "print:hidden",
                  )}
                >
                  <Checkbox
                    className="print:hidden"
                    checked={!isExcluded}
                    onCheckedChange={() => toggle(strip.key)}
                  />
                  <span>
                    {strip.referenceNumber} - ({strip.fromWhom}) | {formatDate(strip.receivedDate)}
                  </span>
                </label>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
