// subject-officer-new-letter.html: the Subject Officer originates a letter
// themselves and picks how it's routed - straight to a Relevant Officer, or
// via DCS for review first (see subject-officer.routes.js POST /letters).
document.addEventListener('DOMContentLoaded', async () => {
  const divisionSelect = document.getElementById('division');
  const relevantOfficerSelect = document.getElementById('relevantOfficer');
  const receivedDateInput = document.getElementById('receivedDate');
  const form = document.getElementById('newLetterForm');
  const statusEl = document.getElementById('formStatus');
  const routingInputs = form.querySelectorAll('input[name="routing"]');

  function setDefaultReceivedDate() {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    receivedDateInput.value = `${yyyy}-${mm}-${dd}`;
  }
  setDefaultReceivedDate();

  window.APP_CONFIG.DIVISIONS.forEach((d) => {
    const opt = document.createElement('option');
    opt.value = d.code;
    opt.textContent = `${d.code} - ${d.name[window.i18n.currentLang()] || d.name.en}`;
    divisionSelect.appendChild(opt);
  });

  function currentRouting() {
    return form.querySelector('input[name="routing"]:checked').value;
  }

  // Direct routing needs a firm Relevant Officer pick now; routing via Admin
  // leaves it as an optional suggestion the Admin can confirm or change.
  function applyRoutingToOfficerField() {
    const isDirect = currentRouting() === 'direct';
    relevantOfficerSelect.required = isDirect;
    const placeholder = relevantOfficerSelect.querySelector('option[value=""]');
    if (placeholder) {
      placeholder.textContent = isDirect
        ? window.i18n.t('selectOfficer')
        : window.i18n.t('adminWillAssignOfficer');
    }
  }

  async function populateOfficers() {
    const { officers } = await window.letters.subjectOfficerListOfficers(divisionSelect.value);
    relevantOfficerSelect.innerHTML = `<option value="">${window.i18n.t('selectOfficer')}</option>`;
    officers.forEach((o) => {
      const opt = document.createElement('option');
      opt.value = o.id;
      opt.textContent = `${o.name} (${o.designation || o.division || ''})`;
      relevantOfficerSelect.appendChild(opt);
    });
    applyRoutingToOfficerField();
  }

  divisionSelect.addEventListener('change', populateOfficers);

  routingInputs.forEach((input) => {
    input.addEventListener('change', applyRoutingToOfficerField);
  });

  await populateOfficers();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!divisionSelect.value) {
      statusEl.textContent = window.i18n.t('selectDivisionFirst');
      return;
    }

    const routing = currentRouting();
    if (routing === 'direct' && !relevantOfficerSelect.value) {
      statusEl.textContent = window.i18n.t('relevantOfficerRequiredForDirect');
      return;
    }

    statusEl.textContent = window.i18n.t('submitting');
    try {
      await window.letters.subjectOfficerCreate({
        division: divisionSelect.value,
        subject: document.getElementById('subject').value,
        senderName: document.getElementById('senderName').value,
        receivedDate: document.getElementById('receivedDate').value,
        relevantOfficerId: relevantOfficerSelect.value || null,
        routing,
      });
      statusEl.textContent = window.i18n.t(
        routing === 'direct' ? 'letterSentDirectSuccess' : 'letterRoutedToAdminSuccess'
      );
      form.reset();
      setDefaultReceivedDate();
      applyRoutingToOfficerField();
    } catch (err) {
      statusEl.textContent = err.message;
    }
  });
});
