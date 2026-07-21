import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

// Port of public/js/i18n.js as a React context - same si/en toggle, same
// localStorage key ('dcs_lang'), same runtime fetch of /locales/{lang}.json
// (not bundled), same fallback-to-key behavior for unknown strings.

export type Lang = "si" | "en";

const STORAGE_KEY = "dcs_lang";

interface I18nContextValue {
  readonly lang: Lang;
  readonly t: (key: string) => string;
  readonly setLang: (lang: Lang) => void;
  readonly toggleLang: () => void;
}

const I18nContext = createContext<I18nContextValue | null>(null);

const readInitialLang = (): Lang => (localStorage.getItem(STORAGE_KEY) === "en" ? "en" : "si");

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(readInitialLang);
  const [strings, setStrings] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    fetch(`/locales/${lang}.json`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setStrings(data);
      });
    document.documentElement.lang = lang;
    return () => {
      cancelled = true;
    };
  }, [lang]);

  const setLang = useCallback((next: Lang) => {
    localStorage.setItem(STORAGE_KEY, next);
    setLangState(next);
  }, []);

  const toggleLang = useCallback(() => {
    setLang(lang === "si" ? "en" : "si");
  }, [lang, setLang]);

  const t = useCallback((key: string) => strings[key] ?? key, [strings]);

  const value = useMemo(() => ({ lang, t, setLang, toggleLang }), [lang, t, setLang, toggleLang]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}
