// print-numbers.html: list every letter created *today* as "letter number -
// division - relevant officer", one per row in a single column (see
// css/print.css), 16 rows per printed page. Scoped to today only so each
// day's print run only covers that day's new letters - once the day turns
// over, yesterday's letters drop off and only the new day's letters qualify.
document.addEventListener('DOMContentLoaded', () => {
  const divisionSelect = document.getElementById('printDivision');
  const generateBtn = document.getElementById('generateSheetBtn');
  const printBtn = document.getElementById('printBtn');
  const sheetEl = document.getElementById('numberSheet');
  const statusEl = document.getElementById('formStatus');

  window.APP_CONFIG.DIVISIONS.forEach((d) => {
    const opt = document.createElement('option');
    opt.value = d.code;
    opt.textContent = `${d.code} - ${d.name[window.i18n.currentLang()] || d.name.en}`;
    divisionSelect.appendChild(opt);
  });

  function isToday(value) {
    if (!value) return false;
    const d = new Date(String(value).replace(' ', 'T'));
    const today = new Date();
    return (
      d.getFullYear() === today.getFullYear() &&
      d.getMonth() === today.getMonth() &&
      d.getDate() === today.getDate()
    );
  }

  generateBtn.addEventListener('click', async () => {
    generateBtn.disabled = true;
    statusEl.textContent = '';
    printBtn.disabled = true;
    try {
      const { letters } = await window.letters.list({
        division: divisionSelect.value,
      });
      const todaysLetters = letters.filter((l) => isToday(l.created_at));
      sheetEl.innerHTML = todaysLetters
        .map((l) => {
          const divisionName = window.APP_CONFIG.divisionName(l.division, window.i18n.currentLang());
          return `<div class="number-cell">${l.letter_number} - ${divisionName} - ${l.relevant_officer_name || '-'}</div>`;
        })
        .join('');
      printBtn.disabled = todaysLetters.length === 0;
      statusEl.textContent = todaysLetters.length === 0 ? window.i18n.t('noLetters') : '';
    } catch (err) {
      statusEl.textContent = err.message;
    } finally {
      generateBtn.disabled = false;
    }
  });

  printBtn.addEventListener('click', () => window.print());
});
