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

import { AppShell } from "@/components/app-shell";
import { MultiOfficerNotice } from "@/components/letters/multi-officer-notice";
import { RelevantOfficersField } from "@/components/letters/relevant-officers-field";
import { LetterStatusBadge } from "@/components/letters/status-badge";
import Loader from "@/components/loader";
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
    { label: "Forwarded to Relevant Officer(s)", at: letter.subjectForwardedAt },
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
          <InfoRow label="Division" value={letter.division ? DIVISION_NAMES[letter.division] : "Not yet assigned"} />
          <InfoRow label="From Whom" value={letter.fromWhom} />
          <InfoRow label="Received" value={formatDateTime(letter.receivedDate)} />
          <InfoRow label="Added By" value={letter.createdByRole === "dcs" ? "Admin (DCS)" : "Subject Officer"} />
          <InfoRow label="Subject Officer" value={letter.subjectOfficer?.name ?? "—"} />
        </CardContent>
      </Card>

      {role === "dcs" && letter.status === "pending_review" && <ReviewCard letter={letter} />}

      {role === "subjectOfficer" && (letter.status === "sent_to_subject" || letter.status === "with_subject_officer") && (
        <SubjectOfficerActionCard letter={letter} />
      )}

      {letter.relevantOfficers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Relevant Officers</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {letter.relevantOfficers.map((assignment) => (
              <div key={assignment.id} className="rounded-md border p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium">
                    {assignment.officer.name} <span className="font-normal text-muted-foreground">— {assignment.officer.position}</span>
                  </p>
                  <Badge variant={assignment.actionTakenAt ? "default" : assignment.receivedAt ? "secondary" : "outline"}>
                    {assignment.actionTakenAt ? "Action taken" : assignment.receivedAt ? "Received" : "Awaiting receipt"}
                  </Badge>
                </div>
                <div className="mt-2 flex flex-col gap-1 text-muted-foreground">
                  <p>Received: {assignment.receivedAt ? formatDateTime(assignment.receivedAt) : "Pending"}</p>
                  <p>Action taken: {assignment.actionTakenAt ? formatDateTime(assignment.actionTakenAt) : "Pending"}</p>
                  {assignment.actionNotes && <p className="text-foreground">{assignment.actionNotes}</p>}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

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
                  <span>
                    {link.role === "subjectOfficer" ? "Subject Officer" : `Relevant Officer — ${link.relevantOfficerAssignment?.officer.name ?? "?"}`}
                  </span>
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

function SubjectOfficerActionCard({ letter }: { letter: LetterDetail }) {
  const queryClient = useQueryClient();
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: orpc.letters.get.key({ input: { id: letter.id } }) });
    queryClient.invalidateQueries({ queryKey: orpc.letters.list.key() });
  };

  const markReceived = useMutation(
    orpc.letters.subjectMarkReceived.mutationOptions({
      onSuccess: () => {
        toast.success("Marked received.");
        invalidate();
      },
      onError: (error) => toast.error(error.message),
    }),
  );

  const forward = useMutation(
    orpc.letters.subjectForward.mutationOptions({
      onSuccess: () => {
        toast.success("Sent to the Relevant Officer.");
        invalidate();
      },
      onError: (error) => toast.error(error.message),
    }),
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Your action</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <MultiOfficerNotice officerNames={letter.relevantOfficers.map((assignment) => assignment.officer.name)} />
        {letter.status === "sent_to_subject" ? (
          <Button disabled={markReceived.isPending} onClick={() => markReceived.mutate({ id: letter.id })}>
            {markReceived.isPending ? "Marking…" : "Mark Received"}
          </Button>
        ) : (
          <Button disabled={forward.isPending} onClick={() => forward.mutate({ id: letter.id })}>
            {forward.isPending ? "Sending…" : "Send to Relevant Officer"}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function ReviewCard({ letter }: { letter: LetterDetail }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

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
    defaultValues: { relevantOfficerIds: [] as string[] },
    onSubmit: async ({ value }) => {
      if (value.relevantOfficerIds.length === 0) return;
      await reviewMutation.mutateAsync({ id: letter.id, relevantOfficerIds: value.relevantOfficerIds });
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pending your review</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="mb-3 text-sm text-muted-foreground">
          The Subject Officer sent this without a Relevant Officer. Pick one or more to send it onward.
        </p>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger render={<Button />}>Review</DialogTrigger>
          <DialogContent>
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
      </CardContent>
    </Card>
  );
}
