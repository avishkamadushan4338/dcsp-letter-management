import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import { AppHeader } from "../components/AppHeader.js";
import { useI18n } from "../i18n/I18nProvider.js";
import { DIVISIONS } from "../lib/config.js";
import { letters } from "../lib/letters.js";
import type { Officer } from "../lib/types.js";

type Routing = "direct" | "via_admin";

const todayISO = (): string => {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

// Port of public/subject-officer-new-letter.html + js/subject-officer-new-letter.js
// - the Subject Officer originates a letter themselves and picks how it's
// routed: straight to a Relevant Officer, or via DCS for review first.
export function SubjectOfficerNewLetter() {
  const { t, lang } = useI18n();

  const [division, setDivision] = useState("");
  const [subject, setSubject] = useState("");
  const [senderName, setSenderName] = useState("");
  const [receivedDate, setReceivedDate] = useState(todayISO);
  const [routing, setRouting] = useState<Routing>("direct");
  const [officers, setOfficers] = useState<Officer[]>([]);
  const [relevantOfficerId, setRelevantOfficerId] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    letters.subjectOfficerListOfficers(division || undefined).then(({ officers: data }) => {
      setOfficers(data);
      setRelevantOfficerId("");
    });
  }, [division]);

  const isDirect = routing === "direct";

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!division) {
      setStatus(t("selectDivisionFirst"));
      return;
    }
    if (isDirect && !relevantOfficerId) {
      setStatus(t("relevantOfficerRequiredForDirect"));
      return;
    }

    setStatus(t("submitting"));
    try {
      await letters.subjectOfficerCreate({
        division,
        subject,
        senderName,
        receivedDate,
        relevantOfficerId: relevantOfficerId || null,
        routing,
      });
      setStatus(t(routing === "direct" ? "letterSentDirectSuccess" : "letterRoutedToAdminSuccess"));
      setDivision("");
      setSubject("");
      setSenderName("");
      setReceivedDate(todayISO());
      setRouting("direct");
      setRelevantOfficerId("");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <>
      <AppHeader titleKey="newLetterTitle">
        <Link to="/subject-officer-dashboard">{t("backToDashboard")}</Link>
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

          <fieldset className="radio-group">
            <legend>{t("routingLabel")}</legend>
            <label className="radio-option">
              <input
                type="radio"
                name="routing"
                value="direct"
                checked={routing === "direct"}
                onChange={() => setRouting("direct")}
              />
              <span>{t("routeDirect")}</span>
            </label>
            <label className="radio-option">
              <input
                type="radio"
                name="routing"
                value="via_admin"
                checked={routing === "via_admin"}
                onChange={() => setRouting("via_admin")}
              />
              <span>{t("routeViaAdmin")}</span>
            </label>
          </fieldset>

          <label htmlFor="relevantOfficer">{t("relevantOfficer")}</label>
          <select
            id="relevantOfficer"
            required={isDirect}
            value={relevantOfficerId}
            onChange={(e) => setRelevantOfficerId(e.target.value)}
          >
            <option value="">{isDirect ? t("selectOfficer") : t("adminWillAssignOfficer")}</option>
            {officers.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name} ({o.designation || o.division || ""})
              </option>
            ))}
          </select>

          <button type="submit">{t("submitLetter")}</button>
          <p className="status-message" role="status" aria-live="polite">
            {status}
          </p>
        </form>
      </main>
    </>
  );
}
