import type { createDb } from "@dcsp-letter-management/db";
import { letterLink } from "@dcsp-letter-management/db/schema/letters";
import type { DivisionCode } from "@dcsp-letter-management/domain/division";
import { letterLinkEmailHtml, letterLinkEmailSubject, sendMail } from "@dcsp-letter-management/email";
import { env } from "@dcsp-letter-management/env/server";

import { newId, newToken } from "./ids";

type Db = ReturnType<typeof createDb>;

export type OfficerRole = "subjectOfficer" | "relevantOfficer";

export type LetterLinkTarget = {
  letterId: string;
  role: OfficerRole;
  to: string;
  referenceNumber: string;
  subject: string | null;
  fromWhom: string | null;
  division: DivisionCode;
  reassignment?: { fromOfficerName: string; note: string | null };
};

/** Mints a fresh per-officer link for a letter and emails it (APP_FLOW.md §1, §5). */
export async function issueLetterLink(db: Db, target: LetterLinkTarget) {
  const token = newToken();

  await db.insert(letterLink).values({
    id: newId(),
    token,
    letterId: target.letterId,
    role: target.role,
  });

  const actionUrl = `${env.CORS_ORIGIN}/l/${token}`;
  const emailInput = {
    role: target.role,
    referenceNumber: target.referenceNumber,
    subject: target.subject,
    fromWhom: target.fromWhom,
    division: target.division,
    actionUrl,
    reassignment: target.reassignment,
  };

  await sendMail({
    to: target.to,
    subject: letterLinkEmailSubject(emailInput),
    html: letterLinkEmailHtml(emailInput),
  });

  return token;
}
