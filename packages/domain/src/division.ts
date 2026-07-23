import { z } from "zod";

/** The exactly-three divisions in the system (APP_FLOW.md §3.1). */
export const DIVISIONS = [
  { code: "01", name: "Development Division" },
  { code: "02", name: "Administration Division" },
  { code: "03", name: "Account Division" },
] as const;

export const DIVISION_CODES = DIVISIONS.map((division) => division.code) as [
  (typeof DIVISIONS)[number]["code"],
  ...(typeof DIVISIONS)[number]["code"][],
];

export type DivisionCode = (typeof DIVISIONS)[number]["code"];

export const divisionCodeSchema = z.enum(DIVISION_CODES);

export const DIVISION_NAMES: Record<DivisionCode, string> = Object.fromEntries(
  DIVISIONS.map((division) => [division.code, division.name]),
) as Record<DivisionCode, string>;

export const LETTER_NUMBER_MIN = 1;
export const LETTER_NUMBER_MAX = 999999;
export const LETTER_NUMBER_PAD = 6;

/** Builds `DCSP/<000001-999999>` — one counter shared across all divisions (APP_FLOW.md §3.1). */
export function formatReferenceNumber(number: number): string {
  return `DCSP/${String(number).padStart(LETTER_NUMBER_PAD, "0")}`;
}
