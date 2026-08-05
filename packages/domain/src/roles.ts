import { z } from "zod";

/**
 * DCS, the Subject Officer, and the Administrative Officer log in with a real
 * account (APP_FLOW.md §1). Relevant Officers never get a `user` row — they
 * act only through emailed per-letter links (see `letter-link.ts`).
 *
 * DCS is labelled "Admin" throughout the UI, but the role value stays `dcs`
 * everywhere internally and in the API (APP_FLOW.md §1).
 */
export const USER_ROLES = ["dcs", "subjectOfficer", "administrativeOfficer"] as const;

export type UserRole = (typeof USER_ROLES)[number];

export const userRoleSchema = z.enum(USER_ROLES);

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  dcs: "Admin",
  subjectOfficer: "Subject Officer",
  administrativeOfficer: "Administrative Officer",
};

/**
 * Subject Officer and Administrative Officer are two independent login
 * profiles that both act as "the letter-routing officer" between DCS and the
 * Relevant Officer (APP_FLOW.md §1, §4-§5) — they share the capabilities for
 * *acting on* a letter already routed to them. Two things distinguish them:
 * Relevant Officer roster management (APP_FLOW.md §7), exclusive to Subject
 * Officer (see `rosterProcedure` in `packages/api`); and letter origination
 * (APP_FLOW.md §4, §4a) — Subject Officer can self-originate and skip
 * straight to the Relevant Officer or DCS's review queue, while an
 * Administrative-Officer-originated letter always lands with a Subject
 * Officer first (see `subjectOfficerProcedure` / `administrativeOfficerProcedure`
 * in `packages/api`).
 */
export const OFFICER_ROLES = ["subjectOfficer", "administrativeOfficer"] as const;

export type OfficerRole = (typeof OFFICER_ROLES)[number];

export function isOfficerRole(role: UserRole | null | undefined): role is OfficerRole {
  return role === "subjectOfficer" || role === "administrativeOfficer";
}

/**
 * The floor better-auth itself enforces for every account's password
 * (`packages/auth`) — shared here so DCS's "create Subject Officer" form
 * (a client bundle that can't import the server-only `auth` package) can
 * validate against the same value instead of a guessed one.
 */
export const MIN_PASSWORD_LENGTH = 10;
