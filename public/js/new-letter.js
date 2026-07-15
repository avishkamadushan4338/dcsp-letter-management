// new-letter.html: DCS enters the letter, generates its number, assigns a
// subject + relevant officer, and triggers both emails.
document.addEventListener('DOMContentLoaded', async () => {
  const divisionSelect = document.getElementById('division');
  const subjectOfficerDisplay = document.getElementById('subjectOfficerDisplay');
  const relevantOfficerSelect = document.getElementById('relevantOfficer');
  const numberDisplay = document.getElementById('letterNumberDisplay');
  const receivedDateInput = document.getElementById('receivedDate');
  const form = document.getElementById('newLetterForm');
  const statusEl = document.getElementById('formStatus');
  const submitBtn = form.querySelector('button[type="submit"]');

  let issuedNumber = null;
  let subjectOfficerConfigured = false;

  // Defaults to today, but stays a normal date input so the DCS can change
  // it (e.g. backdating a letter that physically arrived earlier).
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

  // The Subject Officer is a single permanent post (configured from the
  // dashboard header), not chosen per letter - just show who it is.
  async function loadSubjectOfficer() {
    const { officer } = await window.letters.getSubjectOfficer();
    subjectOfficerConfigured = Boolean(officer);
    subjectOfficerDisplay.textContent = officer
      ? `${officer.name} (${officer.email})`
      : window.i18n.t('subjectOfficerNotConfigured');
    submitBtn.disabled = !subjectOfficerConfigured;
  }

  async function populateOfficers() {
    const { officers } = await window.letters.listOfficers(divisionSelect.value);
    relevantOfficerSelect.innerHTML = '';
    officers.forEach((o) => {
      const opt = document.createElement('option');
      opt.value = o.id;
      opt.textContent = `${o.name} (${o.designation || o.division || ''})`;
      relevantOfficerSelect.appendChild(opt);
    });
  }

  // The reference number is unique/atomic per division on the server
  // (numberService.issueNext reserves it immediately), so it's issued and
  // shown as soon as a division is picked rather than via a manual button.
  async function issueNumber() {
    issuedNumber = null;
    numberDisplay.textContent = '-';
    if (!divisionSelect.value) return;
    try {
      const { numbers } = await window.api.post('/numbers/issue', {
        division: divisionSelect.value,
        count: 1,
      });
      issuedNumber = numbers[0];
      numberDisplay.textContent = issuedNumber;
    } catch (err) {
      statusEl.textContent = err.message;
    }
  }

  divisionSelect.addEventListener('change', () => {
    populateOfficers();
    issueNumber();
  });
  await Promise.all([populateOfficers(), loadSubjectOfficer()]);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!issuedNumber) {
      statusEl.textContent = window.i18n.t('selectDivisionFirst');
      return;
    }
    if (!subjectOfficerConfigured) {
      statusEl.textContent = window.i18n.t('subjectOfficerNotConfigured');
      return;
    }

    statusEl.textContent = window.i18n.t('submitting');
    try {
      await window.letters.create({
        letterNumber: issuedNumber,
        division: divisionSelect.value,
        subject: document.getElementById('subject').value,
        senderName: document.getElementById('senderName').value,
        receivedDate: document.getElementById('receivedDate').value,
        relevantOfficerId: relevantOfficerSelect.value,
      });
      statusEl.textContent = window.i18n.t('letterCreatedSuccess');
      form.reset();
      setDefaultReceivedDate();
      numberDisplay.textContent = '-';
      issuedNumber = null;
    } catch (err) {
      statusEl.textContent = err.message;
    }
  });
});
