// Shared by subject-officer.html and relevant-officer.html, both of which
// are opened only via the unique link emailed to that officer (no login).
document.addEventListener('DOMContentLoaded', async () => {
  const token = new URLSearchParams(window.location.search).get('token');
  const detailsEl = document.getElementById('letterDetails');
  const actionsEl = document.getElementById('actions');
  const statusEl = document.getElementById('formStatus');

  if (!token) {
    detailsEl.textContent = window.i18n.t('missingToken');
    return;
  }

  async function linkGet() {
    const res = await fetch(`${window.APP_CONFIG.API_BASE}/links/${token}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  }

  async function linkPost(action, body) {
    const res = await fetch(`${window.APP_CONFIG.API_BASE}/links/${token}/${action}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {}),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  }

  async function linkGetOfficers() {
    const res = await fetch(`${window.APP_CONFIG.API_BASE}/links/${token}/officers`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  }

  function formatTimestamp(value) {
    if (!value) return '';
    const d = new Date(String(value).replace(' ', 'T'));
    return Number.isNaN(d.getTime())
      ? value
      : d.toLocaleString(window.i18n.currentLang() === 'si' ? 'si-LK' : 'en-LK');
  }

  // Kept across re-renders (receive/send/action don't change who reassigned
  // this letter) so the trail stays visible without a re-fetch each time.
  let reassignmentsCache = [];

  function renderLetter(letter, reassignments) {
    if (reassignments) reassignmentsCache = reassignments;
    const history = reassignmentsCache
      .map(
        (r) =>
          `<li>${r.from_officer_name} &rarr; ${r.to_officer_name}${r.note ? `: ${r.note}` : ''} <span class="reassign-date">(${formatTimestamp(r.reassigned_at)})</span></li>`
      )
      .join('');
    detailsEl.innerHTML = `
      <dl class="letter-details">
        <dt data-i18n="letterNumber">Letter No.</dt><dd>${letter.letter_number}</dd>
        <dt data-i18n="subject">Subject</dt><dd>${letter.subject || '-'}</dd>
        <dt data-i18n="sender">Sender</dt><dd>${letter.sender_name || '-'}</dd>
        <dt data-i18n="status">Status</dt><dd>${letter.status}</dd>
      </dl>
      ${history
        ? `<h3 data-i18n="reassignmentHistory">Reassignment History</h3><ul class="reassign-history">${history}</ul>`
        : ''}
    `;
  }

  function renderSubjectActions(letter) {
    const canSend = letter.subject_officer_received_at && !letter.sent_to_relevant_at;
    actionsEl.innerHTML = `
      <button id="receiveBtn" ${letter.subject_officer_received_at ? 'disabled' : ''}
        data-i18n="markReceived">Mark Received</button>
      <button id="sendBtn" ${canSend ? '' : 'disabled'}
        data-i18n="sendToRelevant">Send to Relevant Officer</button>
      ${!letter.subject_officer_received_at
        ? `<p class="status-message" data-i18n="markReceivedBeforeSend">Mark the letter as received before forwarding it.</p>`
        : ''}
    `;
    document.getElementById('receiveBtn').addEventListener('click', async () => {
      try {
        const { letter: updated } = await linkPost('receive');
        renderLetter(updated);
        renderSubjectActions(updated);
      } catch (err) {
        statusEl.textContent = err.message;
      }
    });
    document.getElementById('sendBtn').addEventListener('click', async () => {
      try {
        const { letter: updated } = await linkPost('send');
        renderLetter(updated);
        renderSubjectActions(updated);
        statusEl.textContent = window.i18n.t('sentToRelevantSuccess');
      } catch (err) {
        statusEl.textContent = err.message;
      }
    });
  }

  function renderRelevantActions(letter) {
    const canReceive = letter.sent_to_relevant_at && !letter.relevant_officer_received_at;
    const canAct = letter.relevant_officer_received_at && !letter.action_taken_at;
    actionsEl.innerHTML = `
      <button id="receiveBtn" ${canReceive ? '' : 'disabled'}
        data-i18n="markReceived">Mark Received</button>
      <textarea id="actionNotes" data-i18n-placeholder="actionTakenPlaceholder"
        ${canAct ? '' : 'disabled'}>${letter.action_notes || ''}</textarea>
      <button id="submitActionBtn" ${canAct ? '' : 'disabled'}
        data-i18n="recordAction">Record Action Taken</button>
      ${!letter.sent_to_relevant_at
        ? `<p class="status-message" data-i18n="notForwardedYet">This letter has not been forwarded by the subject officer yet.</p>`
        : ''}
      ${letter.sent_to_relevant_at && !letter.relevant_officer_received_at
        ? `<p class="status-message" data-i18n="markReceivedBeforeAction">Mark the letter as received before recording an action.</p>`
        : ''}
      ${canAct
        ? `
      <div class="reassign-block">
        <label for="reassignOfficer" data-i18n="reassignLabel">Reassign to another officer</label>
        <select id="reassignOfficer"><option value="" data-i18n="selectOfficer">Select officer</option></select>
        <textarea id="reassignNote" data-i18n-placeholder="reassignNotePlaceholder"></textarea>
        <button type="button" id="reassignBtn" data-i18n="reassignBtn">Reassign</button>
      </div>`
        : ''}
    `;
    document.getElementById('receiveBtn').addEventListener('click', async () => {
      try {
        const { letter: updated } = await linkPost('receive');
        renderLetter(updated);
        renderRelevantActions(updated);
      } catch (err) {
        statusEl.textContent = err.message;
      }
    });
    document.getElementById('submitActionBtn').addEventListener('click', async () => {
      const notes = document.getElementById('actionNotes').value.trim();
      if (!notes) {
        statusEl.textContent = window.i18n.t('actionNotesRequired');
        return;
      }
      try {
        const { letter: updated } = await linkPost('action', { notes });
        renderLetter(updated);
        renderRelevantActions(updated);
        statusEl.textContent = window.i18n.t('actionRecordedSuccess');
      } catch (err) {
        statusEl.textContent = err.message;
      }
    });

    if (canAct) {
      const reassignSelect = document.getElementById('reassignOfficer');
      linkGetOfficers()
        .then(({ officers }) => {
          reassignSelect.insertAdjacentHTML(
            'beforeend',
            officers
              .map((o) => {
                const divisionName = o.division
                  ? window.APP_CONFIG.divisionName(o.division, window.i18n.currentLang())
                  : '';
                const extra = [o.designation, divisionName].filter(Boolean).join(' - ');
                return `<option value="${o.id}">${o.name}${extra ? ` (${extra})` : ''}</option>`;
              })
              .join('')
          );
        })
        .catch((err) => {
          statusEl.textContent = err.message;
        });

      document.getElementById('reassignBtn').addEventListener('click', async () => {
        const officerId = reassignSelect.value;
        if (!officerId) return;
        const note = document.getElementById('reassignNote').value.trim();
        try {
          const { letter: updated } = await linkPost('reassign', { officerId: Number(officerId), note });
          actionsEl.innerHTML = '';
          statusEl.textContent = window.i18n.t('reassignedSuccess');
          renderLetter(updated);
        } catch (err) {
          statusEl.textContent = err.message;
        }
      });
    }
  }

  try {
    const { letter, role, reassignments } = await linkGet();
    renderLetter(letter, reassignments);
    if (role === 'subject') renderSubjectActions(letter);
    else renderRelevantActions(letter);
  } catch (err) {
    detailsEl.textContent = err.message;
  }
});
