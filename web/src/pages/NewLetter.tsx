import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import { AppHeader } from "../components/AppHeader.js";
import { useI18n } from "../i18n/I18nProvider.js";
import { DIVISIONS } from "../lib/config.js";
import { letters } from "../lib/letters.js";
import type { Officer } from "../lib/types.js";

const todayISO = (): string => {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

// Port of public/new-letter.html + public/js/new-letter.js - DCS enters the
// letter, generates its number, assigns a subject + relevant officer, and
// triggers both emails.
export function NewLetter() {
  const { t, lang } = useI18n();

  const [division, setDivision] = useState("");
  const [subject, setSubject] = useState("");
  const [senderName, setSenderName] = useState("");
  const [receivedDate, setReceivedDate] = useState(todayISO);
  const [relevantOfficerId, setRelevantOfficerId] = useState("");
  const [officers, setOfficers] = useState<Officer[]>([]);
  const [issuedNumber, setIssuedNumber] = useState<string | null>(null);
  const [subjectOfficer, setSubjectOfficer] = useState<Officer | null>(null);
  const [subjectOfficerLoaded, setSubjectOfficerLoaded] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => {
    letters.getSubjectOfficer().then(({ officer }) => {
      setSubjectOfficer(officer);
      setSubjectOfficerLoaded(true);
    });
  }, []);

  useEffect(() => {
    letters.listOfficers(division || undefined).then(({ officers: data }) => {
      setOfficers(data);
      setRelevantOfficerId(data[0] ? String(data[0].id) : "");
    });
  }, [division]);

  // The reference number is unique/atomic per division on the server
  // (numberService.issueNext reserves it immediately), so it's issued and
  // shown as soon as a division is picked rather than via a manual button.
  useEffect(() => {
    if (!division) {
      setIssuedNumber(null);
      return;
    }
    let cancelled = false;
    letters
      .issueNumbers(division, 1)
      .then(({ numbers }) => {
        if (!cancelled) setIssuedNumber(numbers[0] ?? null);
      })
      .catch((err) => {
        if (!cancelled) setStatus(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
    };
  }, [division]);

  const subjectOfficerConfigured = Boolean(subjectOfficer);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!issuedNumber) {
      setStatus(t("selectDivisionFirst"));
      return;
    }
    if (!subjectOfficerConfigured) {
      setStatus(t("subjectOfficerNotConfigured"));
      return;
    }

    setStatus(t("submitting"));
    try {
      await letters.create({
        letterNumber: issuedNumber,
        division,
        subject,
        senderName,
        receivedDate,
        relevantOfficerId,
      });
      setStatus(t("letterCreatedSuccess"));
      setDivision("");
      setSubject("");
      setSenderName("");
      setReceivedDate(todayISO());
      setIssuedNumber(null);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <>
      <AppHeader titleKey="newLetterTitle">
        <Link to="/dashboard">{t("backToDashboard")}</Link>
      </AppHeader>

      <main id="main">
        <form className="letter-form" onSubmit={handleSubmit}>
          <label htmlFor="division">{t("division")}</label>
          <select id="division" required value={division} onChange={(e) => setDivision(e.target.value)}>
            <option value="">{t("selectDivision")}</option>
            {DIVISIONS.map((d) => (
              <option key={d.code} value={d.code}>
                {d.code} - {d.name[lang] || d.name.en}
              </option>
            ))}
          </select>

          <label>{t("letterNumber")}</label>
          <p className="letter-number-display">{issuedNumber || "-"}</p>

          <label htmlFor="subject">{t("subject")}</label>
          <input type="text" id="subject" value={subject} onChange={(e) => setSubject(e.target.value)} />

          <label htmlFor="senderName">{t("sender")}</label>
          <input type="text" id="senderName" value={senderName} onChange={(e) => setSenderName(e.target.value)} />

          <label htmlFor="receivedDate">{t("receivedDate")}</label>
          <input
            type="date"
            id="receivedDate"
            value={receivedDate}
            onChange={(e) => setReceivedDate(e.target.value)}
          />

          <label>{t("subjectOfficer")}</label>
          <p className="subject-officer-display">
            {subjectOfficerLoaded
              ? subjectOfficer
                ? `${subjectOfficer.name} (${subjectOfficer.email})`
                : t("subjectOfficerNotConfigured")
              : "-"}
          </p>

          <label htmlFor="relevantOfficer">{t("relevantOfficer")}</label>
          <select
            id="relevantOfficer"
            required
            value={relevantOfficerId}
            onChange={(e) => setRelevantOfficerId(e.target.value)}
          >
            {officers.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name} ({o.designation || o.division || ""})
              </option>
            ))}
          </select>

          <button type="submit" disabled={subjectOfficerLoaded && !subjectOfficerConfigured}>
            {t("submitLetter")}
          </button>
          <p className="status-message" role="status" aria-live="polite">
            {status}
          </p>
        </form>
      </main>
    </>
  );
}
