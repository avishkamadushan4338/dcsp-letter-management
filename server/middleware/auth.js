const crypto = require('crypto');

// Minimal cookie-session login, shared by two roles:
//   - 'dcs': the DCS staff dashboard/new-letter pages.
//   - 'subject_officer': the Subject Officer's own multi-letter dashboard
//     (subject-officer-dashboard.html). This is a *login*, separate from
//     the per-letter emailed link that subject-officer.html still uses -
//     the Relevant Officer still never logs in and only ever authenticates
//     implicitly via that signed link token (routes/links.routes.js).
//
// NOTE: single shared username/password per role from .env. Swap for a
// real users table + hashed passwords before production use.

const SESSION_SECRET = process.env.SESSION_SECRET || 'dev-only-insecure-secret';
const COOKIE_NAME = 'dcs_session';
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

function signSession(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(body).digest('base64url');
  return `${body}.${sig}`;
}

function verifySession(cookieValue) {
  if (!cookieValue || !cookieValue.includes('.')) return null;
  const [body, sig] = cookieValue.split('.');
  const expectedSig = crypto.createHmac('sha256', SESSION_SECRET).update(body).digest('base64url');

  const a = Buffer.from(sig);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  if (Date.now() > payload.exp) return null;
  return payload;
}

function login(req, res) {
  const { username, password } = req.body;

  let role = null;
  if (username === process.env.DCS_USERNAME && password === process.env.DCS_PASSWORD) {
    role = 'dcs';
  } else if (
    username === process.env.SUBJECT_OFFICER_USERNAME &&
    password === process.env.SUBJECT_OFFICER_PASSWORD
  ) {
    role = 'subject_officer';
  }

  if (!role) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }

  const token = signSession({ username, role, exp: Date.now() + SESSION_TTL_MS });
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: SESSION_TTL_MS,
  });
  res.json({ ok: true, username, role });
}

function logout(req, res) {
  res.clearCookie(COOKIE_NAME);
  res.json({ ok: true });
}

function requireRole(role) {
  return (req, res, next) => {
    const session = verifySession(req.cookies?.[COOKIE_NAME]);
    if (!session) return res.status(401).json({ error: 'Not authenticated' });
    if (session.role !== role) return res.status(403).json({ error: 'Forbidden' });
    req.dcsUser = session;
    next();
  };
}

const requireAuth = requireRole('dcs');
const requireSubjectOfficer = requireRole('subject_officer');

module.exports = { login, logout, requireAuth, requireSubjectOfficer, requireRole };
