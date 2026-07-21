import { useI18n } from "../i18n/I18nProvider.js";

// Port of the `[data-lang-toggle]` button on every page - label is
// hardcoded bilingual text in the original markup, not translated itself.
export function LangToggle() {
  const { toggleLang } = useI18n();
  return (
    <button className="lang-toggle" type="button" onClick={toggleLang}>
      සිංහල / English
    </button>
  );
}
