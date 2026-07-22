import { useAuthenticate } from "@better-auth-ui/react";
import { Navigate, createFileRoute } from "@tanstack/react-router";

import Loader from "@/components/loader";
import { authClient } from "@/lib/auth-client";

export const Route = createFileRoute("/")({
  component: HomeComponent,
});

function HomeComponent() {
  const { data: session } = useAuthenticate(authClient);

  if (!session) {
    return <Loader />;
  }

  return <Navigate to="/letters" />;
}
