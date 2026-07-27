import { DIVISION_CODES, DIVISION_NAMES, type DivisionCode } from "@dcsp-letter-management/domain/division";
import {
  LETTER_STATUSES,
  LETTER_STATUS_LABELS,
  letterStatusSchema,
  type LetterStatus,
} from "@dcsp-letter-management/domain/letter-status";
import { Button } from "@dcsp-letter-management/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@dcsp-letter-management/ui/components/dialog";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@dcsp-letter-management/ui/components/empty";
import { Input } from "@dcsp-letter-management/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@dcsp-letter-management/ui/components/select";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { InboxIcon } from "lucide-react";
import { useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import { z } from "zod";

import { AppShell } from "@/components/app-shell";
import { DataTable } from "@/components/data-table";
import { RelevantOfficersField } from "@/components/letters/relevant-officers-field";
import { LetterStatusBadge } from "@/components/letters/status-badge";
import Loader from "@/components/loader";
import { formatDate } from "@/lib/format";
import { useUserRole } from "@/lib/role";
import { orpc } from "@/utils/orpc";

const lettersSearchSchema = z.object({
  // "in_progress" is a meta-status meaning "not yet actioned" (the Dashboard's "In Progress" tile) — not a real letter status.
  status: z.union([letterStatusSchema, z.literal("in_progress")]).optional(),
});

export const Route = createFileRoute("/letters/")({
  validateSearch: lettersSearchSchema,
  component: LettersPage,
});

const ALL = "__all__";

const SORT_OPTIONS = [
  { value: "newest", label: "Newest first", sortBy: "createdAt", sortDir: "desc" },
  { value: "oldest", label: "Oldest first", sortBy: "createdAt", sortDir: "asc" },
  { value: "receivedDate_desc", label: "Received date (newest)", sortBy: "receivedDate", sortDir: "desc" },
  { value: "receivedDate_asc", label: "Received date (oldest)", sortBy: "receivedDate", sortDir: "asc" },
  { value: "referenceNumber_asc", label: "Reference # (A–Z)", sortBy: "referenceNumber", sortDir: "asc" },
  { value: "referenceNumber_desc", label: "Reference # (Z–A)", sortBy: "referenceNumber", sortDir: "desc" },
  { value: "subject_asc", label: "Subject (A–Z)", sortBy: "subject", sortDir: "asc" },
] as const;

type LetterListItem = {
  id: string;
  referenceNumber: string;
  division: DivisionCode | null;
  subject: string;
  fromWhom: string;
  status: LetterStatus;
  createdByRole: "dcs" | "subjectOfficer";
  receivedDate: string | Date;
  relevantOfficers: { officer: { name: string } }[];
  subjectOfficer: { name: string } | null;
};

/**
 * DCS's inline equivalent of the "Review" button on the letter detail page —
 * assign Relevant Officer(s) to a `pending_review` letter right from the
 * list, without opening it first.
 */
function ReviewAction({ letterId }: { letterId: string }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const reviewMutation = useMutation(
    orpc.letters.review.mutationOptions({
      onSuccess: () => {
        toast.success("Letter reviewed and sent out.");
        queryClient.invalidateQueries({ queryKey: orpc.letters.list.key() });
        queryClient.invalidateQueries({ queryKey: orpc.letters.pendingReviewCount.key() });
        setOpen(false);
      },
      onError: (error) => toast.error(error.message),
    }),
  );

  const form = useForm({
    defaultValues: { relevantOfficerIds: [] as string[] },
    onSubmit: async ({ value }) => {
      if (value.relevantOfficerIds.length === 0) return;
      await reviewMutation.mutateAsync({ id: letterId, relevantOfficerIds: value.relevantOfficerIds });
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" onClick={(event) => event.stopPropagation()} />}>Review</DialogTrigger>
      <DialogContent onClick={(event) => event.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>Assign Relevant Officer(s)</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            form.handleSubmit();
          }}
        >
          <form.Field
            name="relevantOfficerIds"
            validators={{ onChange: ({ value }) => (value.length > 0 ? undefined : { message: "Pick at least one officer" }) }}
          >
            {(field) => (
              <RelevantOfficersField value={field.state.value} onChange={field.handleChange} errors={field.state.meta.errors} />
            )}
          </form.Field>
          <DialogFooter className="mt-4">
            <Button type="submit" disabled={reviewMutation.isPending}>
              {reviewMutation.isPending ? "Sending…" : "Assign & Send"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function statusFilterLabel(value: string) {
  if (value === ALL) return "All statuses";
  if (value === "in_progress") return "In Progress (not yet actioned)";
  return LETTER_STATUS_LABELS[value as LetterStatus];
}

const baseColumns: ColumnDef<LetterListItem>[] = [
  { accessorKey: "referenceNumber", header: "Reference #" },
  { accessorKey: "subject", header: "Subject" },
  { accessorKey: "fromWhom", header: "From Whom" },
  {
    id: "division",
    header: "Division",
    cell: ({ row }) => (row.original.division ? DIVISION_NAMES[row.original.division] : "—"),
  },
  {
    id: "relevantOfficer",
    header: "Relevant Officer",
    cell: ({ row }) => row.original.relevantOfficers.map((assignment) => assignment.officer.name).join(", ") || "—",
  },
  {
    id: "receivedDate",
    header: "Received",
    cell: ({ row }) => formatDate(row.original.receivedDate),
  },
];

function LettersPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { role } = useUserRole();
  const { status: initialStatus } = Route.useSearch();
  const [search, setSearch] = useState("");
  const [division, setDivision] = useState<string>(ALL);
  const [status, setStatus] = useState<string>(initialStatus ?? ALL);
  const [sort, setSort] = useState<string>(SORT_OPTIONS[0].value);
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const invalidateList = () => queryClient.invalidateQueries({ queryKey: orpc.letters.list.key() });

  const markReceived = useMutation(
    orpc.letters.subjectMarkReceived.mutationOptions({
      onSuccess: () => {
        toast.success("Marked received.");
        invalidateList();
      },
      onError: (error) => toast.error(error.message),
    }),
  );

  const forward = useMutation(
    orpc.letters.subjectForward.mutationOptions({
      onSuccess: () => {
        toast.success("Sent to the Relevant Officer.");
        invalidateList();
      },
      onError: (error) => toast.error(error.message),
    }),
  );

  const statusColumn = useMemo<ColumnDef<LetterListItem>>(
    () => ({
      id: "status",
      header: "Status",
      cell: ({ row }) => {
        const item = row.original;

        // DCS sees the "Review" action here instead of the status badge for
        // letters waiting on them to assign a Relevant Officer — same idea
        // as the Subject Officer actions below, no need to open the letter first.
        if (role === "dcs" && item.status === "pending_review") {
          return <ReviewAction letterId={item.id} />;
        }

        // Subject Officer sees a one-click action here instead of the status
        // badge for the two statuses that are actually waiting on them —
        // no need to open the letter just to mark it received or forward it.
        if (role === "subjectOfficer" && item.status === "sent_to_subject") {
          const isThisPending = markReceived.isPending && markReceived.variables?.id === item.id;
          return (
            <Button
              size="sm"
              disabled={isThisPending}
              onClick={(event) => {
                event.stopPropagation();
                markReceived.mutate({ id: item.id });
              }}
            >
              {isThisPending ? "Marking…" : "Mark Received"}
            </Button>
          );
        }
        if (role === "subjectOfficer" && item.status === "with_subject_officer") {
          const isThisPending = forward.isPending && forward.variables?.id === item.id;
          return (
            <Button
              size="sm"
              variant="outline"
              disabled={isThisPending}
              onClick={(event) => {
                event.stopPropagation();
                forward.mutate({ id: item.id });
              }}
            >
              {isThisPending ? "Sending…" : "Send to Relevant"}
            </Button>
          );
        }
        return <LetterStatusBadge status={item.status} />;
      },
    }),
    [role, markReceived, forward],
  );

  const columns = useMemo<ColumnDef<LetterListItem>[]>(() => [...baseColumns, statusColumn], [statusColumn]);

  const sortOption = SORT_OPTIONS.find((option) => option.value === sort) ?? SORT_OPTIONS[0];

  const query = useQuery(
    orpc.letters.list.queryOptions({
      input: {
        search: search || undefined,
        division: division === ALL ? undefined : (division as DivisionCode),
        status: status === ALL ? undefined : (status as LetterStatus | "in_progress"),
        sortBy: sortOption.sortBy,
        sortDir: sortOption.sortDir,
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
              <SelectValue>
                {division === ALL ? "All divisions" : DIVISION_NAMES[division as DivisionCode]}
              </SelectValue>
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
          <Select
            value={status}
            onValueChange={(value) => {
              setStatus(value as string);
              setPage(1);
            }}
          >
            <SelectTrigger>
              <SelectValue>{statusFilterLabel(status)}</SelectValue>
            </SelectTrigger>
            <SelectContent alignItemWithTrigger={false}>
              <SelectItem value={ALL}>All statuses</SelectItem>
              <SelectItem value="in_progress">In Progress (not yet actioned)</SelectItem>
              {LETTER_STATUSES.map((value) => (
                <SelectItem key={value} value={value}>
                  {LETTER_STATUS_LABELS[value]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={sort}
            onValueChange={(value) => {
              setSort(value as string);
              setPage(1);
            }}
          >
            <SelectTrigger>
              <SelectValue>{sortOption.label}</SelectValue>
            </SelectTrigger>
            <SelectContent alignItemWithTrigger={false}>
              {SORT_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
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
              rowClassName={(row) =>
                row.status === "action_taken"
                  ? "bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/20 dark:hover:bg-emerald-950/30"
                  : undefined
              }
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
