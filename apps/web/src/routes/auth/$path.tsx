import { viewPaths } from "@better-auth-ui/core";
import { createFileRoute, redirect } from "@tanstack/react-router";

import { Auth } from "@/components/auth/auth";

const validAuthPathSegments = new Set(Object.values(viewPaths.auth));

type AuthSearch = {
  redirectTo?: string;
};

export const Route = createFileRoute("/auth/$path")({
  validateSearch: (search: Record<string, unknown>): AuthSearch => ({
    redirectTo: typeof search.redirectTo === "string" ? search.redirectTo : undefined,
  }),
  beforeLoad({ params: { path } }) {
    if (!validAuthPathSegments.has(path)) {
      throw redirect({ to: "/" });
    }
  },
  component: AuthPage,
});

function AuthPage() {
  const { path } = Route.useParams();

  return (
    <div className="flex justify-center my-auto p-4 md:p-6">
      <Auth path={path} />
    </div>
  );
}
