import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AppHeader } from "../components/AppHeader.js";
import { useI18n } from "../i18n/I18nProvider.js";
import { divisionName } from "../lib/config.js";
import { formatTimestamp } from "../lib/format.js";
import { linkGet, linkGetOfficers, linkPost } from "../lib/links.js";
import type { Letter, LinkOfficerRole, Officer, Reassignment } from "../lib/types.js";

// Port of public/js/officer-actions.js, shared by both subject-officer.html
// and relevant-officer.html (both opened only via the unique link emailed
// to that officer, no login) - which action set renders is driven by the
// `role` the server returns for the token, same as the original.
export function OfficerLinkPage({ titleKey }: { titleKey: string }) {
  const { t, lang } = useI18n();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

  const [letter, setLetter] = useState<Letter | null>(null);
  const [role, setRole] = useState<LinkOfficerRole | null>(null);
  const [reassignments, setReassignments] = useState<ReadonlyArray<Reassignment>>([]);
  const [loadError, setLoadError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [actionNotes, setActionNotes] = useState("");
  const [reassignOfficers, setReassignOfficers] = useState<ReadonlyArray<Officer>>([]);
  const [reassignOfficerId, setReassignOfficerId] = useState("");
  const [reassignNote, setReassignNote] = useState("");
  const [reassigned, setReassigned] = useState(false);

  useEffect(() => {
    if (!token) {
      setLoadError(t("missingToken"));
      return;
    }
    linkGet(token)
      .then(({ letter: l, role: r, reassignments: history }) => {
        setLetter(l);
        setRole(r);
        setReassignments(history);
        setActionNotes(l.action_notes || "");
      })
      .catch((err) => setLoadError(err instanceof Error ? err.message : String(err)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const canAct = role === "relevant" && Boolean(letter?.relevant_officer_received_at) && !letter?.action_taken_at;

  useEffect(() => {
    if (!token || !canAct) return;
    linkGetOfficers(token)
      .then(({ officers }) => setReassignOfficers(officers))
      .catch((err) => setStatusMessage(err instanceof Error ? err.message : String(err)));
  }, [token, canAct]);

  const runAction = useCallback(
    async (action: "receive" | "send" | "action" | "reassign", body: Record<string, unknown> | undefined, onOk: (letter: Letter) => void) => {
      if (!token) return;
      try {
        const { letter: updated } = await linkPost(token, action, body);
        setLetter(updated);
        onOk(updated);
      } catch (err) {
        setStatusMessage(err instanceof Error ? err.message : String(err));
      }
    },
    [token]
  );

  const handleReceive = () => runAction("receive", undefined, () => {});

  const handleSend = () =>
    runAction("send", undefined, () => setStatusMessage(t("sentToRelevantSuccess")));

  const handleSubmitAction = () => {
    const notes = actionNotes.trim();
    if (!notes) {
      setStatusMessage(t("actionNotesRequired"));
      return;
    }
    runAction("action", { notes }, () => setStatusMessage(t("actionRecordedSuccess")));
  };

  const handleReassign = () => {
    if (!reassignOfficerId) return;
    runAction(
      "reassign",
      { officerId: Number(reassignOfficerId), note: reassignNote.trim() },
      () => {
        setStatusMessage(t("reassignedSuccess"));
        setReassigned(true);
      }
    );
  };

  if (loadError) {
    return (
      <>
        <AppHeader titleKey={titleKey} />
        <main id="main" className="officer-page">
          {loadError}
        </main>
      </>
    );
  }

  if (!letter || !role) {
    return (
      <>
        <AppHeader titleKey={titleKey} />
        <main id="main" className="officer-page" />
      </>
    );
  }

  const canSend = role === "subject" && Boolean(letter.subject_officer_received_at) && !letter.sent_to_relevant_at;
  const canReceiveRelevant =
    role === "relevant" && Boolean(letter.sent_to_relevant_at) && !letter.relevant_officer_received_at;

  return (
    <>
      <AppHeader titleKey={titleKey} />
      <main id="main" className="officer-page">
        <section className="letter-details-card">
          <dl className="letter-details">
            <dt>{t("letterNumber")}</dt>
            <dd>{letter.letter_number}</dd>
            <dt>{t("subject")}</dt>
            <dd>{letter.subject || "-"}</dd>
            <dt>{t("sender")}</dt>
            <dd>{letter.sender_name || "-"}</dd>
            <dt>{t("status")}</dt>
            <dd>{letter.status}</dd>
          </dl>
          {reassignments.length > 0 && (
            <>
              <h3>{t("reassignmentHistory")}</h3>
              <ul className="reassign-history">
                {reassignments.map((r) => (
                  <li key={r.id}>
                    {r.from_officer_name} &rarr; {r.to_officer_name}
                    {r.note ? `: ${r.note}` : ""}{" "}
                    <span className="reassign-date">({formatTimestamp(r.reassigned_at, lang)})</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        {role === "subject" && (
          <section className="actions-card">
            <button type="button" disabled={Boolean(letter.subject_officer_received_at)} onClick={handleReceive}>
              {t("markReceived")}
            </button>
            <button type="button" disabled={!canSend} onClick={handleSend}>
              {t("sendToRelevant")}
            </button>
            {!letter.subject_officer_received_at && <p className="status-message">{t("markReceivedBeforeSend")}</p>}
          </section>
        )}

        {role === "relevant" && !reassigned && (
          <section className="actions-card">
            <button type="button" disabled={!canReceiveRelevant} onClick={handleReceive}>
              {t("markReceived")}
            </button>
            <textarea
              placeholder={t("actionTakenPlaceholder")}
              disabled={!canAct}
              value={actionNotes}
              onChange={(e) => setActionNotes(e.target.value)}
            />
            <button type="button" disabled={!canAct} onClick={handleSubmitAction}>
              {t("recordAction")}
            </button>
            {!letter.sent_to_relevant_at && <p className="status-message">{t("notForwardedYet")}</p>}
            {letter.sent_to_relevant_at && !letter.relevant_officer_received_at && (
              <p className="status-message">{t("markReceivedBeforeAction")}</p>
            )}
            {canAct && (
              <div className="reassign-block">
                <label htmlFor="reassignOfficer">{t("reassignLabel")}</label>
                <select
                  id="reassignOfficer"
                  value={reassignOfficerId}
                  onChange={(e) => setReassignOfficerId(e.target.value)}
                >
                  <option value="">{t("selectOfficer")}</option>
                  {reassignOfficers.map((o) => {
                    const extra = [o.designation, o.division ? divisionName(o.division, lang) : ""]
                      .filter(Boolean)
                      .join(" - ");
                    return (
                      <option key={o.id} value={o.id}>
                        {o.name}
                        {extra ? ` (${extra})` : ""}
                      </option>
                    );
                  })}
                </select>
                <textarea
                  placeholder={t("reassignNotePlaceholder")}
                  value={reassignNote}
                  onChange={(e) => setReassignNote(e.target.value)}
                />
                <button type="button" onClick={handleReassign}>
                  {t("reassignBtn")}
                </button>
              </div>
            )}
          </section>
        )}

        <p className="status-message" role="status" aria-live="polite">
          {statusMessage}
        </p>
      </main>
    </>
  );
}
