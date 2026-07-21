import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AppHeader } from "../components/AppHeader.js";
import { Modal } from "../components/Modal.js";
import { StatusBadge } from "../components/StatusBadge.js";
import { useI18n } from "../i18n/I18nProvider.js";
import { logout } from "../lib/auth.js";
import { DIVISIONS, divisionName } from "../lib/config.js";
import { formatTimestamp } from "../lib/format.js";
import { letters } from "../lib/letters.js";
import type { Letter, Officer, Reassignment } from "../lib/types.js";

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

const COLUMN_KEYS = [
  "letterNumber",
  "subject",
  "sender",
  "subjectOfficer",
  "relevantOfficer",
  "status",
  "actions",
] as const;

// Port of public/dashboard.html + its inline <script> - the DCS "All
// Letters" view: filters, the letters table (view/review actions), a wide
// letter-detail dialog, a review dialog, and the Subject Officer settings
// dialog.
export function Dashboard() {
  const { t, lang } = useI18n();
  const navigate = useNavigate();

  const [rows, setRows] = useState<Letter[]>([]);
  const [search, setSearch] = useState("");
  const [division, setDivision] = useState("");
  const [status, setStatus] = useState("");

  const [subjectOfficer, setSubjectOfficerState] = useState<Officer | null>(null);

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLetter, setDetailLetter] = useState<Letter | null>(null);
  const [detailReassignments, setDetailReassignments] = useState<ReadonlyArray<Reassignment>>([]);

  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewLetter, setReviewLetterState] = useState<Letter | null>(null);
  const [reviewOfficers, setReviewOfficers] = useState<Officer[]>([]);
  const [reviewOfficerId, setReviewOfficerId] = useState("");
  const [reviewStatus, setReviewStatus] = useState("");

  const [soDialogOpen, setSoDialogOpen] = useState(false);
  const [soName, setSoName] = useState("");
  const [soEmail, setSoEmail] = useState("");
  const [soStatus, setSoStatus] = useState("");

  const redirectIfUnauthenticated = useCallback(
    (err: unknown) => {
      if (err instanceof Error && err.message === "Not authenticated") {
        navigate("/");
        return true;
      }
      return false;
    },
    [navigate]
  );

  const loadLetters = useCallback(async () => {
    try {
      const { letters: data } = await letters.list({ search, division, status });
      setRows(data);
    } catch (err) {
      redirectIfUnauthenticated(err);
    }
  }, [search, division, status, redirectIfUnauthenticated]);

  const refreshSubjectOfficer = useCallback(async () => {
    const { officer } = await letters.getSubjectOfficer();
    setSubjectOfficerState(officer);
    return officer;
  }, []);

  useEffect(() => {
    refreshSubjectOfficer();
    loadLetters();
    // Only on mount - the filter form's submit handler re-triggers loadLetters explicitly.
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

  const openDetail = async (id: number) => {
    try {
      const { letter, reassignments } = await letters.get(id);
      setDetailLetter(letter);
      setDetailReassignments(reassignments);
      setDetailOpen(true);
    } catch (err) {
      redirectIfUnauthenticated(err);
    }
  };

  const openReview = async (letter: Letter) => {
    setReviewLetterState(letter);
    setReviewStatus("");
    setReviewOfficerId(letter.relevant_officer_id ? String(letter.relevant_officer_id) : "");
    try {
      const { officers } = await letters.listOfficers(letter.division);
      setReviewOfficers(officers);
      setReviewOpen(true);
    } catch (err) {
      redirectIfUnauthenticated(err);
    }
  };

  const submitReview = async (e: FormEvent) => {
    e.preventDefault();
    if (!reviewOfficerId || !reviewLetter) {
      setReviewStatus(t("relevantOfficerRequiredForReview"));
      return;
    }
    setReviewStatus(t("submitting"));
    try {
      await letters.reviewLetter(reviewLetter.id, { relevantOfficerId: reviewOfficerId });
      setReviewStatus(t("officerAssignedSuccess"));
      setReviewOpen(false);
      await loadLetters();
    } catch (err) {
      setReviewStatus(err instanceof Error ? err.message : String(err));
    }
  };

  const openSubjectOfficerDialog = async () => {
    setSoStatus("");
    const officer = await refreshSubjectOfficer();
    setSoName(officer ? officer.name : "");
    setSoEmail(officer ? officer.email : "");
    setSoDialogOpen(true);
  };

  const submitSubjectOfficer = async (e: FormEvent) => {
    e.preventDefault();
    setSoStatus(t("submitting"));
    try {
      await letters.setSubjectOfficer({ name: soName.trim(), email: soEmail.trim() });
      await refreshSubjectOfficer();
      setSoDialogOpen(false);
      loadLetters();
    } catch (err) {
      setSoStatus(err instanceof Error ? err.message : String(err));
    }
  };

  const officer = (name: string | null, email: string | null) => (name ? `${name}${email ? ` (${email})` : ""}` : "-");

  const pendingCount = rows.filter((l) => l.status === "pending_review").length;

  return (
    <>
      <AppHeader titleKey="dashboardTitle">
        <Link to="/new-letter">{t("newLetter")}</Link>
        <Link to="/print-numbers">{t("printNumbers")}</Link>
        <button type="button" onClick={openSubjectOfficerDialog}>
          {subjectOfficer ? `${t("subjectOfficer")}: ${subjectOfficer.name}` : t("setSubjectOfficer")}
        </button>
        <button type="button" onClick={handleLogout}>
          {t("logout")}
        </button>
      </AppHeader>

      <Modal open={detailOpen} onClose={() => setDetailOpen(false)} wide>
        {detailLetter && (
          <>
            <h2>{detailLetter.letter_number}</h2>
            <dl className="letter-details">
              <dt>{t("letterNumber")}</dt>
              <dd>{detailLetter.letter_number}</dd>
              <dt>{t("division")}</dt>
              <dd>{divisionName(detailLetter.division, lang)}</dd>
              <dt>{t("subject")}</dt>
              <dd>{detailLetter.subject || "-"}</dd>
              <dt>{t("sender")}</dt>
              <dd>{detailLetter.sender_name || "-"}</dd>
              <dt>{t("receivedDate")}</dt>
              <dd>{detailLetter.received_date || "-"}</dd>
              <dt>{t("createdBy")}</dt>
              <dd>{t(detailLetter.created_by_role === "subject_officer" ? "createdBySubjectOfficer" : "createdByDcs")}</dd>
              <dt>{t("subjectOfficer")}</dt>
              <dd>{officer(detailLetter.subject_officer_name, detailLetter.subject_officer_email)}</dd>
              <dt>{t("relevantOfficer")}</dt>
              <dd>{officer(detailLetter.relevant_officer_name, detailLetter.relevant_officer_email)}</dd>
              <dt>{t("status")}</dt>
              <dd>{detailLetter.status}</dd>
              <dt>{t("subjectOfficerReceivedAt")}</dt>
              <dd>{formatTimestamp(detailLetter.subject_officer_received_at, lang) || "-"}</dd>
              <dt>{t("sentToRelevantOfficer")}</dt>
              <dd>{formatTimestamp(detailLetter.sent_to_relevant_at, lang) || "-"}</dd>
              <dt>{t("relevantOfficerReceivedAt")}</dt>
              <dd>{formatTimestamp(detailLetter.relevant_officer_received_at, lang) || "-"}</dd>
              <dt>{t("actionTakenAt")}</dt>
              <dd>{formatTimestamp(detailLetter.action_taken_at, lang) || "-"}</dd>
            </dl>
            <h3>{t("actionTaken")}</h3>
            <p className="action-taken-text">{detailLetter.action_notes || t("noActionYet")}</p>
            {detailReassignments.length > 0 && (
              <>
                <h3>{t("reassignmentHistory")}</h3>
                <ul className="reassign-history">
                  {detailReassignments.map((r) => (
                    <li key={r.id}>
                      {r.from_officer_name} &rarr; {r.to_officer_name}
                      {r.note ? `: ${r.note}` : ""}{" "}
                      <span className="reassign-date">({formatTimestamp(r.reassigned_at, lang)})</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </>
        )}
        <div className="dialog-actions">
          <button type="button" onClick={() => setDetailOpen(false)}>
            {t("close")}
          </button>
        </div>
      </Modal>

      <Modal open={reviewOpen} onClose={() => setReviewOpen(false)}>
        <form onSubmit={submitReview}>
          <h2>{t("reviewDialogTitle")}</h2>
          {reviewLetter && (
            <dl className="letter-details">
              <dt>{t("letterNumber")}</dt>
              <dd>{reviewLetter.letter_number}</dd>
              <dt>{t("subject")}</dt>
              <dd>{reviewLetter.subject || "-"}</dd>
              <dt>{t("sender")}</dt>
              <dd>{reviewLetter.sender_name || "-"}</dd>
            </dl>
          )}

          <label htmlFor="reviewRelevantOfficer">{t("relevantOfficer")}</label>
          <select
            id="reviewRelevantOfficer"
            required
            value={reviewOfficerId}
            onChange={(e) => setReviewOfficerId(e.target.value)}
          >
            <option value="">{t("selectOfficer")}</option>
            {reviewOfficers.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
                {o.designation ? ` (${o.designation})` : ""}
              </option>
            ))}
          </select>

          <div className="dialog-actions">
            <button type="submit">{t("sendToSubjectOfficerBtn")}</button>
            <button type="button" onClick={() => setReviewOpen(false)}>
              {t("cancel")}
            </button>
          </div>
          <p className="status-message" role="status" aria-live="polite">
            {reviewStatus}
          </p>
        </form>
      </Modal>

      <Modal open={soDialogOpen} onClose={() => setSoDialogOpen(false)}>
        <form onSubmit={submitSubjectOfficer}>
          <h2>{t("subjectOfficerSettingsTitle")}</h2>
          <p className="subtitle">{t("subjectOfficerSettingsHint")}</p>

          <label htmlFor="soName">{t("officerName")}</label>
          <input id="soName" type="text" required value={soName} onChange={(e) => setSoName(e.target.value)} />

          <label htmlFor="soEmail">{t("officerEmail")}</label>
          <input id="soEmail" type="email" required value={soEmail} onChange={(e) => setSoEmail(e.target.value)} />

          <div className="dialog-actions">
            <button type="submit">{t("save")}</button>
            <button type="button" onClick={() => setSoDialogOpen(false)}>
              {t("cancel")}
            </button>
          </div>
          <p className="status-message" role="status" aria-live="polite">
            {soStatus}
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
          <select value={division} onChange={(e) => setDivision(e.target.value)}>
            <option value="">{t("allDivisions")}</option>
            {DIVISIONS.map((d) => (
              <option key={d.code} value={d.code}>
                {d.code} - {d.name[lang] || d.name.en}
              </option>
            ))}
          </select>
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
        <p className="status-message" role="status" aria-live="polite">
          {pendingCount ? `${t("pendingReviewQueue")}: ${pendingCount}` : ""}
        </p>

        <div className="table-scroll">
          <table className="letters-table">
            <thead>
              <tr>
                {COLUMN_KEYS.map((key) => (
                  <th key={key}>{t(key)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((l) => (
                <tr key={l.id}>
                  <td data-label={t("letterNumber")}>{l.letter_number}</td>
                  <td data-label={t("subject")}>{l.subject || "-"}</td>
                  <td data-label={t("sender")}>{l.sender_name || "-"}</td>
                  <td data-label={t("subjectOfficer")}>{l.subject_officer_name || "-"}</td>
                  <td data-label={t("relevantOfficer")}>{l.relevant_officer_name || "-"}</td>
                  <td data-label={t("status")}>
                    <StatusBadge status={l.status} />
                  </td>
                  <td data-label={t("actions")}>
                    <button type="button" onClick={() => openDetail(l.id)}>
                      {t("view")}
                    </button>
                    {l.status === "pending_review" && (
                      <button type="button" onClick={() => openReview(l)}>
                        {t("reviewBtn")}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {rows.length === 0 && <p>{t("noLetters")}</p>}
      </main>
    </>
  );
}
