import { createFileRoute, redirect } from "@tanstack/react-router";

import { requireAuth } from "@/lib/require-auth";
import { parseUserRole } from "@/lib/role";

export const Route = createFileRoute("/")({
  async beforeLoad({ context: { queryClient }, location }) {
    const session = await requireAuth({ queryClient, href: location.href });
    const role = parseUserRole(session.user.role);
    throw redirect({ to: role ? "/dashboard" : "/letters" });
  },
});
