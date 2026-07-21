import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AppHeader } from "../components/AppHeader.js";
import { Modal } from "../components/Modal.js";
import { StatusBadge } from "../components/StatusBadge.js";
import { useI18n } from "../i18n/I18nProvider.js";
import { logout } from "../lib/auth.js";
import { DIVISIONS } from "../lib/config.js";
import { formatTimestamp } from "../lib/format.js";
import { letters } from "../lib/letters.js";
import type { Letter, Officer } from "../lib/types.js";

const STATUS_OPTIONS = [
  "pending_review",
  "created",
  "sent_to_subject",
  "with_subject_officer",
  "sent_to_relevant",
  "with_relevant_officer",
  "action_taken",
  "closed",
] as const;

// Port of public/subject-officer-dashboard.html - the Subject Officer's own
// "My Letters" view plus the officer roster they maintain.
export function SubjectOfficerDashboard() {
  const { t, lang } = useI18n();
  const navigate = useNavigate();

  const [rows, setRows] = useState<Letter[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [listStatus, setListStatus] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);

  const [officers, setOfficers] = useState<Officer[]>([]);

  const [addOfficerOpen, setAddOfficerOpen] = useState(false);
  const [officerDivision, setOfficerDivision] = useState("");
  const [officerPosition, setOfficerPosition] = useState("");
  const [officerName, setOfficerName] = useState("");
  const [officerEmail, setOfficerEmail] = useState("");
  const [officerFormStatus, setOfficerFormStatus] = useState("");

  const redirectIfUnauthenticated = useCallback(
    (err: unknown) => {
      if (err instanceof Error && (err.message === "Not authenticated" || err.message === "Forbidden")) {
        navigate("/");
        return true;
      }
      return false;
    },
    [navigate]
  );

  const loadLetters = useCallback(async () => {
    try {
      const { letters: data } = await letters.subjectOfficerLetters({ search, status });
      setRows(data);
    } catch (err) {
      if (!redirectIfUnauthenticated(err)) setListStatus(err instanceof Error ? err.message : String(err));
    }
  }, [search, status, redirectIfUnauthenticated]);

  const loadOfficers = useCallback(async () => {
    try {
      const { officers: data } = await letters.subjectOfficerListOfficers();
      setOfficers(data);
    } catch (err) {
      redirectIfUnauthenticated(err);
    }
  }, [redirectIfUnauthenticated]);

  useEffect(() => {
    loadLetters();
    loadOfficers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFilterSubmit = (e: FormEvent) => {
    e.preventDefault();
    loadLetters();
  };

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  const handleReceive = async (id: number) => {
    setBusyId(id);
    try {
      await letters.subjectOfficerReceive(id);
      setListStatus("");
      await loadLetters();
    } catch (err) {
      setListStatus(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyId(null);
    }
  };

  const handleSend = async (id: number) => {
    setBusyId(id);
    try {
      await letters.subjectOfficerSend(id);
      setListStatus("");
      await loadLetters();
    } catch (err) {
      setListStatus(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyId(null);
    }
  };

  const handleRemoveOfficer = async (id: number) => {
    if (!window.confirm(t("confirmRemoveOfficer"))) return;
    try {
      await letters.subjectOfficerRemoveOfficer(id);
      setListStatus(t("officerRemovedSuccess"));
      await loadOfficers();
    } catch (err) {
      setListStatus(err instanceof Error ? err.message : String(err));
    }
  };

  const openAddOfficer = () => {
    setOfficerDivision("");
    setOfficerPosition("");
    setOfficerName("");
    setOfficerEmail("");
    setOfficerFormStatus("");
    setAddOfficerOpen(true);
  };

  const submitAddOfficer = async (e: FormEvent) => {
    e.preventDefault();
    setOfficerFormStatus(t("submitting"));
    try {
      await letters.subjectOfficerCreateOfficer({
        name: officerName.trim(),
        email: officerEmail.trim(),
        designation: officerPosition.trim(),
        division: officerDivision,
      });
      setOfficerFormStatus(t("officerCreatedSuccess"));
      setAddOfficerOpen(false);
      await loadOfficers();
    } catch (err) {
      setOfficerFormStatus(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <>
      <AppHeader titleKey="subjectOfficerDashboardTitle">
        <Link to="/subject-officer-new-letter">{t("newLetter")}</Link>
        <button type="button" onClick={openAddOfficer}>
          {t("addOfficerTitle")}
        </button>
        <button type="button" onClick={handleLogout}>
          {t("logout")}
        </button>
      </AppHeader>

      <Modal open={addOfficerOpen} onClose={() => setAddOfficerOpen(false)}>
        <form onSubmit={submitAddOfficer}>
          <h2>{t("addOfficerTitle")}</h2>

          <label htmlFor="officerDivision">{t("division")}</label>
          <select id="officerDivision" value={officerDivision} onChange={(e) => setOfficerDivision(e.target.value)}>
            <option value="">{t("selectDivision")}</option>
            {DIVISIONS.map((d) => (
              <option key={d.code} value={d.code}>
                {d.code} - {d.name[lang] || d.name.en}
              </option>
            ))}
          </select>

          <label htmlFor="officerPosition">{t("position")}</label>
          <input
            type="text"
            id="officerPosition"
            value={officerPosition}
            onChange={(e) => setOfficerPosition(e.target.value)}
          />

          <label htmlFor="officerNameInput">{t("officerName")}</label>
          <input
            type="text"
            id="officerNameInput"
            required
            value={officerName}
            onChange={(e) => setOfficerName(e.target.value)}
          />

          <label htmlFor="officerEmailInput">{t("officerEmail")}</label>
          <input
            type="email"
            id="officerEmailInput"
            required
            value={officerEmail}
            onChange={(e) => setOfficerEmail(e.target.value)}
          />

          <div className="dialog-actions">
            <button type="submit">{t("addOfficerBtn")}</button>
            <button type="button" onClick={() => setAddOfficerOpen(false)}>
              {t("cancel")}
            </button>
          </div>
          <p className="status-message" role="status" aria-live="polite">
            {officerFormStatus}
          </p>
        </form>
      </Modal>

      <main id="main">
        <form className="filter-bar" onSubmit={handleFilterSubmit}>
          <input
            type="text"
            placeholder={t("searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">{t("allStatuses")}</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <button type="submit">{t("filter")}</button>
        </form>

        <div className="table-scroll">
          <table className="letters-table">
            <thead>
              <tr>
                <th>{t("letterNumber")}</th>
                <th>{t("subject")}</th>
                <th>{t("sender")}</th>
                <th>{t("relevantOfficer")}</th>
                <th>{t("status")}</th>
                <th>{t("received")}</th>
                <th>{t("sentToRelevantOfficer")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((l) => {
                const receivedAt = formatTimestamp(l.subject_officer_received_at, lang);
                const sentAt = formatTimestamp(l.sent_to_relevant_at, lang);
                return (
                  <tr key={l.id}>
                    <td data-label={t("letterNumber")}>{l.letter_number}</td>
                    <td data-label={t("subject")}>{l.subject || "-"}</td>
                    <td data-label={t("sender")}>{l.sender_name || "-"}</td>
                    <td data-label={t("relevantOfficer")}>{l.relevant_officer_name || "-"}</td>
                    <td data-label={t("status")}>
                      <StatusBadge status={l.status} />
                    </td>
                    <td data-label={t("received")}>
                      {receivedAt ? (
                        receivedAt
                      ) : l.status === "pending_review" ? (
                        <span className="pending-note">{t("awaitingAdminReview")}</span>
                      ) : (
                        <button type="button" disabled={busyId === l.id} onClick={() => handleReceive(l.id)}>
                          {t("markReceived")}
                        </button>
                      )}
                    </td>
                    <td data-label={t("sentToRelevantOfficer")}>
                      {sentAt ? (
                        sentAt
                      ) : receivedAt ? (
                        <button type="button" disabled={busyId === l.id} onClick={() => handleSend(l.id)}>
                          {t("sendToRelevant")}
                        </button>
                      ) : (
                        "-"
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {rows.length === 0 && <p>{t("noLetters")}</p>}
        <p className="status-message" role="status" aria-live="polite">
          {listStatus}
        </p>

        <section aria-labelledby="officersListHeading">
          <h2 id="officersListHeading">{t("officersListTitle")}</h2>
          <div className="table-scroll">
            <table className="letters-table">
              <thead>
                <tr>
                  <th>{t("officerName")}</th>
                  <th>{t("officerEmail")}</th>
                  <th>{t("position")}</th>
                  <th>{t("division")}</th>
                  <th>{t("actions")}</th>
                </tr>
              </thead>
              <tbody>
                {officers.map((o) => (
                  <tr key={o.id}>
                    <td data-label={t("officerName")}>{o.name}</td>
                    <td data-label={t("officerEmail")}>{o.email}</td>
                    <td data-label={t("position")}>{o.designation || "-"}</td>
                    <td data-label={t("division")}>{o.division || "-"}</td>
                    <td data-label={t("actions")}>
                      <button type="button" onClick={() => handleRemoveOfficer(o.id)}>
                        {t("remove")}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {officers.length === 0 && <p>{t("noOfficers")}</p>}
        </section>
      </main>
    </>
  );
}
