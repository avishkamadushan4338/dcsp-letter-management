const crypto = require('crypto');

const SECRET = process.env.LINK_SECRET || 'dev-only-insecure-secret';
const DEFAULT_EXPIRY_HOURS = Number(process.env.LINK_EXPIRY_HOURS) || 72;

function base64url(input) {
  return Buffer.from(input).toString('base64url');
}

function sign(payload) {
  const body = base64url(JSON.stringify(payload));
  const hmac = crypto.createHmac('sha256', SECRET).update(body).digest('base64url');
  return `${body}.${hmac}`;
}

// Returns the decoded payload, or null if the signature is invalid,
// malformed, or the embedded expiry has passed.
function verify(token) {
  if (typeof token !== 'string' || !token.includes('.')) return null;

  const [body, hmac] = token.split('.');
  const expectedHmac = crypto.createHmac('sha256', SECRET).update(body).digest('base64url');

  const a = Buffer.from(hmac || '');
  const b = Buffer.from(expectedHmac);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  let payload;
  try {
    payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  } catch {
    return null;
  }

  if (!payload.exp || Date.now() > payload.exp) return null;
  return payload;
}

// Creates a signed token for a given letter + officer role (subject/relevant)
function createLetterLinkToken(letterId, role, expiryHours = DEFAULT_EXPIRY_HOURS) {
  const exp = Date.now() + expiryHours * 60 * 60 * 1000;
  const token = sign({ letterId, role, exp });
  return { token, expiresAt: new Date(exp) };
}

module.exports = { sign, verify, createLetterLinkToken };
