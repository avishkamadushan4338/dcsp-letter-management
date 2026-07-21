import type { Lang } from "../i18n/I18nProvider.ts";

// Port of the repeated `formatTimestamp` helper in dashboard.html,
// subject-officer-dashboard.html, and officer-actions.js - MySQL returns
// DATETIME as "YYYY-MM-DD HH:MM:SS" (dateStrings: true), so " " is swapped
// for "T" to get a parseable ISO-ish string.
export const formatTimestamp = (value: string | null | undefined, lang: Lang): string | null => {
  if (!value) return null;
  const d = new Date(String(value).replace(" ", "T"));
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString(lang === "si" ? "si-LK" : "en-LK");
};
