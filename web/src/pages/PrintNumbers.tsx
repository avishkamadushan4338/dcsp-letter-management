import { useState } from "react";
import { Link } from "react-router-dom";
import { AppHeader } from "../components/AppHeader.js";
import { useI18n } from "../i18n/I18nProvider.js";
import { DIVISIONS, divisionName } from "../lib/config.js";
import { letters } from "../lib/letters.js";
import type { Letter } from "../lib/types.js";
import "../styles/print.css";

const isToday = (value: string | null): boolean => {
  if (!value) return false;
  const d = new Date(String(value).replace(" ", "T"));
  const today = new Date();
  return (
    d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() && d.getDate() === today.getDate()
  );
};

// Port of public/print-numbers.html + public/js/print.js - lists every
// letter created *today* as "letter number - division - relevant officer",
// one per row, 16 rows per printed page (see styles/print.css).
export function PrintNumbers() {
  const { t, lang } = useI18n();
  const [division, setDivision] = useState("");
  const [todaysLetters, setTodaysLetters] = useState<Letter[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");

  const handleGenerate = async () => {
    setLoading(true);
    setStatus("");
    setTodaysLetters(null);
    try {
      const { letters: data } = await letters.list({ division });
      const filtered = data.filter((l) => isToday(l.created_at));
      setTodaysLetters(filtered);
      setStatus(filtered.length === 0 ? t("noLetters") : "");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => window.print();

  return (
    <>
      <div className="no-print">
        <AppHeader titleKey="printNumbersTitle">
          <Link to="/dashboard">{t("backToDashboard")}</Link>
        </AppHeader>

        <main id="main">
          <form className="filter-bar" onSubmit={(e) => e.preventDefault()}>
            <select value={division} onChange={(e) => setDivision(e.target.value)}>
              <option value="">{t("allDivisions")}</option>
              {DIVISIONS.map((d) => (
                <option key={d.code} value={d.code}>
                  {d.code} - {d.name[lang] || d.name.en}
                </option>
              ))}
            </select>
            <button type="button" disabled={loading} onClick={handleGenerate}>
              {t("generateSheet")}
            </button>
            <button type="button" disabled={!todaysLetters || todaysLetters.length === 0} onClick={handlePrint}>
              {t("printSheet")}
            </button>
          </form>
          <p className="status-message" role="status" aria-live="polite">
            {status}
          </p>
        </main>
      </div>

      <div className="number-sheet">
        {(todaysLetters || []).map((l) => (
          <div className="number-cell" key={l.id}>
            {l.letter_number} - {divisionName(l.division, lang)} - {l.relevant_officer_name || "-"}
          </div>
        ))}
      </div>
    </>
  );
}
