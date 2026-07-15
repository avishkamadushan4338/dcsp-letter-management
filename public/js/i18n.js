// Minimal si <-> en switcher. Elements opt in with data-i18n="key" (text
// content) or data-i18n-placeholder="key" (input placeholder).
window.i18n = (() => {
  const STORAGE_KEY = 'dcs_lang';
  let strings = {};

  function currentLang() {
    return localStorage.getItem(STORAGE_KEY) || 'si';
  }

  async function loadLocale(lang) {
    const res = await fetch(`/locales/${lang}.json`);
    strings = await res.json();
  }

  function t(key) {
    return strings[key] || key;
  }

  function applyToDom() {
    document.querySelectorAll('[data-i18n]').forEach((el) => {
      el.textContent = t(el.getAttribute('data-i18n'));
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
      el.setAttribute('placeholder', t(el.getAttribute('data-i18n-placeholder')));
    });
    document.documentElement.lang = currentLang();
  }

  async function setLang(lang) {
    localStorage.setItem(STORAGE_KEY, lang);
    await loadLocale(lang);
    applyToDom();
  }

  async function init() {
    await loadLocale(currentLang());
    applyToDom();

    document.querySelectorAll('[data-lang-toggle]').forEach((btn) => {
      btn.addEventListener('click', () => {
        setLang(currentLang() === 'si' ? 'en' : 'si');
      });
    });
  }

  document.addEventListener('DOMContentLoaded', init);

  return { t, setLang, currentLang };
})();
