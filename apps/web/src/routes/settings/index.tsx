import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/settings/")({
  beforeLoad: async () => {
    throw redirect({
      to: "/settings/$path",
      params: { path: "account" },
    });
  },
});
