import { useQuery } from "@tanstack/react-query";
import { Link, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { UserButton } from "@/components/auth/user/user-button";
import { Badge } from "@dcsp-letter-management/ui/components/badge";
import { cn } from "@dcsp-letter-management/ui/lib/utils";
import { useUserRole } from "@/lib/role";
import { orpc } from "@/utils/orpc";

interface NavLink {
  to: string;
  label: string;
}

const DCS_LINKS: NavLink[] = [
  { to: "/letters", label: "Letters" },
  { to: "/letters/new", label: "New Letter" },
  { to: "/print-numbers", label: "Print Numbers" },
  { to: "/subject-officer", label: "Subject Officer" },
];

const SUBJECT_OFFICER_LINKS: NavLink[] = [
  { to: "/letters", label: "Letters" },
  { to: "/letters/new", label: "New Letter" },
  { to: "/officers", label: "Officers" },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { role } = useUserRole();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const links = role === "dcs" ? DCS_LINKS : role === "subjectOfficer" ? SUBJECT_OFFICER_LINKS : [];

  const pendingReview = useQuery({
    ...orpc.letters.pendingReviewCount.queryOptions(),
    enabled: role === "dcs",
  });

  return (
    <div className="flex h-full flex-col">
      <header className="border-b">
        <div className="flex items-center justify-between gap-4 px-4 py-3">
          <Link to="/letters" className="font-semibold">
            DCSP Letter Management
          </Link>
          <UserButton align="end" />
        </div>
        <nav className="flex items-center gap-1 overflow-x-auto px-4 pb-2">
          {links.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground",
                pathname === link.to && "bg-muted text-foreground",
              )}
            >
              {link.label}
              {link.to === "/letters" && role === "dcs" && !!pendingReview.data && (
                <Badge variant="outline">{pendingReview.data}</Badge>
              )}
            </Link>
          ))}
        </nav>
      </header>
      <main className="flex-1 overflow-y-auto p-4">{children}</main>
    </div>
  );
}
