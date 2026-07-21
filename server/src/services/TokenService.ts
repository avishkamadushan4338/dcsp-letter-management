import crypto from "node:crypto";
import type { LinkOfficerRole, LinkTokenPayload } from "../domain/types.ts";

// Direct port of server/services/tokenService.js - same HMAC-SHA256
// base64url `body.hmac` token signing {letterId, role, exp}.

const base64url = (input: string) => Buffer.from(input).toString("base64url");

export const sign = (secret: string, payload: unknown): string => {
  const body = base64url(JSON.stringify(payload));
  const hmac = crypto.createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${hmac}`;
};

// Returns the decoded payload, or null if the signature is invalid,
// malformed, or the embedded expiry has passed.
export const verify = (secret: string, token: string): LinkTokenPayload | null => {
  if (typeof token !== "string" || !token.includes(".")) return null;

  const [body, hmac] = token.split(".");
  if (!body || !hmac) return null;
  const expectedHmac = crypto.createHmac("sha256", secret).update(body).digest("base64url");

  const a = Buffer.from(hmac);
  const b = Buffer.from(expectedHmac);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  let payload: LinkTokenPayload;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return null;
  }

  if (!payload.exp || Date.now() > payload.exp) return null;
  return payload;
};

export const createLetterLinkToken = (
  secret: string,
  letterId: number,
  role: LinkOfficerRole,
  expiryHours: number
): { token: string; expiresAt: Date } => {
  const exp = Date.now() + expiryHours * 60 * 60 * 1000;
  const token = sign(secret, { letterId, role, exp });
  return { token, expiresAt: new Date(exp) };
};
