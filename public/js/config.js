// Shared frontend configuration: API base, division map, number format helper.
window.APP_CONFIG = {
  API_BASE: '/api',

  DIVISIONS: [
    { code: '01', name: { en: 'Development Division', si: 'සංවර්ධන අංශය' } },
    { code: '02', name: { en: 'Administration Division', si: 'පරිපාලන අංශය' } },
    { code: '03', name: { en: 'Account Division', si: 'ගිණුම් අංශය' } },
  ],

  NUMBERS_PER_PRINT_SHEET: 16,

  divisionName(code, lang) {
    const div = this.DIVISIONS.find((d) => d.code === code);
    return div ? div.name[lang] || div.name.en : code;
  },
};
