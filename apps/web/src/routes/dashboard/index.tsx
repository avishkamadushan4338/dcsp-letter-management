import { DIVISION_CODES, DIVISION_NAMES, type DivisionCode } from "@dcsp-letter-management/domain/division";
import { LETTER_STATUS_COLOR, LETTER_STATUS_LABELS, type LetterStatus } from "@dcsp-letter-management/domain/letter-status";
import { Card, CardContent, CardHeader, CardTitle } from "@dcsp-letter-management/ui/components/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@dcsp-letter-management/ui/components/empty";
import { cn } from "@dcsp-letter-management/ui/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  ClipboardListIcon,
  InboxIcon,
  Layers3Icon,
  type LucideIcon,
  SendIcon,
} from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { DataTable } from "@/components/data-table";
import { LETTER_STATUS_BAR_CLASSES } from "@/components/letters/status-colors";
import Loader from "@/components/loader";
import { formatDate, formatRelativeToNow } from "@/lib/format";
import { useUserRole } from "@/lib/role";
import { orpc } from "@/utils/orpc";

export const Route = createFileRoute("/dashboard/")({
  component: DashboardPage,
});

type LetterQueueItem = {
  id: string;
  referenceNumber: string;
  subject: string;
  fromWhom: string;
  division?: DivisionCode | null;
  receivedDate: string | Date;
};

type OverdueItem = {
  id: string;
  assignedAt: string | Date;
  officer: { id: string; name: string };
  letter: {
    id: string;
    referenceNumber: string;
    subject: string;
    fromWhom: string;
    division: DivisionCode | null;
  };
};

const letterQueueColumns: ColumnDef<LetterQueueItem>[] = [
  { accessorKey: "referenceNumber", header: "Reference #" },
  { accessorKey: "subject", header: "Subject" },
  { accessorKey: "fromWhom", header: "From Whom" },
  { id: "receivedDate", header: "Received", cell: ({ row }) => formatDate(row.original.receivedDate) },
];

const letterQueueColumnsWithDivision: ColumnDef<LetterQueueItem>[] = [
  { accessorKey: "referenceNumber", header: "Reference #" },
  { accessorKey: "subject", header: "Subject" },
  {
    id: "division",
    header: "Division",
    cell: ({ row }) => (row.original.division ? DIVISION_NAMES[row.original.division] : "—"),
  },
  { id: "receivedDate", header: "Received", cell: ({ row }) => formatDate(row.original.receivedDate) },
];

const overdueColumns: ColumnDef<OverdueItem>[] = [
  { id: "referenceNumber", header: "Reference #", cell: ({ row }) => row.original.letter.referenceNumber },
  { id: "subject", header: "Subject", cell: ({ row }) => row.original.letter.subject },
  {
    id: "division",
    header: "Division",
    cell: ({ row }) => (row.original.letter.division ? DIVISION_NAMES[row.original.letter.division] : "—"),
  },
  { id: "officer", header: "Relevant Officer", cell: ({ row }) => row.original.officer.name },
  { id: "assignedAt", header: "Assigned", cell: ({ row }) => formatRelativeToNow(row.original.assignedAt) },
];

function DashboardPage() {
  const { role, isPending } = useUserRole();

  if (isPending || !role) {
    return (
      <AppShell>
        <Loader />
      </AppShell>
    );
  }

  return role === "dcs" ? <DcsDashboard /> : <SubjectOfficerDashboard />;
}

function DcsDashboard() {
  const navigate = useNavigate();
  const overview = useQuery(orpc.dashboard.overview.queryOptions());
  const reviewQueue = useQuery(
    orpc.letters.list.queryOptions({
      input: { status: "pending_review", sortBy: "receivedDate", sortDir: "asc", pageSize: 8 },
    }),
  );
  const overdue = useQuery(orpc.dashboard.overdueRelevantOfficers.queryOptions());

  const stats = overview.data;

  return (
    <AppShell>
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <h1 className="text-lg font-semibold">Dashboard</h1>

        {overview.isPending ? (
          <Loader />
        ) : (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatTile
                icon={ClipboardListIcon}
                label="Letters to Review Today"
                value={stats?.reviewQueue.total ?? 0}
                detail={`${stats?.reviewQueue.receivedToday ?? 0} received today`}
                to="/letters"
                search={{ status: "pending_review" }}
              />
              <StatTile
                icon={AlertTriangleIcon}
                label="Not Received by Relevant Officer (48h+)"
                value={stats?.overdueRelevantOfficer.letters ?? 0}
                detail={
                  stats && stats.overdueRelevantOfficer.assignments > stats.overdueRelevantOfficer.letters
                    ? `${stats.overdueRelevantOfficer.assignments} assignments waiting`
                    : undefined
                }
                tone="critical"
                onClick={() =>
                  document.getElementById("overdue-relevant-officers")?.scrollIntoView({ behavior: "smooth", block: "start" })
                }
              />
              <StatTile
                icon={Layers3Icon}
                label="In Progress"
                value={stats?.inProgress ?? 0}
                detail="Not yet actioned"
                to="/letters"
                search={{ status: "in_progress" }}
              />
              <StatTile
                icon={CheckCircle2Icon}
                label="Action Taken"
                value={stats?.actionTaken ?? 0}
                detail="Completed"
                tone="success"
                to="/letters"
                search={{ status: "action_taken" }}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Letters by Status</CardTitle>
                </CardHeader>
                <CardContent>
                  <StatusBreakdown data={stats?.statusBreakdown ?? []} />
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>In Progress by Division</CardTitle>
                </CardHeader>
                <CardContent>
                  <DivisionBreakdown data={stats?.divisionBreakdown ?? []} />
                </CardContent>
              </Card>
            </div>
          </>
        )}

        <Card>
          <CardHeader className="flex items-center justify-between">
            <CardTitle>Needs DCS Review</CardTitle>
            <Link to="/letters" search={{ status: "pending_review" }} className="text-sm text-primary hover:underline">
              View all
            </Link>
          </CardHeader>
          <CardContent>
            {reviewQueue.isPending ? (
              <Loader />
            ) : (reviewQueue.data?.items.length ?? 0) === 0 ? (
              <Empty className="p-6">
                <EmptyHeader>
                  <EmptyTitle>Nothing waiting on review</EmptyTitle>
                  <EmptyDescription>Letters sent via DCS for review will appear here.</EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <DataTable
                columns={letterQueueColumns}
                data={reviewQueue.data?.items ?? []}
                onRowClick={(row) => navigate({ to: "/letters/$id", params: { id: row.id } })}
              />
            )}
          </CardContent>
        </Card>

        <Card id="overdue-relevant-officers" className="scroll-mt-4">
          <CardHeader>
            <CardTitle>Overdue Relevant Officer Pickups</CardTitle>
          </CardHeader>
          <CardContent>
            {overdue.isPending ? (
              <Loader />
            ) : (overdue.data?.length ?? 0) === 0 ? (
              <Empty className="p-6">
                <EmptyHeader>
                  <EmptyTitle>Nothing overdue</EmptyTitle>
                  <EmptyDescription>Assignments not received within 48 hours will appear here.</EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <DataTable
                columns={overdueColumns}
                data={overdue.data ?? []}
                onRowClick={(row) => navigate({ to: "/letters/$id", params: { id: row.letter.id } })}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

function SubjectOfficerDashboard() {
  const navigate = useNavigate();
  const overview = useQuery(orpc.dashboard.subjectOfficerOverview.queryOptions());
  const awaitingReceipt = useQuery(
    orpc.letters.list.queryOptions({
      input: { status: "sent_to_subject", sortBy: "receivedDate", sortDir: "asc", pageSize: 8 },
    }),
  );
  const awaitingForward = useQuery(
    orpc.letters.list.queryOptions({
      input: { status: "with_subject_officer", sortBy: "receivedDate", sortDir: "asc", pageSize: 8 },
    }),
  );
  const overdue = useQuery(orpc.dashboard.subjectOfficerOverdueRelevantOfficers.queryOptions());

  const stats = overview.data;

  return (
    <AppShell>
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <h1 className="text-lg font-semibold">Dashboard</h1>

        {overview.isPending ? (
          <Loader />
        ) : (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatTile
                icon={ClipboardListIcon}
                label="Sent to DCS for Review"
                value={stats?.pendingReview.total ?? 0}
                detail="Awaiting DCS to assign an officer"
                to="/letters"
                search={{ status: "pending_review" }}
              />
              <StatTile
                icon={InboxIcon}
                label="Awaiting Your Receipt"
                value={stats?.awaitingReceipt.total ?? 0}
                detail={`${stats?.awaitingReceipt.receivedToday ?? 0} received today`}
                to="/letters"
                search={{ status: "sent_to_subject" }}
              />
              <StatTile
                icon={SendIcon}
                label="To Forward to Relevant Officer"
                value={stats?.awaitingForward.total ?? 0}
                detail="Received — waiting to be sent on"
                to="/letters"
                search={{ status: "with_subject_officer" }}
              />
              <StatTile
                icon={AlertTriangleIcon}
                label="Not Received by Relevant Officer (48h+)"
                value={stats?.overdueRelevantOfficer.letters ?? 0}
                detail={
                  stats && stats.overdueRelevantOfficer.assignments > stats.overdueRelevantOfficer.letters
                    ? `${stats.overdueRelevantOfficer.assignments} assignments waiting`
                    : undefined
                }
                tone="critical"
                onClick={() =>
                  document.getElementById("overdue-relevant-officers")?.scrollIntoView({ behavior: "smooth", block: "start" })
                }
              />
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Your Letters by Status</CardTitle>
              </CardHeader>
              <CardContent>
                <StatusBreakdown data={stats?.statusBreakdown ?? []} />
              </CardContent>
            </Card>
          </>
        )}

        <Card>
          <CardHeader className="flex items-center justify-between">
            <CardTitle>Awaiting Your Receipt</CardTitle>
            <Link to="/letters" search={{ status: "sent_to_subject" }} className="text-sm text-primary hover:underline">
              View all
            </Link>
          </CardHeader>
          <CardContent>
            {awaitingReceipt.isPending ? (
              <Loader />
            ) : (awaitingReceipt.data?.items.length ?? 0) === 0 ? (
              <Empty className="p-6">
                <EmptyHeader>
                  <EmptyTitle>Nothing waiting on you</EmptyTitle>
                  <EmptyDescription>Letters DCS has sent you will appear here until you mark them received.</EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <DataTable
                columns={letterQueueColumns}
                data={awaitingReceipt.data?.items ?? []}
                onRowClick={(row) => navigate({ to: "/letters/$id", params: { id: row.id } })}
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex items-center justify-between">
            <CardTitle>To Forward to Relevant Officer</CardTitle>
            <Link to="/letters" search={{ status: "with_subject_officer" }} className="text-sm text-primary hover:underline">
              View all
            </Link>
          </CardHeader>
          <CardContent>
            {awaitingForward.isPending ? (
              <Loader />
            ) : (awaitingForward.data?.items.length ?? 0) === 0 ? (
              <Empty className="p-6">
                <EmptyHeader>
                  <EmptyTitle>Nothing to forward</EmptyTitle>
                  <EmptyDescription>Letters you've received but haven't sent on will appear here.</EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <DataTable
                columns={letterQueueColumnsWithDivision}
                data={awaitingForward.data?.items ?? []}
                onRowClick={(row) => navigate({ to: "/letters/$id", params: { id: row.id } })}
              />
            )}
          </CardContent>
        </Card>

        <Card id="overdue-relevant-officers" className="scroll-mt-4">
          <CardHeader>
            <CardTitle>Overdue Relevant Officer Pickups</CardTitle>
          </CardHeader>
          <CardContent>
            {overdue.isPending ? (
              <Loader />
            ) : (overdue.data?.length ?? 0) === 0 ? (
              <Empty className="p-6">
                <EmptyHeader>
                  <EmptyTitle>Nothing overdue</EmptyTitle>
                  <EmptyDescription>Assignments not received within 48 hours will appear here.</EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <DataTable
                columns={overdueColumns}
                data={overdue.data ?? []}
                onRowClick={(row) => navigate({ to: "/letters/$id", params: { id: row.letter.id } })}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

function StatTile({
  icon: Icon,
  label,
  value,
  detail,
  tone = "default",
  to,
  search,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  detail?: string;
  tone?: "default" | "critical" | "success";
  to?: string;
  search?: Record<string, string>;
  onClick?: () => void;
}) {
  const flagged = tone === "critical" && value > 0;
  const succeeded = tone === "success";
  const clickable = Boolean(to || onClick);
  const body = (
    <CardContent className="flex items-start justify-between gap-3">
      <div>
        <p className="text-sm text-muted-foreground">{label}</p>
        <p
          className={cn(
            "mt-1 text-3xl font-semibold tabular-nums",
            flagged && "text-destructive",
            succeeded && "text-emerald-600 dark:text-emerald-400",
          )}
        >
          {value}
        </p>
        {detail && <p className="mt-1 text-xs text-muted-foreground">{detail}</p>}
      </div>
      <div
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground",
          flagged && "bg-destructive/10 text-destructive",
          succeeded && "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
        )}
      >
        <Icon className="size-5" />
      </div>
    </CardContent>
  );

  return (
    <Card size="sm" className={cn(clickable && "transition-colors hover:bg-muted/50")}>
      {to ? (
        <Link to={to} search={search} className="block">
          {body}
        </Link>
      ) : onClick ? (
        <button type="button" onClick={onClick} className="block w-full text-left">
          {body}
        </button>
      ) : (
        body
      )}
    </Card>
  );
}

function StatusBreakdown({ data }: { data: { status: LetterStatus; total: number }[] }) {
  const max = Math.max(1, ...data.map((row) => row.total));
  return (
    <div className="flex flex-col gap-2.5">
      {data.map((row) => (
        <div key={row.status} className="flex items-center gap-3">
          <span className="w-40 shrink-0 truncate text-sm text-muted-foreground">{LETTER_STATUS_LABELS[row.status]}</span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
            <div
              className={cn("h-full rounded-full", LETTER_STATUS_BAR_CLASSES[LETTER_STATUS_COLOR[row.status]])}
              style={{ width: `${(row.total / max) * 100}%` }}
            />
          </div>
          <span className="w-8 shrink-0 text-right text-sm font-medium tabular-nums">{row.total}</span>
        </div>
      ))}
    </div>
  );
}

function DivisionBreakdown({ data }: { data: { division: DivisionCode; total: number }[] }) {
  const byCode = new Map(data.map((row) => [row.division, row.total]));
  const rows = DIVISION_CODES.map((code) => ({ code, total: byCode.get(code) ?? 0 }));
  const max = Math.max(1, ...rows.map((row) => row.total));
  return (
    <div className="flex flex-col gap-2.5">
      {rows.map((row) => (
        <div key={row.code} className="flex items-center gap-3">
          <span className="w-40 shrink-0 truncate text-sm text-muted-foreground">{DIVISION_NAMES[row.code]}</span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary" style={{ width: `${(row.total / max) * 100}%` }} />
          </div>
          <span className="w-8 shrink-0 text-right text-sm font-medium tabular-nums">{row.total}</span>
        </div>
      ))}
    </div>
  );
}
