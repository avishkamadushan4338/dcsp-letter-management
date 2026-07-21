import crypto from "node:crypto";
import type { SessionPayload, SessionRole } from "../domain/types.ts";

// Minimal cookie-session login, shared by two roles: 'dcs' (DCS staff
// dashboard/new-letter pages) and 'subject_officer' (the Subject Officer's
// own multi-letter dashboard). Direct port of server/middleware/auth.js -
// same HMAC-SHA256 base64url `body.sig` cookie, same 12h TTL.
//
// NOTE: single shared username/password per role from env config, same as
// before - swap for a real users table + hashed passwords before production
// use (unchanged limitation, not introduced by this port).

export const COOKIE_NAME = "dcs_session";
export const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

export const sign = (secret: string, payload: SessionPayload): string => {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${sig}`;
};

export const verify = (secret: string, cookieValue: string | undefined): SessionPayload | null => {
  if (!cookieValue || !cookieValue.includes(".")) return null;
  const [body, sig] = cookieValue.split(".");
  if (!body || !sig) return null;
  const expectedSig = crypto.createHmac("sha256", secret).update(body).digest("base64url");

  const a = Buffer.from(sig);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as SessionPayload;
  if (Date.now() > payload.exp) return null;
  return payload;
};

export interface Credentials {
  readonly dcsUsername: string;
  readonly dcsPassword: string;
  readonly subjectOfficerUsername: string;
  readonly subjectOfficerPassword: string;
}

export const resolveRole = (
  username: string,
  password: string,
  creds: Credentials
): SessionRole | null => {
  if (username === creds.dcsUsername && password === creds.dcsPassword) return "dcs";
  if (username === creds.subjectOfficerUsername && password === creds.subjectOfficerPassword) {
    return "subject_officer";
  }
  return null;
};
