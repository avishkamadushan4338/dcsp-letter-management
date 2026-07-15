const pool = require('../config/db');

async function create({ letterId, fromOfficerId, toOfficerId, note }) {
  await pool.query(
    'INSERT INTO letter_reassignments (letter_id, from_officer_id, to_officer_id, note) VALUES (?, ?, ?, ?)',
    [letterId, fromOfficerId, toOfficerId, note || null]
  );
}

async function findByLetterId(letterId) {
  const [rows] = await pool.query(
    `SELECT
       r.id, r.reassigned_at, r.note,
       fo.name AS from_officer_name,
       to_o.name AS to_officer_name
     FROM letter_reassignments r
     JOIN officers fo ON fo.id = r.from_officer_id
     JOIN officers to_o ON to_o.id = r.to_officer_id
     WHERE r.letter_id = ?
     ORDER BY r.reassigned_at ASC`,
    [letterId]
  );
  return rows;
}

module.exports = { create, findByLetterId };
