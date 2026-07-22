import { type UserRole, userRoleSchema } from "@dcsp-letter-management/domain/roles";
import { useSession } from "@better-auth-ui/react";

import { authClient } from "@/lib/auth-client";

export function parseUserRole(role: unknown): UserRole | null {
  const parsed = userRoleSchema.safeParse(role);
  return parsed.success ? parsed.data : null;
}

/** The current signed-in user's role, or `null` while loading / signed out. */
export function useUserRole(): { role: UserRole | null; isPending: boolean } {
  const { data: session, isPending } = useSession(authClient);
  return { role: parseUserRole(session?.user.role), isPending };
}
