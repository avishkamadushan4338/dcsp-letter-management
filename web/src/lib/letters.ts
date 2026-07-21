import { api } from "./api.ts";
import type { Letter, Officer, Reassignment } from "./types.ts";

const toQuery = (params: object): string => {
  const entries = Object.entries(params).filter((entry): entry is [string, string] => Boolean(entry[1]));
  const query = new URLSearchParams(entries).toString();
  return query ? `?${query}` : "";
};

export interface CreateLetterPayload {
  readonly letterNumber?: string;
  readonly division: string;
  readonly subject?: string;
  readonly senderName?: string;
  readonly receivedDate?: string;
  readonly relevantOfficerId: number | string;
}

export interface ListLettersParams {
  readonly search?: string;
  readonly division?: string;
  readonly status?: string;
}

export interface ReviewLetterPayload {
  readonly relevantOfficerId: number | string;
}

export interface SetSubjectOfficerPayload {
  readonly name: string;
  readonly email: string;
}

export interface SubjectOfficerCreateLetterPayload {
  readonly division: string;
  readonly subject?: string;
  readonly senderName?: string;
  readonly receivedDate?: string;
  readonly relevantOfficerId: number | string | null;
  readonly routing: "direct" | "via_admin";
}

export interface CreateOfficerPayload {
  readonly name: string;
  readonly email: string;
  readonly designation?: string;
  readonly division?: string;
}

// Typed port of public/js/letters.js - used by dashboard, new-letter,
// subject-officer-dashboard, and subject-officer-new-letter.
export const letters = {
  create: (payload: CreateLetterPayload) => api.post<{ letter: Letter }>("/letters", payload),

  list: (params: ListLettersParams = {}) => api.get<{ letters: Letter[] }>(`/letters${toQuery(params)}`),

  get: (id: number | string) => api.get<{ letter: Letter; reassignments: Reassignment[] }>(`/letters/${id}`),

  // DCS reviews a letter the Subject Officer submitted, assigns the
  // Relevant Officer, and routes it back to them.
  reviewLetter: (id: number | string, payload: ReviewLetterPayload) =>
    api.post<{ letter: Letter }>(`/letters/${id}/review`, payload),

  listOfficers: (division?: string) =>
    api.get<{ officers: Officer[] }>(`/officers${division ? `?division=${encodeURIComponent(division)}` : ""}`),

  getSubjectOfficer: () => api.get<{ officer: Officer | null }>("/officers/subject-officer"),

  setSubjectOfficer: (payload: SetSubjectOfficerPayload) =>
    api.put<{ officer: Officer }>("/officers/subject-officer", payload),

  issueNumbers: (division: string, count = 1) => api.post<{ numbers: string[] }>("/numbers/issue", { division, count }),

  // Subject Officer's own dashboard (cookie-session login, not the
  // per-letter emailed link used by lib/links.ts).
  subjectOfficerLetters: (params: ListLettersParams = {}) =>
    api.get<{ letters: Letter[] }>(`/subject-officer/letters${toQuery(params)}`),

  subjectOfficerReceive: (id: number | string) => api.post<{ letter: Letter }>(`/subject-officer/letters/${id}/receive`),

  subjectOfficerSend: (id: number | string) => api.post<{ letter: Letter }>(`/subject-officer/letters/${id}/send`),

  subjectOfficerCreate: (payload: SubjectOfficerCreateLetterPayload) =>
    api.post<{ letter: Letter }>("/subject-officer/letters", payload),

  subjectOfficerListOfficers: (division?: string) =>
    api.get<{ officers: Officer[] }>(
      `/subject-officer/officers${division ? `?division=${encodeURIComponent(division)}` : ""}`
    ),

  subjectOfficerCreateOfficer: (payload: CreateOfficerPayload) =>
    api.post<{ officer: Officer }>("/subject-officer/officers", payload),

  subjectOfficerRemoveOfficer: (id: number | string) => api.delete<{ ok: true }>(`/subject-officer/officers/${id}`),
};
