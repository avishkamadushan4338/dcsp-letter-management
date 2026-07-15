const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

function sendMail({ to, subject, html }) {
  return transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to,
    subject,
    html,
  });
}

function officerLinkEmail({ officerName, roleLabel, letter, link, reassignedFrom, reassignNote }) {
  const subject = `Letter ${letter.letter_number} - action required (${roleLabel})`;
  const reassignRow = reassignedFrom
    ? `<tr><td><strong>Reassigned by</strong></td><td>${reassignedFrom}${reassignNote ? ` - ${reassignNote}` : ''}</td></tr>`
    : '';
  const html = `
    <p>Dear ${officerName},</p>
    <p>A letter has been routed to you as the <strong>${roleLabel}</strong>.</p>
    <table cellpadding="6" style="border-collapse:collapse">
      <tr><td><strong>Letter No.</strong></td><td>${letter.letter_number}</td></tr>
      <tr><td><strong>Subject</strong></td><td>${letter.subject || '-'}</td></tr>
      ${reassignRow}
    </table>
    <p><a href="${link}">Open this letter</a></p>
    <p style="color:#777;font-size:12px">This link is unique to you and expires automatically. Do not forward it.</p>
  `;
  return { subject, html };
}

async function sendOfficerLinkEmail({ to, officerName, roleLabel, letter, link, reassignedFrom, reassignNote }) {
  const { subject, html } = officerLinkEmail({ officerName, roleLabel, letter, link, reassignedFrom, reassignNote });
  return sendMail({ to, subject, html });
}

module.exports = { sendMail, sendOfficerLinkEmail };
