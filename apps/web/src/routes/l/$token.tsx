import { DIVISION_NAMES } from "@dcsp-letter-management/domain/division";
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
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@dcsp-letter-management/ui/components/empty";
import { Field, FieldError, FieldLabel } from "@dcsp-letter-management/ui/components/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@dcsp-letter-management/ui/components/select";
import { Textarea } from "@dcsp-letter-management/ui/components/textarea";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2Icon, LinkIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import Loader from "@/components/loader";
import { LetterStatusBadge } from "@/components/letters/status-badge";
import { formatDate } from "@/lib/format";
import { orpc } from "@/utils/orpc";

export const Route = createFileRoute("/l/$token")({
  component: LetterLinkPage,
});

function LetterLinkPage() {
  const { token } = Route.useParams();
  const query = useQuery(orpc.letterLinks.get.queryOptions({ input: { token } }));

  return (
    <div className="mx-auto flex min-h-svh max-w-lg flex-col justify-center gap-4 p-4">
      <div className="text-center">
        <h1 className="font-semibold">DCSP Letter Management</h1>
      </div>

      {query.isPending ? (
        <Loader />
      ) : !query.data || query.data.invalidated ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <LinkIcon />
            </EmptyMedia>
            <EmptyTitle>Link no longer active</EmptyTitle>
            <EmptyDescription>This link has already been used or was replaced by a newer one.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <LinkContent token={token} data={query.data} />
      )}
    </div>
  );
}

type LinkData = Awaited<ReturnType<typeof orpc.letterLinks.get.call>>;

function LinkContent({ token, data }: { token: string; data: LinkData }) {
  const { letter, role } = data;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle>{letter.referenceNumber}</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">{letter.subject}</p>
          </div>
          <LetterStatusBadge status={letter.status} />
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-muted-foreground">Division</dt>
            <dd className="font-medium">{DIVISION_NAMES[letter.division]}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">From Whom</dt>
            <dd className="font-medium">{letter.fromWhom}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Received</dt>
            <dd className="font-medium">{formatDate(letter.receivedDate)}</dd>
          </div>
        </dl>

        {role === "subjectOfficer" ? <SubjectOfficerActions token={token} status={letter.status} /> : <RelevantOfficerActions token={token} status={letter.status} division={letter.division} />}
      </CardContent>
    </Card>
  );
}

function ActionDone({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-dashed p-4 text-sm text-muted-foreground">
      <CheckCircle2Icon className="size-4 shrink-0" />
      {text}
    </div>
  );
}

function SubjectOfficerActions({ token, status }: { token: string; status: string }) {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: orpc.letterLinks.get.key({ input: { token } }) });

  const markReceived = useMutation(
    orpc.letterLinks.subjectMarkReceived.mutationOptions({
      onSuccess: () => {
        toast.success("Marked received.");
        invalidate();
      },
      onError: (error) => toast.error(error.message),
    }),
  );

  const forward = useMutation(
    orpc.letterLinks.subjectForward.mutationOptions({
      onSuccess: () => {
        toast.success("Sent to the Relevant Officer.");
        invalidate();
      },
      onError: (error) => toast.error(error.message),
    }),
  );

  if (status === "sent_to_subject") {
    return (
      <Button disabled={markReceived.isPending} onClick={() => markReceived.mutate({ token })}>
        {markReceived.isPending ? "Marking…" : "Mark Received"}
      </Button>
    );
  }

  if (status === "with_subject_officer") {
    return (
      <Button disabled={forward.isPending} onClick={() => forward.mutate({ token })}>
        {forward.isPending ? "Sending…" : "Send to Relevant Officer"}
      </Button>
    );
  }

  return <ActionDone text="Nothing more to do here." />;
}

function RelevantOfficerActions({ token, status, division }: { token: string; status: string; division: string }) {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: orpc.letterLinks.get.key({ input: { token } }) });

  const markReceived = useMutation(
    orpc.letterLinks.relevantMarkReceived.mutationOptions({
      onSuccess: () => {
        toast.success("Marked received.");
        invalidate();
      },
      onError: (error) => toast.error(error.message),
    }),
  );

  if (status === "sent_to_relevant") {
    return (
      <Button disabled={markReceived.isPending} onClick={() => markReceived.mutate({ token })}>
        {markReceived.isPending ? "Marking…" : "Mark Received"}
      </Button>
    );
  }

  if (status === "with_relevant_officer") {
    return (
      <div className="flex flex-col gap-3">
        <RecordActionForm token={token} onDone={invalidate} />
        <ReassignDialog token={token} division={division} onDone={invalidate} />
      </div>
    );
  }

  if (status === "action_taken") {
    return <ActionDone text="Action already recorded for this letter." />;
  }

  return <ActionDone text="Nothing to do yet." />;
}

function RecordActionForm({ token, onDone }: { token: string; onDone: () => void }) {
  const recordAction = useMutation(
    orpc.letterLinks.relevantRecordAction.mutationOptions({
      onSuccess: () => {
        toast.success("Action recorded.");
        onDone();
      },
      onError: (error) => toast.error(error.message),
    }),
  );

  const form = useForm({
    defaultValues: { actionNotes: "" },
    onSubmit: async ({ value }) => {
      if (!value.actionNotes.trim()) return;
      await recordAction.mutateAsync({ token, actionNotes: value.actionNotes });
    },
  });

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        form.handleSubmit();
      }}
      className="flex flex-col gap-3"
    >
      <form.Field
        name="actionNotes"
        validators={{ onChange: ({ value }) => (value.trim() ? undefined : { message: "Describe the action taken" }) }}
      >
        {(field) => (
          <Field data-invalid={field.state.meta.errors.length > 0 ? true : undefined}>
            <FieldLabel>Action taken</FieldLabel>
            <Textarea value={field.state.value} onBlur={field.handleBlur} onChange={(e) => field.handleChange(e.target.value)} rows={4} />
            <FieldError errors={field.state.meta.errors} />
          </Field>
        )}
      </form.Field>
      <Button type="submit" disabled={recordAction.isPending}>
        {recordAction.isPending ? "Recording…" : "Record Action"}
      </Button>
    </form>
  );
}

function ReassignDialog({ token, division, onDone }: { token: string; division: string; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const officers = useQuery({
    ...orpc.officers.listActive.queryOptions({ input: { division: division as never } }),
    enabled: open,
  });

  const reassign = useMutation(
    orpc.letterLinks.relevantReassign.mutationOptions({
      onSuccess: () => {
        toast.success("Reassigned to the new officer.");
        setOpen(false);
        onDone();
      },
      onError: (error) => toast.error(error.message),
    }),
  );

  const form = useForm({
    defaultValues: { toOfficerId: "", note: "" },
    onSubmit: async ({ value }) => {
      if (!value.toOfficerId) return;
      await reassign.mutateAsync({ token, toOfficerId: value.toOfficerId, note: value.note || undefined });
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" />}>Reassign to another officer</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reassign this letter</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            form.handleSubmit();
          }}
          className="flex flex-col gap-4"
        >
          <form.Field name="toOfficerId" validators={{ onChange: ({ value }) => (value ? undefined : { message: "Pick an officer" }) }}>
            {(field) => (
              <Field data-invalid={field.state.meta.errors.length > 0 ? true : undefined}>
                <FieldLabel>New Relevant Officer</FieldLabel>
                <Select value={field.state.value} onValueChange={(v) => field.handleChange(v ?? "")}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Choose an officer" />
                  </SelectTrigger>
                  <SelectContent>
                    {officers.data?.map((officer) => (
                      <SelectItem key={officer.id} value={officer.id}>
                        {officer.name} — {officer.position}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldError errors={field.state.meta.errors} />
              </Field>
            )}
          </form.Field>

          <form.Field name="note">
            {(field) => (
              <Field>
                <FieldLabel>Note (optional)</FieldLabel>
                <Textarea value={field.state.value} onBlur={field.handleBlur} onChange={(e) => field.handleChange(e.target.value)} rows={3} />
              </Field>
            )}
          </form.Field>

          <DialogFooter>
            <Button type="submit" disabled={reassign.isPending}>
              {reassign.isPending ? "Reassigning…" : "Reassign"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
