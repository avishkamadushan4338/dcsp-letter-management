import { z } from "zod";

/** The fixed set of positions selectable when adding a Relevant Officer. */
export const OFFICER_POSITIONS = [
  "Development Officer",
  "Management Service Officer",
  "Chief Management Service Officer",
  "Intern",
  "Director",
  "Deputy Director",
] as const;

export type OfficerPosition = (typeof OFFICER_POSITIONS)[number];

export const officerPositionSchema = z.enum(OFFICER_POSITIONS);

/**
 * These positions can act on a letter (receive it, record what was done) but
 * aren't allowed to hand it off to a different officer — only Director and
 * Deputy Director may reassign.
 */
export const REASSIGNMENT_RESTRICTED_POSITIONS: readonly string[] = [
  "Development Officer",
  "Intern",
  "Management Service Officer",
  "Chief Management Service Officer",
] satisfies OfficerPosition[];

export function canReassignLetters(position: string): boolean {
  return !REASSIGNMENT_RESTRICTED_POSITIONS.includes(position);
}
