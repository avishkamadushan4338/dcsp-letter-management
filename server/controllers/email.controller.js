const pool = require('../config/db');
const tokenService = require('../services/tokenService');
const mailService = require('../services/mailService');

const BASE_URL = process.env.APP_BASE_URL || 'http://localhost:3000';

async function recordLink(letterId, role, token, expiresAt) {
  await pool.query(
    'INSERT INTO links (token, letter_id, officer_role, expires_at) VALUES (?, ?, ?, ?)',
    [token, letterId, role, expiresAt]
  );
}

// Emails both the subject officer and the relevant officer their unique,
// signed link for this letter, and records each link for one-time use.
async function sendOfficerLinks(letter) {
  const results = { subject: null, relevant: null };

  if (letter.subject_officer_id && letter.subject_officer_email) {
    const { token, expiresAt } = tokenService.createLetterLinkToken(letter.id, 'subject');
    await recordLink(letter.id, 'subject', token, expiresAt);
    const link = `${BASE_URL}/subject-officer.html?token=${token}`;
    results.subject = await mailService.sendOfficerLinkEmail({
      to: letter.subject_officer_email,
      officerName: letter.subject_officer_name,
      roleLabel: 'Subject Officer',
      letter,
      link,
    });
  }

  if (letter.relevant_officer_id && letter.relevant_officer_email) {
    const { token, expiresAt } = tokenService.createLetterLinkToken(letter.id, 'relevant');
    await recordLink(letter.id, 'relevant', token, expiresAt);
    const link = `${BASE_URL}/relevant-officer.html?token=${token}`;
    results.relevant = await mailService.sendOfficerLinkEmail({
      to: letter.relevant_officer_email,
      officerName: letter.relevant_officer_name,
      roleLabel: 'Relevant Officer',
      letter,
      link,
    });
  }

  return results;
}

// Mints a fresh relevant-officer link for a specific officer and emails it -
// used when the current relevant officer reassigns the letter to a
// colleague (see links.routes.js POST /:token/reassign). fromOfficerName/note
// let the new officer see who sent it to them and why right in the email,
// not just after opening the link.
async function sendRelevantOfficerLink(letter, officer, { fromOfficerName, note } = {}) {
  const { token, expiresAt } = tokenService.createLetterLinkToken(letter.id, 'relevant');
  await recordLink(letter.id, 'relevant', token, expiresAt);
  const link = `${BASE_URL}/relevant-officer.html?token=${token}`;
  return mailService.sendOfficerLinkEmail({
    to: officer.email,
    officerName: officer.name,
    roleLabel: 'Relevant Officer',
    letter,
    link,
    reassignedFrom: fromOfficerName,
    reassignNote: note,
  });
}

module.exports = { sendOfficerLinks, sendRelevantOfficerLink };
