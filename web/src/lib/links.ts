import { API_BASE } from "./config.ts";
import type { LinkOfficerRole, Letter, Officer, Reassignment } from "./types.ts";

// Typed port of the fetch helpers inside public/js/officer-actions.js -
// used only by the token-authenticated subject-officer/relevant-officer
// link pages (no cookie session, no window.api credentials needed).

export interface LinkGetResponse {
  readonly letter: Letter;
  readonly role: LinkOfficerRole;
  readonly reassignments: ReadonlyArray<Reassignment>;
}

export const linkGet = async (token: string): Promise<LinkGetResponse> => {
  const res = await fetch(`${API_BASE}/links/${token}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error);
  return data;
};

export const linkPost = async (
  token: string,
  action: "receive" | "send" | "action" | "reassign",
  body?: Record<string, unknown>
): Promise<{ letter: Letter }> => {
  const res = await fetch(`${API_BASE}/links/${token}/${action}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body || {}),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error);
  return data;
};

export const linkGetOfficers = async (token: string): Promise<{ officers: ReadonlyArray<Officer> }> => {
  const res = await fetch(`${API_BASE}/links/${token}/officers`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error);
  return data;
};
