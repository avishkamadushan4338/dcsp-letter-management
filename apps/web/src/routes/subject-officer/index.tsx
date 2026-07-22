import { Button } from "@dcsp-letter-management/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@dcsp-letter-management/ui/components/card";
import { Field, FieldDescription, FieldLabel } from "@dcsp-letter-management/ui/components/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@dcsp-letter-management/ui/components/select";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import Loader from "@/components/loader";
import { orpc } from "@/utils/orpc";

export const Route = createFileRoute("/subject-officer/")({
  component: SubjectOfficerPage,
});

function SubjectOfficerPage() {
  const queryClient = useQueryClient();
  const current = useQuery(orpc.settings.getCurrentSubjectOfficer.queryOptions());
  const candidates = useQuery(orpc.settings.listSubjectOfficerCandidates.queryOptions());
  const [selected, setSelected] = useState<string>("");

  const setMutation = useMutation(
    orpc.settings.setCurrentSubjectOfficer.mutationOptions({
      onSuccess: () => {
        toast.success("Subject Officer updated.");
        queryClient.invalidateQueries({ queryKey: orpc.settings.getCurrentSubjectOfficer.key() });
      },
      onError: (error) => toast.error(error.message),
    }),
  );

  return (
    <AppShell>
      <div className="mx-auto max-w-lg">
        <h1 className="mb-4 text-lg font-semibold">Subject Officer</h1>
        <Card>
          <CardHeader>
            <CardTitle>Currently designated</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {current.isPending ? (
              <Loader />
            ) : (
              <p className="text-sm">
                {current.data ? (
                  <>
                    <span className="font-medium">{current.data.name}</span> ({current.data.email})
                  </>
                ) : (
                  "No Subject Officer has been set yet."
                )}
              </p>
            )}

            <Field>
              <FieldLabel>Change Subject Officer</FieldLabel>
              <Select value={selected} onValueChange={(value) => setSelected(value ?? "")}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Choose a user" />
                </SelectTrigger>
                <SelectContent>
                  {candidates.data?.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name} ({user.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldDescription>Only affects letters created after this change.</FieldDescription>
            </Field>

            <Button
              disabled={!selected || setMutation.isPending}
              onClick={() => setMutation.mutate({ userId: selected })}
            >
              {setMutation.isPending ? "Saving…" : "Save"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
