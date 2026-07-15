const pool = require('../config/db');

// Tiny key/value store for singleton app configuration (currently just the
// permanent Subject Officer's officer id - see officers.controller.js).
async function get(key) {
  const [rows] = await pool.query(
    'SELECT setting_value FROM app_settings WHERE setting_key = ?',
    [key]
  );
  return rows[0] ? rows[0].setting_value : null;
}

async function set(key, value) {
  await pool.query(
    `INSERT INTO app_settings (setting_key, setting_value) VALUES (?, ?)
     ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
    [key, value]
  );
}

module.exports = { get, set };
