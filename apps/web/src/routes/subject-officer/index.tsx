import { MIN_PASSWORD_LENGTH } from "@dcsp-letter-management/domain/roles";
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
import { Field, FieldError, FieldGroup, FieldLabel } from "@dcsp-letter-management/ui/components/field";
import { Input } from "@dcsp-letter-management/ui/components/input";
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
import { UsersIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import Loader from "@/components/loader";
import { orpc } from "@/utils/orpc";

export const Route = createFileRoute("/subject-officer/")({
  component: SubjectOfficersPage,
});

function required(message = "Required") {
  return ({ value }: { value: unknown }) => (value ? undefined : { message });
}

function SubjectOfficersPage() {
  const query = useQuery(orpc.subjectOfficers.list.queryOptions());

  return (
    <AppShell>
      <div className="mx-auto flex max-w-3xl flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-lg font-semibold">Subject Officers</h1>
          <AddSubjectOfficerDialog />
        </div>

        {query.isPending ? (
          <Loader />
        ) : !query.data || query.data.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <UsersIcon />
              </EmptyMedia>
              <EmptyTitle>No Subject Officers yet</EmptyTitle>
              <EmptyDescription>Create a Subject Officer account before registering letters.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {query.data.map((subjectOfficer) => (
                <TableRow key={subjectOfficer.id}>
                  <TableCell>{subjectOfficer.name}</TableCell>
                  <TableCell>{subjectOfficer.email}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </AppShell>
  );
}

function AddSubjectOfficerDialog() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const createMutation = useMutation(
    orpc.subjectOfficers.create.mutationOptions({
      onSuccess: () => {
        toast.success("Subject Officer account created.");
        queryClient.invalidateQueries({ queryKey: orpc.subjectOfficers.list.key() });
        setOpen(false);
        form.reset();
      },
      onError: (error) => toast.error(error.message),
    }),
  );

  const form = useForm({
    defaultValues: { name: "", email: "", password: "" },
    onSubmit: async ({ value }) => {
      await createMutation.mutateAsync(value);
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>Add Subject Officer</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create a Subject Officer account</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            form.handleSubmit();
          }}
        >
          <FieldGroup>
            <form.Field name="name" validators={{ onChange: required("Name is required") }}>
              {(field) => (
                <Field data-invalid={field.state.meta.errors.length > 0 ? true : undefined}>
                  <FieldLabel>Name</FieldLabel>
                  <Input value={field.state.value} onBlur={field.handleBlur} onChange={(e) => field.handleChange(e.target.value)} />
                  <FieldError errors={field.state.meta.errors} />
                </Field>
              )}
            </form.Field>

            <form.Field name="email" validators={{ onChange: required("Email is required") }}>
              {(field) => (
                <Field data-invalid={field.state.meta.errors.length > 0 ? true : undefined}>
                  <FieldLabel>Email</FieldLabel>
                  <Input type="email" value={field.state.value} onBlur={field.handleBlur} onChange={(e) => field.handleChange(e.target.value)} />
                  <FieldError errors={field.state.meta.errors} />
                </Field>
              )}
            </form.Field>

            <form.Field
              name="password"
              validators={{
                onChange: ({ value }) =>
                  value.length >= MIN_PASSWORD_LENGTH ? undefined : { message: `Must be at least ${MIN_PASSWORD_LENGTH} characters` },
              }}
            >
              {(field) => (
                <Field data-invalid={field.state.meta.errors.length > 0 ? true : undefined}>
                  <FieldLabel>Initial password</FieldLabel>
                  <Input
                    type="text"
                    autoComplete="off"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                  <FieldError errors={field.state.meta.errors} />
                </Field>
              )}
            </form.Field>

            <DialogFooter>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? "Creating…" : "Create Account"}
              </Button>
            </DialogFooter>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}
