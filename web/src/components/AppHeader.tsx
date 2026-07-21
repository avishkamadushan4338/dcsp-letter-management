import type { ReactNode } from "react";
import { useI18n } from "../i18n/I18nProvider.js";
import { LangToggle } from "./LangToggle.js";

interface AppHeaderProps {
  readonly titleKey: string;
  readonly children?: ReactNode;
}

// Shared shape of every page's header: skip-link + sticky app-header with an
// <h1> and a <nav> - page-specific links/buttons are passed as children,
// LangToggle is always last (matches every *.html page in the old system).
export function AppHeader({ titleKey, children }: AppHeaderProps) {
  const { t } = useI18n();
  return (
    <>
      <a className="skip-link" href="#main">
        {t("skipToContent")}
      </a>
      <header className="app-header">
        <h1>{t(titleKey)}</h1>
        <nav>
          {children}
          <LangToggle />
        </nav>
      </header>
    </>
  );
}
