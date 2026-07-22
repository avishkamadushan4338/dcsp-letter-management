import { DIVISION_CODES, DIVISION_NAMES, type DivisionCode } from "@dcsp-letter-management/domain/division";
import { LETTER_STATUSES, LETTER_STATUS_LABELS, type LetterStatus } from "@dcsp-letter-management/domain/letter-status";
import { Button } from "@dcsp-letter-management/ui/components/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@dcsp-letter-management/ui/components/empty";
import { Input } from "@dcsp-letter-management/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@dcsp-letter-management/ui/components/select";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { InboxIcon } from "lucide-react";
import { useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";

import { AppShell } from "@/components/app-shell";
import { DataTable } from "@/components/data-table";
import { LetterStatusBadge } from "@/components/letters/status-badge";
import Loader from "@/components/loader";
import { formatDate } from "@/lib/format";
import { useUserRole } from "@/lib/role";
import { orpc } from "@/utils/orpc";

export const Route = createFileRoute("/letters/")({
  component: LettersPage,
});

const ALL = "__all__";

type LetterListItem = {
  id: string;
  referenceNumber: string;
  division: DivisionCode;
  subject: string;
  fromWhom: string;
  status: LetterStatus;
  createdByRole: "dcs" | "subjectOfficer";
  receivedDate: string | Date;
  relevantOfficer: { name: string } | null;
  subjectOfficer: { name: string } | null;
};

const columns: ColumnDef<LetterListItem>[] = [
  { accessorKey: "referenceNumber", header: "Reference #" },
  { accessorKey: "subject", header: "Subject" },
  { accessorKey: "fromWhom", header: "From Whom" },
  {
    id: "division",
    header: "Division",
    cell: ({ row }) => DIVISION_NAMES[row.original.division],
  },
  {
    id: "relevantOfficer",
    header: "Relevant Officer",
    cell: ({ row }) => row.original.relevantOfficer?.name ?? "—",
  },
  {
    id: "receivedDate",
    header: "Received",
    cell: ({ row }) => formatDate(row.original.receivedDate),
  },
  {
    id: "status",
    header: "Status",
    cell: ({ row }) => <LetterStatusBadge status={row.original.status} />,
  },
];

function LettersPage() {
  const navigate = useNavigate();
  const { role } = useUserRole();
  const [search, setSearch] = useState("");
  const [division, setDivision] = useState<string>(ALL);
  const [status, setStatus] = useState<string>(ALL);
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const query = useQuery(
    orpc.letters.list.queryOptions({
      input: {
        search: search || undefined,
        division: division === ALL ? undefined : (division as DivisionCode),
        status: status === ALL ? undefined : (status as LetterStatus),
        page,
        pageSize,
      },
    }),
  );

  const items = query.data?.items ?? [];
  const total = query.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <AppShell>
      <div className="mx-auto flex max-w-5xl flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-lg font-semibold">Letters</h1>
          <Button onClick={() => navigate({ to: "/letters/new" })}>New Letter</Button>
        </div>

        <div className="flex flex-wrap gap-2">
          <Input
            placeholder="Search reference, subject, sender…"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            className="max-w-xs"
          />
          <Select
            value={division}
            onValueChange={(value) => {
              setDivision(value as string);
              setPage(1);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Division" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All divisions</SelectItem>
              {DIVISION_CODES.map((code) => (
                <SelectItem key={code} value={code}>
                  {DIVISION_NAMES[code]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={status}
            onValueChange={(value) => {
              setStatus(value as string);
              setPage(1);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All statuses</SelectItem>
              {LETTER_STATUSES.map((value) => (
                <SelectItem key={value} value={value}>
                  {LETTER_STATUS_LABELS[value]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {query.isPending ? (
          <Loader />
        ) : items.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <InboxIcon />
              </EmptyMedia>
              <EmptyTitle>No letters found</EmptyTitle>
              <EmptyDescription>
                {search || division !== ALL || status !== ALL
                  ? "Try adjusting your search or filters."
                  : role === "dcs"
                    ? "Register a new letter to get started."
                    : "Letters sent your way will show up here."}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <>
            <DataTable
              columns={columns}
              data={items}
              onRowClick={(row) => navigate({ to: "/letters/$id", params: { id: row.id } })}
            />
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm text-muted-foreground">
                Page {page} of {totalPages} • {total} letter{total === 1 ? "" : "s"}
              </span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  Previous
                </Button>
                <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                  Next
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
