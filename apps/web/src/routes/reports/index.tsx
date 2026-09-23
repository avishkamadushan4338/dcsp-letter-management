import { DIVISION_CODES, DIVISION_NAMES, type DivisionCode } from "@dcsp-letter-management/domain/division";
import { Button } from "@dcsp-letter-management/ui/components/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@dcsp-letter-management/ui/components/empty";
import { Input } from "@dcsp-letter-management/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@dcsp-letter-management/ui/components/select";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { format, formatDistanceStrict } from "date-fns";
import { useMemo, useState } from "react";

import { AppShell } from "@/components/app-shell";
import Loader from "@/components/loader";
import { formatDate } from "@/lib/format";
import { requireAuth } from "@/lib/require-auth";
import { orpc } from "@/utils/orpc";

export const Route = createFileRoute("/reports/")({
  beforeLoad({ context: { queryClient }, location }) {
    return requireAuth({ queryClient, href: location.href });
  },
  component: MonthlyReportPage,
});

/** Sentinel for "no filter" — shadcn `Select` can't take an empty-string value. */
const ALL = "__all__";

function monthStart(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function monthEnd(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function toInputDate(date: Date) {
  return format(date, "yyyy-MM-dd");
}

/** Elapsed time between two stage timestamps, or "—" while the later stage hasn't happened yet. */
function duration(from: Date | string | number | null, to: Date | string | number | null) {
  if (!from || !to) return "—";
  return formatDistanceStrict(new Date(to), new Date(from));
}

function MonthlyReportPage() {
  const now = new Date();
  const [dateFrom, setDateFrom] = useState(toInputDate(monthStart(now)));
  const [dateTo, setDateTo] = useState(toInputDate(monthEnd(now)));
  const [division, setDivision] = useState<DivisionCode | typeof ALL>(ALL);
  const [officerId, setOfficerId] = useState<string>(ALL);

  const officersQuery = useQuery(orpc.dashboard.monthlyReportOfficers.queryOptions());
  const officers = officersQuery.data ?? [];
  const filteredOfficers = division === ALL ? officers : officers.filter((one) => one.division === division);

  const reportQuery = useQuery(
    orpc.dashboard.monthlyReport.queryOptions({
      input: {
        dateFrom: dateFrom ? new Date(`${dateFrom}T00:00:00`) : undefined,
        dateTo: dateTo ? new Date(`${dateTo}T00:00:00`) : undefined,
        division: division === ALL ? undefined : division,
        officerId: officerId === ALL ? undefined : officerId,
      },
    }),
  );
  const items = reportQuery.data ?? [];

  // One row per (letter, Relevant Officer) so each assignment's own
  // received/action-taken timestamps show on their own line — same
  // flattening pattern as the Letters Summary print page.
  const rows = useMemo(
    () =>
      items.flatMap((item) =>
        item.relevantOfficers.length > 0
          ? item.relevantOfficers.map((assignment) => ({ key: assignment.id, item, assignment: assignment as typeof assignment | null }))
          : [{ key: item.id, item, assignment: null as (typeof item.relevantOfficers)[number] | null }],
      ),
    [items],
  );

  return (
    <AppShell>
      <style>{"@media print { @page { size: A4 landscape; } }"}</style>
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
          <div>
            <h1 className="text-lg font-semibold">Monthly Report</h1>
            <p className="text-sm text-muted-foreground">
              {rows.length} letter{rows.length === 1 ? "" : "s"} — how long each stage took, filterable by division, date, and officer.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} className="w-auto" />
            <span className="text-sm text-muted-foreground">to</span>
            <Input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} className="w-auto" />

            <Select
              value={division}
              onValueChange={(value) => {
                if (!value) return;
                setDivision(value as DivisionCode | typeof ALL);
                setOfficerId(ALL);
              }}
            >
              <SelectTrigger>
                <SelectValue>{division === ALL ? "All divisions" : DIVISION_NAMES[division]}</SelectValue>
              </SelectTrigger>
              <SelectContent alignItemWithTrigger={false}>
                <SelectItem value={ALL}>All divisions</SelectItem>
                {DIVISION_CODES.map((code) => (
                  <SelectItem key={code} value={code}>
                    {DIVISION_NAMES[code]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={officerId} onValueChange={(value) => value && setOfficerId(value)}>
              <SelectTrigger>
                <SelectValue>{officerId === ALL ? "All officers" : filteredOfficers.find((one) => one.id === officerId)?.name}</SelectValue>
              </SelectTrigger>
              <SelectContent alignItemWithTrigger={false}>
                <SelectItem value={ALL}>All officers</SelectItem>
                {filteredOfficers.map((one) => (
                  <SelectItem key={one.id} value={one.id}>
                    {one.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button onClick={() => window.print()} disabled={rows.length === 0}>
              Print
            </Button>
          </div>
        </div>

        {reportQuery.isPending ? (
          <Loader />
        ) : rows.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>No letters in this range</EmptyTitle>
              <EmptyDescription>Adjust the date range, division, or officer filter.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <table className="w-full table-fixed border-collapse text-sm">
            <thead>
              <tr>
                <th className="border border-foreground p-2 text-left">Reference #</th>
                <th className="border border-foreground p-2 text-left">Division</th>
                <th className="border border-foreground p-2 text-left">Subject</th>
                <th className="border border-foreground p-2 text-left">Received</th>
                <th className="border border-foreground p-2 text-left">Relevant Officer</th>
                <th className="border border-foreground p-2 text-left">DCS → Subject</th>
                <th className="border border-foreground p-2 text-left">Subject → Forward</th>
                <th className="border border-foreground p-2 text-left">Assigned → Received</th>
                <th className="border border-foreground p-2 text-left">Received → Actioned</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.key} className="break-inside-avoid">
                  <td className="border border-foreground p-2 break-words">{row.item.referenceNumber}</td>
                  <td className="border border-foreground p-2 break-words">{row.item.division ? DIVISION_NAMES[row.item.division] : "—"}</td>
                  <td className="border border-foreground p-2 break-words">{row.item.subject}</td>
                  <td className="border border-foreground p-2 whitespace-nowrap">{formatDate(row.item.receivedDate)}</td>
                  <td className="border border-foreground p-2 break-words">{row.assignment?.officer.name ?? "—"}</td>
                  <td className="border border-foreground p-2 whitespace-nowrap">{duration(row.item.receivedDate, row.item.subjectReceivedAt)}</td>
                  <td className="border border-foreground p-2 whitespace-nowrap">
                    {duration(row.item.subjectReceivedAt, row.item.subjectForwardedAt)}
                  </td>
                  <td className="border border-foreground p-2 whitespace-nowrap">
                    {row.assignment ? duration(row.item.subjectForwardedAt, row.assignment.receivedAt) : "—"}
                  </td>
                  <td className="border border-foreground p-2 whitespace-nowrap">
                    {row.assignment ? duration(row.assignment.receivedAt, row.assignment.actionTakenAt) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </AppShell>
  );
}
