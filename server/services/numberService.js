const pool = require('../config/db');
const NumberSequence = require('../models/NumberSequence');

const MAX_NUMBER = 99999;

// DCSP/{division}/{NNNNN} - e.g. DCSP/02/12345. Not year-scoped: the wrap
// below is the only reset, so this format never changes shape.
function format(division, seq) {
  return `DCSP/${division}/${String(seq).padStart(5, '0')}`;
}

// Atomically issues the next number for a division. Wraps back to 00000
// once the sequence exceeds MAX_NUMBER (99999). letters.letter_number is
// UNIQUE, so if a wrapped number is still attached to an active letter,
// creating the new letter fails loudly instead of silently colliding.
async function issueNext(division) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const currentYear = new Date().getFullYear();
    const row = await NumberSequence.getForUpdate(conn, division, currentYear);

    let nextNumber = row.current_number + 1;
    if (nextNumber > MAX_NUMBER) {
      nextNumber = 0;
    }

    await NumberSequence.update(conn, division, nextNumber, currentYear);
    await conn.commit();

    return format(division, nextNumber);
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

async function issueBatch(division, count) {
  const numbers = [];
  for (let i = 0; i < count; i += 1) {
    numbers.push(await issueNext(division));
  }
  return numbers;
}

module.exports = { issueNext, issueBatch, format, MAX_NUMBER };
