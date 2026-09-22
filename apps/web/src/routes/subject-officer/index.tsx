import { OFFICER_ROLES, type OfficerRole, USER_ROLE_LABELS } from "@dcsp-letter-management/domain/roles";
import { Badge } from "@dcsp-letter-management/ui/components/badge";
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
import { Field, FieldGroup, FieldLabel } from "@dcsp-letter-management/ui/components/field";
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

function EditSubjectOfficerRoleDialog({ id, name, role }: { id: string; name: string; role: OfficerRole }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState<OfficerRole>(role);

  const updateMutation = useMutation(
    orpc.subjectOfficers.updateRole.mutationOptions({
      onSuccess: () => {
        toast.success("Profile updated.");
        queryClient.invalidateQueries({ queryKey: orpc.subjectOfficers.list.key() });
        setOpen(false);
      },
      onError: (error) => toast.error(error.message),
    }),
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setValue(role);
      }}
    >
      <DialogTrigger render={<Button variant="ghost" size="sm" />}>Edit</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit {name}</DialogTitle>
        </DialogHeader>
        <FieldGroup>
          <Field>
            <FieldLabel>Profile</FieldLabel>
            <Select value={value} onValueChange={(next) => setValue(next as OfficerRole)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {OFFICER_ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {USER_ROLE_LABELS[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </FieldGroup>
        <DialogFooter>
          <Button
            type="button"
            disabled={updateMutation.isPending}
            onClick={() => updateMutation.mutate({ id, role: value })}
          >
            {updateMutation.isPending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SubjectOfficersPage() {
  const query = useQuery(orpc.subjectOfficers.list.queryOptions());

  return (
    <AppShell>
      <div className="mx-auto flex max-w-3xl flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-lg font-semibold">Subject Officers</h1>
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
                <TableHead>Profile</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {query.data.map((subjectOfficer) => (
                <TableRow key={subjectOfficer.id}>
                  <TableCell>{subjectOfficer.name}</TableCell>
                  <TableCell>{subjectOfficer.email}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{subjectOfficer.role ? USER_ROLE_LABELS[subjectOfficer.role] : "Subject Officer"}</Badge>
                  </TableCell>
                  <TableCell>
                    <EditSubjectOfficerRoleDialog
                      id={subjectOfficer.id}
                      name={subjectOfficer.name}
                      role={(subjectOfficer.role as OfficerRole) ?? "subjectOfficer"}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </AppShell>
  );
}
