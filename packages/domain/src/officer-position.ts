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
