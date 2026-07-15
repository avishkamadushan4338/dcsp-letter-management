const pool = require('../config/db');

const LIST_SELECT = `
  SELECT
    l.*,
    so.name  AS subject_officer_name,
    so.email AS subject_officer_email,
    ro.name  AS relevant_officer_name,
    ro.email AS relevant_officer_email
  FROM letters l
  LEFT JOIN officers so ON so.id = l.subject_officer_id
  LEFT JOIN officers ro ON ro.id = l.relevant_officer_id
`;

async function create({
  letterNumber,
  division,
  subject,
  senderName,
  receivedDate,
  subjectOfficerId,
  relevantOfficerId,
  status = 'created',
  createdByRole = 'dcs',
  subjectOfficerReceivedAt = null,
  sentToRelevantAt = null,
}) {
  const [result] = await pool.query(
    `INSERT INTO letters
      (letter_number, division, subject, sender_name, received_date,
       subject_officer_id, relevant_officer_id, created_by_role,
       status, subject_officer_received_at, sent_to_relevant_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      letterNumber,
      division,
      subject || null,
      senderName || null,
      receivedDate || null,
      subjectOfficerId || null,
      relevantOfficerId || null,
      createdByRole,
      status,
      subjectOfficerReceivedAt,
      sentToRelevantAt,
    ]
  );
  return findById(result.insertId);
}

async function findAll({ status, division, search } = {}) {
  const clauses = [];
  const params = [];

  if (status) {
    clauses.push('l.status = ?');
    params.push(status);
  }
  if (division) {
    clauses.push('l.division = ?');
    params.push(division);
  }
  if (search) {
    clauses.push('(l.letter_number LIKE ? OR l.subject LIKE ? OR l.sender_name LIKE ?)');
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const [rows] = await pool.query(
    `${LIST_SELECT} ${where} ORDER BY l.created_at DESC`,
    params
  );
  return rows;
}

async function findById(id) {
  const [rows] = await pool.query(`${LIST_SELECT} WHERE l.id = ?`, [id]);
  return rows[0] || null;
}

async function updateStatus(id, fields) {
  const columns = Object.keys(fields);
  if (columns.length === 0) return findById(id);

  const setClause = columns.map((c) => `${c} = ?`).join(', ');
  const params = columns.map((c) => fields[c]);
  params.push(id);

  await pool.query(`UPDATE letters SET ${setClause} WHERE id = ?`, params);
  return findById(id);
}

module.exports = { create, findAll, findById, updateStatus };
