import { DIVISION_CODES, DIVISION_NAMES, type DivisionCode } from "@dcsp-letter-management/domain/division";
import { OFFICER_POSITIONS, type OfficerPosition } from "@dcsp-letter-management/domain/officer-position";
import { Badge } from "@dcsp-letter-management/ui/components/badge";
import { Button } from "@dcsp-letter-management/ui/components/button";
import {
  Dialog,
  DialogClose,
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
import { UsersIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import Loader from "@/components/loader";
import { useUserRole } from "@/lib/role";
import { orpc } from "@/utils/orpc";

export const Route = createFileRoute("/officers/")({
  component: OfficersPage,
});

function required(message = "Required") {
  return ({ value }: { value: unknown }) => (value ? undefined : { message });
}

function OfficersPage() {
  const { role, isPending } = useUserRole();
  const query = useQuery(orpc.officers.list.queryOptions());

  return (
    <AppShell>
      <div className="mx-auto flex max-w-3xl flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-lg font-semibold">Officer Roster</h1>
          {role === "subjectOfficer" && <AddOfficerDialog />}
        </div>

        {isPending || query.isPending ? (
          <Loader />
        ) : !query.data || query.data.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <UsersIcon />
              </EmptyMedia>
              <EmptyTitle>No officers yet</EmptyTitle>
              <EmptyDescription>
                {role === "subjectOfficer" ? "Add an officer to start assigning letters." : "No officers have been added yet."}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Position</TableHead>
                <TableHead>Division</TableHead>
                <TableHead>Status</TableHead>
                {role === "subjectOfficer" && <TableHead />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {query.data.map((officer) => (
                <TableRow key={officer.id}>
                  <TableCell>{officer.name}</TableCell>
                  <TableCell>{officer.position}</TableCell>
                  <TableCell>{DIVISION_NAMES[officer.division]}</TableCell>
                  <TableCell>
                    <Badge variant={officer.active ? "secondary" : "outline"}>{officer.active ? "Active" : "Removed"}</Badge>
                  </TableCell>
                  {role === "subjectOfficer" && (
                    <TableCell>{officer.active && <RemoveOfficerDialog id={officer.id} name={officer.name} />}</TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </AppShell>
  );
}

function AddOfficerDialog() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const createMutation = useMutation(
    orpc.officers.create.mutationOptions({
      onSuccess: () => {
        toast.success("Officer added.");
        queryClient.invalidateQueries({ queryKey: orpc.officers.list.key() });
        queryClient.invalidateQueries({ queryKey: orpc.officers.listActive.key() });
        setOpen(false);
        form.reset();
      },
      onError: (error) => toast.error(error.message),
    }),
  );

  const form = useForm({
    defaultValues: { name: "", email: "", position: "" as OfficerPosition | "", division: "" as DivisionCode | "" },
    onSubmit: async ({ value }) => {
      if (!value.division || !value.position) return;
      await createMutation.mutateAsync({ name: value.name, email: value.email, position: value.position, division: value.division });
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>Add Officer</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add an officer</DialogTitle>
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

            <form.Field name="position" validators={{ onChange: required("Position is required") }}>
              {(field) => (
                <Field data-invalid={field.state.meta.errors.length > 0 ? true : undefined}>
                  <FieldLabel>Position</FieldLabel>
                  <Select value={field.state.value} onValueChange={(value) => field.handleChange(value as OfficerPosition)}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Choose a position" />
                    </SelectTrigger>
                    <SelectContent>
                      {OFFICER_POSITIONS.map((position) => (
                        <SelectItem key={position} value={position}>
                          {position}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FieldError errors={field.state.meta.errors} />
                </Field>
              )}
            </form.Field>

            <form.Field name="division" validators={{ onChange: required("Division is required") }}>
              {(field) => (
                <Field data-invalid={field.state.meta.errors.length > 0 ? true : undefined}>
                  <FieldLabel>Division</FieldLabel>
                  <Select value={field.state.value} onValueChange={(value) => field.handleChange(value as DivisionCode)}>
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
                  <FieldError errors={field.state.meta.errors} />
                </Field>
              )}
            </form.Field>

            <DialogFooter>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? "Adding…" : "Add Officer"}
              </Button>
            </DialogFooter>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function RemoveOfficerDialog({ id, name }: { id: string; name: string }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const removeMutation = useMutation(
    orpc.officers.remove.mutationOptions({
      onSuccess: () => {
        toast.success(`${name} removed from the roster.`);
        queryClient.invalidateQueries({ queryKey: orpc.officers.list.key() });
        queryClient.invalidateQueries({ queryKey: orpc.officers.listActive.key() });
        setOpen(false);
      },
      onError: (error) => toast.error(error.message),
    }),
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="ghost" size="sm" />}>Remove</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Remove {name}?</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          They&apos;ll no longer be selectable for new letters. Letters already assigned to them keep showing their name.
        </p>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
          <Button variant="destructive" disabled={removeMutation.isPending} onClick={() => removeMutation.mutate({ id })}>
            {removeMutation.isPending ? "Removing…" : "Remove"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
