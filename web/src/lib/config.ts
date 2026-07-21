// Typed port of public/js/config.js - shared frontend configuration.

export interface Division {
  readonly code: string;
  readonly name: { readonly en: string; readonly si: string };
}

export const API_BASE = import.meta.env.VITE_API_URL || "/api";

export const DIVISIONS: ReadonlyArray<Division> = [
  { code: "01", name: { en: "Development Division", si: "සංවර්ධන අංශය" } },
  { code: "02", name: { en: "Administration Division", si: "පරිපාලන අංශය" } },
  { code: "03", name: { en: "Account Division", si: "ගිණුම් අංශය" } },
];

export const NUMBERS_PER_PRINT_SHEET = 16;

export const divisionName = (code: string, lang: "en" | "si"): string => {
  const div = DIVISIONS.find((d) => d.code === code);
  return div ? div.name[lang] || div.name.en : code;
};
