import { viewPaths } from "@better-auth-ui/core";
import { ensureSession } from "@better-auth-ui/react";
import { createFileRoute, notFound, redirect } from "@tanstack/react-router";

import { Settings } from "@/components/auth/settings/settings";
import { authClient } from "@/lib/auth-client";

const validSettingsPaths = Object.values(viewPaths.settings);

export const Route = createFileRoute("/settings/$path")({
  async beforeLoad({ params: { path }, context: { queryClient }, location }) {
    if (!validSettingsPaths.includes(path)) {
      throw notFound();
    }

    const session = await ensureSession(queryClient, authClient);

    if (!session) {
      throw redirect({
        to: "/auth/$path",
        params: { path: "sign-in" },
        search: { redirectTo: location.href },
      });
    }

    return { session };
  },
  component: SettingsPage,
});

function SettingsPage() {
  const { path } = Route.useParams();

  return (
    <div className="w-full max-w-3xl mx-auto p-4 md:p-6">
      <Settings path={path} />
    </div>
  );
}
