import { Button } from "@dcsp-letter-management/ui/components/button";
import { Checkbox } from "@dcsp-letter-management/ui/components/checkbox";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@dcsp-letter-management/ui/components/empty";
import { Input } from "@dcsp-letter-management/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@dcsp-letter-management/ui/components/select";
import { cn } from "@dcsp-letter-management/ui/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { format } from "date-fns";
import { useMemo, useState } from "react";

import { AppShell } from "@/components/app-shell";
import Loader from "@/components/loader";
import { formatDate } from "@/lib/format";
import { requireAuth } from "@/lib/require-auth";
import { orpc } from "@/utils/orpc";

export const Route = createFileRoute("/letters-summary/")({
  beforeLoad({ context: { queryClient }, location }) {
    return requireAuth({ queryClient, href: location.href });
  },
  component: LettersSummaryPage,
});

const SORT_OPTIONS = [
  { value: "receivedDate_asc", label: "Received date (oldest first)" },
  { value: "receivedDate_desc", label: "Received date (newest first)" },
] as const;

function LettersSummaryPage() {
  const query = useQuery(orpc.letters.printSummary.queryOptions());
  const items = query.data ?? [];
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [sort, setSort] = useState<(typeof SORT_OPTIONS)[number]["value"]>(SORT_OPTIONS[0].value);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // One row per (letter, Relevant Officer) — each assigned officer needs
  // their own signature line, so a letter assigned to 2 officers gets 2 rows
  // under the same reference number, one per officer.
  const rows = useMemo(() => {
    const sorted = [...items].sort((a, b) => {
      const diff = new Date(a.receivedDate).getTime() - new Date(b.receivedDate).getTime();
      return sort === "receivedDate_asc" ? diff : -diff;
    });

    return sorted.flatMap((item) =>
      item.relevantOfficers.length > 0
        ? item.relevantOfficers.map((assignment) => ({ key: assignment.id, item, officerName: assignment.officer.name }))
        : [{ key: item.id, item, officerName: "—" }],
    );
  }, [items, sort]);

  const selectedCount = rows.filter((row) => !excluded.has(row.key)).length;

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

  // Selects only the letters received within [dateFrom, dateTo] (a single
  // date is just the same value in both) — compared as local calendar days
  // so the picker matches what's printed on the page, not UTC.
  function applyDateFilter() {
    if (!dateFrom && !dateTo) return;
    setExcluded(
      new Set(
        rows
          .filter((row) => {
            const receivedDay = format(new Date(row.item.receivedDate), "yyyy-MM-dd");
            if (dateFrom && receivedDay < dateFrom) return true;
            if (dateTo && receivedDay > dateTo) return true;
            return false;
          })
          .map((row) => row.key),
      ),
    );
  }

  function clearDateFilter() {
    setDateFrom("");
    setDateTo("");
    setExcluded(new Set());
  }

  return (
    <AppShell>
      {/* Scoped to this page's lifetime — landscape only applies while it's mounted. */}
      <style>{"@media print { @page { size: A4 landscape; } }"}</style>
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
          <div>
            <h1 className="text-lg font-semibold">Letters Summary</h1>
            <p className="text-sm text-muted-foreground">
              Select which letters to print — {selectedCount} of {rows.length} selected.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={sort} onValueChange={(value) => setSort(value as (typeof SORT_OPTIONS)[number]["value"])}>
              <SelectTrigger>
                <SelectValue>{SORT_OPTIONS.find((option) => option.value === sort)?.label}</SelectValue>
              </SelectTrigger>
              <SelectContent alignItemWithTrigger={false}>
                {SORT_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} className="w-auto" />
            <span className="text-sm text-muted-foreground">to</span>
            <Input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} className="w-auto" />
            <Button variant="outline" size="sm" onClick={applyDateFilter} disabled={!dateFrom && !dateTo}>
              Select by date
            </Button>
            {(dateFrom || dateTo) && (
              <Button variant="ghost" size="sm" onClick={clearDateFilter}>
                Clear
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => setExcluded(new Set())} disabled={selectedCount === rows.length}>
              Select all
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setExcluded(new Set(rows.map((row) => row.key)))}
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
              <col className="w-[6%] print:hidden" />
              <col className="w-[8%]" />
              <col className="w-[13%]" />
              <col className="w-[40%]" />
              <col className="w-[13%]" />
              <col className="w-[14%]" />
              <col className="w-[12%]" />
            </colgroup>
            <thead>
              <tr>
                <th className="border border-foreground p-2 text-left print:hidden" />
                <th className="border border-foreground p-2 text-left">No</th>
                <th className="border border-foreground p-2 text-left">From</th>
                <th className="border border-foreground p-2 text-left">Subject</th>
                <th className="border border-foreground p-2 text-left">Received Date</th>
                <th className="border border-foreground p-2 text-left">Relevant Officer</th>
                <th className="border border-foreground p-2 text-left">Signature</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const isExcluded = excluded.has(row.key);
                return (
                  <tr key={row.key} className={cn("break-inside-avoid", isExcluded && "print:hidden")}>
                    <td className="border border-foreground p-2 text-center print:hidden">
                      <Checkbox checked={!isExcluded} onCheckedChange={() => toggle(row.key)} />
                    </td>
                    <td className="border border-foreground p-2 break-words">{row.item.referenceNumber}</td>
                    <td className="border border-foreground p-2 break-words">{row.item.fromWhom}</td>
                    <td className="border border-foreground p-2 break-words">{row.item.subject}</td>
                    <td className="border border-foreground p-2 whitespace-nowrap">{formatDate(row.item.receivedDate)}</td>
                    <td className="border border-foreground p-2 break-words">{row.officerName}</td>
                    <td className="h-16 border border-foreground p-2" />
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </AppShell>
  );
}
