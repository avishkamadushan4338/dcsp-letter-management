// Create / list / fetch letters. Used by dashboard.html and new-letter.html.
window.letters = {
  create(payload) {
    return window.api.post('/letters', payload);
  },

  list(params = {}) {
    const query = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v)
    ).toString();
    return window.api.get(`/letters${query ? `?${query}` : ''}`);
  },

  get(id) {
    return window.api.get(`/letters/${id}`);
  },

  // DCS reviews a letter the Subject Officer submitted, assigns the
  // Relevant Officer, and routes it back to them - see
  // letters.controller.js#reviewLetter.
  reviewLetter(id, payload) {
    return window.api.post(`/letters/${id}/review`, payload);
  },

  listOfficers(division) {
    const query = division ? `?division=${encodeURIComponent(division)}` : '';
    return window.api.get(`/officers${query}`);
  },

  getSubjectOfficer() {
    return window.api.get('/officers/subject-officer');
  },

  setSubjectOfficer(payload) {
    return window.api.put('/officers/subject-officer', payload);
  },

  // Subject Officer's own dashboard (cookie-session login, not the per-letter
  // emailed link that officer-actions.js uses).
  subjectOfficerLetters(params = {}) {
    const query = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v)
    ).toString();
    return window.api.get(`/subject-officer/letters${query ? `?${query}` : ''}`);
  },

  subjectOfficerReceive(id) {
    return window.api.post(`/subject-officer/letters/${id}/receive`);
  },

  subjectOfficerSend(id) {
    return window.api.post(`/subject-officer/letters/${id}/send`);
  },

  subjectOfficerCreate(payload) {
    return window.api.post('/subject-officer/letters', payload);
  },

  subjectOfficerListOfficers(division) {
    const query = division ? `?division=${encodeURIComponent(division)}` : '';
    return window.api.get(`/subject-officer/officers${query}`);
  },

  subjectOfficerCreateOfficer(payload) {
    return window.api.post('/subject-officer/officers', payload);
  },

  subjectOfficerRemoveOfficer(id) {
    return window.api.delete(`/subject-officer/officers/${id}`);
  },
};
