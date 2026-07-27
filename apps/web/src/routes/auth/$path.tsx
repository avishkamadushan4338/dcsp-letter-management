import { viewPaths } from "@better-auth-ui/core";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { LandmarkIcon } from "lucide-react";
import type { CSSProperties } from "react";

import { Auth } from "@/components/auth/auth";

const validAuthPathSegments = new Set(Object.values(viewPaths.auth));

const APP_NAME = "Southern Province Planning Secretariat";
const APP_TAGLINE = "Letter Management System";

/**
 * The sign-in page is the one screen every visitor sees before they've
 * chosen a theme (or before they're even a user) — it always renders in the
 * brand's light palette, regardless of a saved dark-mode preference. Redeclaring
 * the semantic tokens here (from the same constant brand colors, not the
 * `.dark` overrides in globals.css) beats whatever `.dark` class is on
 * `<html>`, since a nearer custom-property declaration always wins.
 */
const FORCE_LIGHT_THEME_STYLE = {
  "--background": "var(--color-cream)",
  "--foreground": "var(--color-maroon)",
  "--card": "#ffffff",
  "--card-foreground": "var(--color-maroon)",
  "--popover": "#ffffff",
  "--popover-foreground": "var(--color-maroon)",
  "--primary": "var(--color-maroon)",
  "--primary-foreground": "var(--color-cream)",
  "--secondary": "var(--color-cream-dark)",
  "--secondary-foreground": "var(--color-maroon)",
  "--muted": "var(--color-cream-dark)",
  "--muted-foreground": "var(--color-maroon-mid)",
  "--accent": "var(--color-gold)",
  "--accent-foreground": "var(--color-maroon)",
  "--border": "var(--color-warm-neutral)",
  "--input": "var(--color-warm-neutral)",
  "--ring": "var(--color-gold)",
} as CSSProperties;

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
    <div className="grid h-full grid-cols-1 md:grid-cols-5" style={FORCE_LIGHT_THEME_STYLE}>
      {/* Branding panel — the primary visual on md+, hidden on phones so the form gets full width there. */}
      <div className="relative col-span-2 hidden flex-col justify-between overflow-hidden bg-primary p-10 text-primary-foreground md:flex">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,currentColor_1px,transparent_0)] bg-size-[22px_22px] opacity-[0.07]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 -right-24 size-72 rounded-full bg-accent/20 blur-3xl"
        />

        <div className="relative flex items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary-foreground/10 ring-1 ring-primary-foreground/15">
            <LandmarkIcon className="size-5" />
          </div>
          <span className="text-xs font-semibold tracking-wider text-primary-foreground/70 uppercase">{APP_NAME}</span>
        </div>

        <div className="relative flex flex-1 flex-col justify-center gap-4">
          <h1 className="font-heading text-3xl leading-tight font-semibold lg:text-4xl">{APP_TAGLINE}</h1>
          <p className="max-w-sm text-sm text-primary-foreground/70">
            Track every letter from intake to action — routed between the Admin, the Subject Officer, and Relevant Officers with a
            complete, auditable trail.
          </p>
        </div>

        <p className="relative text-xs text-primary-foreground/50">© {new Date().getFullYear()} {APP_NAME}</p>
      </div>

      {/* Auth form panel */}
      <div className="col-span-1 flex min-w-0 flex-col gap-6 overflow-y-auto p-4 md:col-span-3 md:p-8">
        <div className="flex min-w-0 items-center gap-2 md:hidden">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <LandmarkIcon className="size-4" />
          </div>
          <div className="min-w-0 leading-tight">
            <p className="truncate text-xs font-semibold text-muted-foreground">{APP_NAME}</p>
            <p className="truncate font-heading text-sm font-semibold">{APP_TAGLINE}</p>
          </div>
        </div>

        <div className="flex min-w-0 flex-1 flex-col items-center justify-center">
          <Auth path={path} />
        </div>
      </div>
    </div>
  );
}
