import { z } from "zod";

/**
 * Only DCS and the Subject Officer log in with a real account (APP_FLOW.md
 * §1). Relevant Officers never get a `user` row — they act only through
 * emailed per-letter links (see `letter-link.ts`).
 *
 * DCS is labelled "Admin" throughout the UI, but the role value stays `dcs`
 * everywhere internally and in the API (APP_FLOW.md §1).
 */
export const USER_ROLES = ["dcs", "subjectOfficer"] as const;

export type UserRole = (typeof USER_ROLES)[number];

export const userRoleSchema = z.enum(USER_ROLES);

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  dcs: "Admin",
  subjectOfficer: "Subject Officer",
};
