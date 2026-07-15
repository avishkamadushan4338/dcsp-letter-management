const pool = require('../config/db');

// officers.email is UNIQUE - surface that as a friendly 400 instead of the
// raw MySQL constraint error, which the global error handler would
// otherwise report as an opaque 500.
function friendlyDuplicateEmailError(err) {
  if (err.code === 'ER_DUP_ENTRY') {
    const dupErr = new Error('An officer with this email already exists.');
    dupErr.status = 400;
    return dupErr;
  }
  return err;
}

async function findAll({ division, activeOnly = true } = {}) {
  const clauses = [];
  const params = [];

  if (activeOnly) clauses.push('active = 1');
  if (division) {
    clauses.push('division = ?');
    params.push(division);
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const [rows] = await pool.query(
    `SELECT * FROM officers ${where} ORDER BY name ASC`,
    params
  );
  return rows;
}

async function findById(id) {
  const [rows] = await pool.query('SELECT * FROM officers WHERE id = ?', [id]);
  return rows[0] || null;
}

async function create({ name, email, designation, division }) {
  try {
    const [result] = await pool.query(
      'INSERT INTO officers (name, email, designation, division) VALUES (?, ?, ?, ?)',
      [name, email, designation || null, division || null]
    );
    return findById(result.insertId);
  } catch (err) {
    throw friendlyDuplicateEmailError(err);
  }
}

async function update(id, { name, email, designation, division, active }) {
  try {
    await pool.query(
      `UPDATE officers
       SET name = ?, email = ?, designation = ?, division = ?, active = ?
       WHERE id = ?`,
      [name, email, designation || null, division || null, active ? 1 : 0, id]
    );
    return findById(id);
  } catch (err) {
    throw friendlyDuplicateEmailError(err);
  }
}

async function updateContact(id, { name, email }) {
  try {
    await pool.query('UPDATE officers SET name = ?, email = ? WHERE id = ?', [name, email, id]);
    return findById(id);
  } catch (err) {
    throw friendlyDuplicateEmailError(err);
  }
}

// Soft delete: letters keep a foreign key to whichever officer handled
// them, so a removed officer is deactivated (hidden from rosters/dropdowns)
// rather than hard-deleted, which would either fail on that FK or erase
// their name from past letters' history.
async function deactivate(id) {
  await pool.query('UPDATE officers SET active = 0 WHERE id = ?', [id]);
}

module.exports = { findAll, findById, create, update, updateContact, deactivate };
