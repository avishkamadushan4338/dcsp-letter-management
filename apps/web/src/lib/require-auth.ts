import { ensureSession } from "@better-auth-ui/react";
import type { QueryClient } from "@tanstack/react-query";
import { redirect } from "@tanstack/react-router";

import { authClient } from "@/lib/auth-client";

/**
 * Route `beforeLoad` guard for pages that require a signed-in user. Redirects
 * to sign-in with `redirectTo` set to the page the visitor was trying to
 * reach, so they land back here (not on the dashboard default) once they've
 * authenticated.
 */
export async function requireAuth({ queryClient, href }: { queryClient: QueryClient; href: string }) {
  const session = await ensureSession(queryClient, authClient);

  if (!session) {
    throw redirect({
      to: "/auth/$path",
      params: { path: "sign-in" },
      search: { redirectTo: href },
    });
  }

  return session;
}
