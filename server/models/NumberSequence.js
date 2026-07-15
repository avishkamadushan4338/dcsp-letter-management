// Row-level access to `number_sequence`. Always called from within the
// transaction that `numberService` owns, so callers pass a connection.

async function getForUpdate(conn, division, year) {
  const [rows] = await conn.query(
    'SELECT * FROM number_sequence WHERE division = ? FOR UPDATE',
    [division]
  );

  if (rows.length === 0) {
    await conn.query(
      'INSERT INTO number_sequence (division, current_number, year) VALUES (?, 0, ?)',
      [division, year]
    );
    return { division, current_number: 0, year };
  }

  return rows[0];
}

async function update(conn, division, currentNumber, year) {
  await conn.query(
    'UPDATE number_sequence SET current_number = ?, year = ? WHERE division = ?',
    [currentNumber, year, division]
  );
}

module.exports = { getForUpdate, update };
