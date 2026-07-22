import { DIVISION_CODES, DIVISION_NAMES, type DivisionCode } from "@dcsp-letter-management/domain/division";
import { Button } from "@dcsp-letter-management/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@dcsp-letter-management/ui/components/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@dcsp-letter-management/ui/components/empty";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@dcsp-letter-management/ui/components/field";
import { Input } from "@dcsp-letter-management/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@dcsp-letter-management/ui/components/select";
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@dcsp-letter-management/ui/components/tabs";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { DatePicker } from "@/components/date-field";
import Loader from "@/components/loader";
import { useUserRole } from "@/lib/role";
import { orpc } from "@/utils/orpc";

export const Route = createFileRoute("/letters/new")({
  component: NewLetterPage,
});

function required(message = "Required") {
  return ({ value }: { value: unknown }) => (value ? undefined : { message });
}

function NewLetterPage() {
  const { role, isPending } = useUserRole();

  return (
    <AppShell>
      <div className="mx-auto max-w-lg">
        <h1 className="mb-4 text-lg font-semibold">New Letter</h1>
        {isPending ? <Loader /> : role === "dcs" ? <DcsForm /> : role === "subjectOfficer" ? <SubjectOfficerForm /> : null}
      </div>
    </AppShell>
  );
}

function DivisionField({
  division,
  onDivisionChange,
}: {
  division: string;
  onDivisionChange: (value: DivisionCode) => void;
}) {
  return (
    <Field>
      <FieldLabel>Division</FieldLabel>
      <Select value={division} onValueChange={(value) => onDivisionChange(value as DivisionCode)}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Choose a division" />
        </SelectTrigger>
        <SelectContent>
          {DIVISION_CODES.map((code) => (
            <SelectItem key={code} value={code}>
              {DIVISION_NAMES[code]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}

function ReferenceNumberPreview({ division }: { division: DivisionCode | "" }) {
  const preview = useQuery({
    ...orpc.letters.previewNextNumber.queryOptions({ input: { division: division as DivisionCode } }),
    enabled: !!division,
  });

  if (!division) return null;

  return (
    <FieldDescription>
      Reference number will be <span className="font-medium text-foreground">{preview.data?.referenceNumber ?? "…"}</span>
    </FieldDescription>
  );
}

function RelevantOfficerField({
  division,
  value,
  onChange,
  errors,
}: {
  division: DivisionCode | "";
  value: string;
  onChange: (value: string) => void;
  errors?: Array<{ message?: string } | undefined>;
}) {
  const officers = useQuery({
    ...orpc.officers.listActive.queryOptions({ input: { division: division as DivisionCode } }),
    enabled: !!division,
  });
  const noOfficers = !!division && officers.isSuccess && officers.data.length === 0;

  return (
    <Field data-invalid={errors && errors.length > 0 ? true : undefined}>
      <FieldLabel>Relevant Officer</FieldLabel>
      <Select value={value} onValueChange={(v) => onChange(v ?? "")} disabled={!division || noOfficers}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder={!division ? "Pick a division first" : noOfficers ? "No officers in this division" : "Choose an officer"} />
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
        <FieldDescription>
          No active officers in this division yet — add one from the{" "}
          <Link to="/officers" className="underline underline-offset-4">
            Officers roster
          </Link>
          .
        </FieldDescription>
      ) : (
        <FieldError errors={errors} />
      )}
    </Field>
  );
}

function DcsForm() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const subjectOfficer = useQuery(orpc.settings.getCurrentSubjectOfficer.queryOptions());
  const [division, setDivision] = useState<DivisionCode | "">("");

  const createMutation = useMutation(
    orpc.letters.createByDcs.mutationOptions({
      onSuccess: (letter) => {
        toast.success(`Letter ${letter.referenceNumber} sent to the Subject Officer and Relevant Officer.`);
        queryClient.invalidateQueries({ queryKey: orpc.letters.list.key() });
        navigate({ to: "/letters/$id", params: { id: letter.id } });
      },
      onError: (error) => toast.error(error.message),
    }),
  );

  const form = useForm({
    defaultValues: { division: "" as DivisionCode | "", subject: "", fromWhom: "", receivedDate: "", relevantOfficerId: "" },
    onSubmit: async ({ value }) => {
      if (!value.division || !value.relevantOfficerId) return;
      await createMutation.mutateAsync({
        division: value.division,
        subject: value.subject,
        fromWhom: value.fromWhom,
        receivedDate: new Date(value.receivedDate),
        relevantOfficerId: value.relevantOfficerId,
      });
    },
  });

  if (subjectOfficer.isPending) return <Loader />;

  if (!subjectOfficer.data) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>No Subject Officer set</EmptyTitle>
          <EmptyDescription>
            Set a Subject Officer before creating letters. <br />
            <Button className="mt-3" onClick={() => navigate({ to: "/subject-officer" })}>
              Set Subject Officer
            </Button>
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Register a letter</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            form.handleSubmit();
          }}
        >
          <FieldGroup>
            <form.Field name="division">
              {(field) => (
                <DivisionField
                  division={field.state.value}
                  onDivisionChange={(value) => {
                    field.handleChange(value);
                    setDivision(value);
                    form.setFieldValue("relevantOfficerId", "");
                  }}
                />
              )}
            </form.Field>
            <ReferenceNumberPreview division={division} />

            <form.Field name="subject" validators={{ onChange: required("Subject is required") }}>
              {(field) => (
                <Field data-invalid={field.state.meta.errors.length > 0 ? true : undefined}>
                  <FieldLabel>Subject</FieldLabel>
                  <Input value={field.state.value} onBlur={field.handleBlur} onChange={(e) => field.handleChange(e.target.value)} />
                  <FieldError errors={field.state.meta.errors} />
                </Field>
              )}
            </form.Field>

            <form.Field name="fromWhom" validators={{ onChange: required("From Whom is required") }}>
              {(field) => (
                <Field data-invalid={field.state.meta.errors.length > 0 ? true : undefined}>
                  <FieldLabel>From Whom</FieldLabel>
                  <Input value={field.state.value} onBlur={field.handleBlur} onChange={(e) => field.handleChange(e.target.value)} />
                  <FieldError errors={field.state.meta.errors} />
                </Field>
              )}
            </form.Field>

            <form.Field name="receivedDate" validators={{ onChange: required("Received date is required") }}>
              {(field) => (
                <Field data-invalid={field.state.meta.errors.length > 0 ? true : undefined}>
                  <FieldLabel>Received Date</FieldLabel>
                  <DatePicker value={field.state.value} onChange={field.handleChange} onBlur={field.handleBlur} />
                  <FieldError errors={field.state.meta.errors} />
                </Field>
              )}
            </form.Field>

            <form.Field name="relevantOfficerId" validators={{ onChange: required("Pick a Relevant Officer") }}>
              {(field) => (
                <RelevantOfficerField
                  division={division}
                  value={field.state.value}
                  onChange={field.handleChange}
                  errors={field.state.meta.errors}
                />
              )}
            </form.Field>

            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? "Sending…" : "Create & Send"}
            </Button>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}

function SubjectOfficerForm() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [option, setOption] = useState<"direct" | "pending">("direct");
  const [division, setDivision] = useState<DivisionCode | "">("");

  const directMutation = useMutation(
    orpc.letters.createBySubjectOfficerDirect.mutationOptions({
      onSuccess: (letter) => {
        toast.success(`Letter ${letter.referenceNumber} sent to the Relevant Officer.`);
        queryClient.invalidateQueries({ queryKey: orpc.letters.list.key() });
        navigate({ to: "/letters/$id", params: { id: letter.id } });
      },
      onError: (error) => toast.error(error.message),
    }),
  );

  const pendingMutation = useMutation(
    orpc.letters.createBySubjectOfficerPending.mutationOptions({
      onSuccess: (letter) => {
        toast.success(`Letter ${letter.referenceNumber} sent to DCS for review.`);
        queryClient.invalidateQueries({ queryKey: orpc.letters.list.key() });
        navigate({ to: "/letters/$id", params: { id: letter.id } });
      },
      onError: (error) => toast.error(error.message),
    }),
  );

  const form = useForm({
    defaultValues: { division: "" as DivisionCode | "", subject: "", fromWhom: "", receivedDate: "", relevantOfficerId: "" },
    onSubmit: async ({ value }) => {
      if (!value.division) return;
      if (option === "direct") {
        if (!value.relevantOfficerId) return;
        await directMutation.mutateAsync({
          division: value.division,
          subject: value.subject,
          fromWhom: value.fromWhom,
          receivedDate: new Date(value.receivedDate),
          relevantOfficerId: value.relevantOfficerId,
        });
      } else {
        await pendingMutation.mutateAsync({
          division: value.division,
          subject: value.subject,
          fromWhom: value.fromWhom,
          receivedDate: new Date(value.receivedDate),
        });
      }
    },
  });

  const isPending = directMutation.isPending || pendingMutation.isPending;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Register a letter</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs value={option} onValueChange={(value) => setOption(value as "direct" | "pending")} className="mb-4">
          <TabsList>
            <TabsTrigger value="direct">Send Directly</TabsTrigger>
            <TabsTrigger value="pending">Send via DCS</TabsTrigger>
          </TabsList>
        </Tabs>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            form.handleSubmit();
          }}
        >
          <FieldGroup>
            <form.Field name="division">
              {(field) => (
                <DivisionField
                  division={field.state.value}
                  onDivisionChange={(value) => {
                    field.handleChange(value);
                    setDivision(value);
                    form.setFieldValue("relevantOfficerId", "");
                  }}
                />
              )}
            </form.Field>
            <ReferenceNumberPreview division={division} />

            <form.Field name="subject" validators={{ onChange: required("Subject is required") }}>
              {(field) => (
                <Field data-invalid={field.state.meta.errors.length > 0 ? true : undefined}>
                  <FieldLabel>Subject</FieldLabel>
                  <Input value={field.state.value} onBlur={field.handleBlur} onChange={(e) => field.handleChange(e.target.value)} />
                  <FieldError errors={field.state.meta.errors} />
                </Field>
              )}
            </form.Field>

            <form.Field name="fromWhom" validators={{ onChange: required("From Whom is required") }}>
              {(field) => (
                <Field data-invalid={field.state.meta.errors.length > 0 ? true : undefined}>
                  <FieldLabel>From Whom</FieldLabel>
                  <Input value={field.state.value} onBlur={field.handleBlur} onChange={(e) => field.handleChange(e.target.value)} />
                  <FieldError errors={field.state.meta.errors} />
                </Field>
              )}
            </form.Field>

            <form.Field name="receivedDate" validators={{ onChange: required("Received date is required") }}>
              {(field) => (
                <Field data-invalid={field.state.meta.errors.length > 0 ? true : undefined}>
                  <FieldLabel>Received Date</FieldLabel>
                  <DatePicker value={field.state.value} onChange={field.handleChange} onBlur={field.handleBlur} />
                  <FieldError errors={field.state.meta.errors} />
                </Field>
              )}
            </form.Field>

            {option === "direct" && (
              <form.Field name="relevantOfficerId" validators={{ onChange: required("Pick a Relevant Officer") }}>
                {(field) => (
                  <RelevantOfficerField
                    division={division}
                    value={field.state.value}
                    onChange={field.handleChange}
                    errors={field.state.meta.errors}
                  />
                )}
              </form.Field>
            )}

            <Button type="submit" disabled={isPending}>
              {isPending ? "Sending…" : option === "direct" ? "Create & Send" : "Send to DCS for Review"}
            </Button>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}
