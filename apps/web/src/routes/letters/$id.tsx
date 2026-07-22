import { DIVISION_NAMES } from "@dcsp-letter-management/domain/division";
import { Badge } from "@dcsp-letter-management/ui/components/badge";
import { Button } from "@dcsp-letter-management/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@dcsp-letter-management/ui/components/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@dcsp-letter-management/ui/components/dialog";
import { Field, FieldDescription, FieldError, FieldLabel } from "@dcsp-letter-management/ui/components/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@dcsp-letter-management/ui/components/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@dcsp-letter-management/ui/components/table";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { LetterStatusBadge } from "@/components/letters/status-badge";
import Loader from "@/components/loader";
import { AppShell } from "@/components/app-shell";
import { formatDateTime } from "@/lib/format";
import { useUserRole } from "@/lib/role";
import { orpc } from "@/utils/orpc";

export const Route = createFileRoute("/letters/$id")({
  component: LetterDetailPage,
});

function LetterDetailPage() {
  const { id } = Route.useParams();
  const { role } = useUserRole();
  const query = useQuery(orpc.letters.get.queryOptions({ input: { id } }));

  return (
    <AppShell>
      <div className="mx-auto flex max-w-3xl flex-col gap-4">
        {query.isPending ? (
          <Loader />
        ) : !query.data ? (
          <p className="text-sm text-muted-foreground">Letter not found.</p>
        ) : (
          <LetterDetail letter={query.data} role={role} />
        )}
      </div>
    </AppShell>
  );
}

type LetterDetail = Awaited<ReturnType<typeof orpc.letters.get.call>>;

function LetterDetail({ letter, role }: { letter: LetterDetail; role: string | null }) {
  const timeline: { label: string; at: Date | string | null; extra?: string }[] = [
    { label: "Created", at: letter.createdAt },
    ...(letter.reviewedAt ? [{ label: "Reviewed by DCS", at: letter.reviewedAt }] : []),
    { label: "Subject Officer received", at: letter.subjectReceivedAt },
    { label: "Forwarded to Relevant Officer", at: letter.subjectForwardedAt },
    { label: "Relevant Officer received", at: letter.relevantReceivedAt },
    { label: "Action taken", at: letter.actionTakenAt, extra: letter.actionNotes ?? undefined },
  ];

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <CardTitle>{letter.referenceNumber}</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">{letter.subject}</p>
            </div>
            <LetterStatusBadge status={letter.status} />
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 text-sm">
          <InfoRow label="Division" value={DIVISION_NAMES[letter.division]} />
          <InfoRow label="From Whom" value={letter.fromWhom} />
          <InfoRow label="Received" value={formatDateTime(letter.receivedDate)} />
          <InfoRow label="Added By" value={letter.createdByRole === "dcs" ? "Admin (DCS)" : "Subject Officer"} />
          <InfoRow label="Subject Officer" value={letter.subjectOfficer?.name ?? "—"} />
          <InfoRow label="Relevant Officer" value={letter.relevantOfficer?.name ?? "Not yet assigned"} />
        </CardContent>
      </Card>

      {role === "dcs" && letter.status === "pending_review" && <ReviewCard letter={letter} />}

      <Card>
        <CardHeader>
          <CardTitle>Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="flex flex-col gap-3">
            {timeline.map((step) => (
              <li key={step.label} className="flex items-start justify-between gap-3 text-sm">
                <div>
                  <p className={step.at ? "font-medium" : "text-muted-foreground"}>{step.label}</p>
                  {step.extra && <p className="mt-0.5 text-muted-foreground">{step.extra}</p>}
                </div>
                <span className="shrink-0 text-muted-foreground">{step.at ? formatDateTime(step.at) : "Pending"}</span>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      {letter.reassignments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Reassignment history</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>From</TableHead>
                  <TableHead>To</TableHead>
                  <TableHead>Note</TableHead>
                  <TableHead>When</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {letter.reassignments.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell>{entry.fromOfficer.name}</TableCell>
                    <TableCell>{entry.toOfficer.name}</TableCell>
                    <TableCell>{entry.note ?? "—"}</TableCell>
                    <TableCell>{formatDateTime(entry.createdAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {role === "dcs" && (
        <Card>
          <CardHeader>
            <CardTitle>Officer links</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-2 text-sm">
              {letter.links.map((link) => (
                <li key={link.id} className="flex items-center justify-between">
                  <span>{link.role === "subjectOfficer" ? "Subject Officer" : "Relevant Officer"}</span>
                  <Badge variant={link.invalidatedAt ? "outline" : "secondary"}>{link.invalidatedAt ? "Spent" : "Active"}</Badge>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}

function ReviewCard({ letter }: { letter: LetterDetail }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const officers = useQuery({
    ...orpc.officers.listActive.queryOptions({ input: { division: letter.division } }),
    enabled: open,
  });

  const reviewMutation = useMutation(
    orpc.letters.review.mutationOptions({
      onSuccess: () => {
        toast.success("Letter reviewed and sent out.");
        queryClient.invalidateQueries({ queryKey: orpc.letters.get.key({ input: { id: letter.id } }) });
        queryClient.invalidateQueries({ queryKey: orpc.letters.list.key() });
        queryClient.invalidateQueries({ queryKey: orpc.letters.pendingReviewCount.key() });
        setOpen(false);
      },
      onError: (error) => toast.error(error.message),
    }),
  );

  const form = useForm({
    defaultValues: { relevantOfficerId: "" },
    onSubmit: async ({ value }) => {
      if (!value.relevantOfficerId) return;
      await reviewMutation.mutateAsync({ id: letter.id, relevantOfficerId: value.relevantOfficerId });
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pending your review</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="mb-3 text-sm text-muted-foreground">
          The Subject Officer sent this without a Relevant Officer. Pick one to send it onward.
        </p>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger render={<Button />}>Review</DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Assign a Relevant Officer</DialogTitle>
            </DialogHeader>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                form.handleSubmit();
              }}
            >
              <form.Field name="relevantOfficerId" validators={{ onChange: ({ value }) => (value ? undefined : { message: "Pick an officer" }) }}>
                {(field) => {
                  const noOfficers = officers.isSuccess && officers.data.length === 0;
                  return (
                    <Field data-invalid={field.state.meta.errors.length > 0 ? true : undefined}>
                      <FieldLabel>Relevant Officer</FieldLabel>
                      <Select value={field.state.value} onValueChange={(v) => field.handleChange(v ?? "")} disabled={noOfficers}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder={noOfficers ? "No officers in this division" : "Choose an officer"} />
                        </SelectTrigger>
                        <SelectContent>
                          {officers.data?.map((officer) => (
                            <SelectItem key={officer.id} value={officer.id}>
                              {officer.name} — {officer.position}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {noOfficers ? (
                        <FieldDescription>No active officers in this division — ask the Subject Officer to add one.</FieldDescription>
                      ) : (
                        <FieldError errors={field.state.meta.errors} />
                      )}
                    </Field>
                  );
                }}
              </form.Field>
              <DialogFooter className="mt-4">
                <Button type="submit" disabled={reviewMutation.isPending}>
                  {reviewMutation.isPending ? "Sending…" : "Assign & Send"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
