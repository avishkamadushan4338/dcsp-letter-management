const express = require('express');
const pool = require('../config/db');
const tokenService = require('../services/tokenService');
const Letter = require('../models/Letter');
const Officer = require('../models/Officer');
const Reassignment = require('../models/Reassignment');
const emailController = require('../controllers/email.controller');

const router = express.Router();

// No requireAuth here: subject/relevant officers never log in, they are
// authenticated implicitly by possessing a valid, unexpired signed token.
async function resolveLink(token) {
  const payload = tokenService.verify(token);
  if (!payload) return { error: 'This link is invalid or has expired.' };

  const [rows] = await pool.query(
    'SELECT * FROM links WHERE token = ? AND letter_id = ? AND officer_role = ?',
    [token, payload.letterId, payload.role]
  );
  const link = rows[0];
  if (!link) return { error: 'This link is invalid or has expired.' };
  if (new Date(link.expiresAt || link.expires_at) < new Date()) {
    return { error: 'This link has expired.' };
  }

  const letter = await Letter.findById(link.letter_id);
  if (!letter) return { error: 'Letter not found.' };

  return { link, letter, role: payload.role };
}

async function markLinkUsed(linkId) {
  await pool.query('UPDATE links SET used_at = NOW() WHERE id = ?', [linkId]);
}

// GET /api/links/:token - fetch letter details for the emailed link.
// Includes reassignment history so an officer who was handed this letter
// by a colleague can see who sent it to them and why.
router.get('/:token', async (req, res, next) => {
  try {
    const { error, letter, role } = await resolveLink(req.params.token);
    if (error) return res.status(400).json({ error });
    const reassignments = await Reassignment.findByLetterId(letter.id);
    res.json({ letter, role, reassignments });
  } catch (err) {
    next(err);
  }
});

// POST /api/links/:token/receive - either officer marks the letter received
router.post('/:token/receive', async (req, res, next) => {
  try {
    const { error, letter, role } = await resolveLink(req.params.token);
    if (error) return res.status(400).json({ error });

    if (role === 'relevant' && !letter.sent_to_relevant_at) {
      return res.status(409).json({
        error: 'The subject officer has not forwarded this letter yet.',
      });
    }

    const fields = role === 'subject'
      ? { subject_officer_received_at: new Date(), status: 'with_subject_officer' }
      : { relevant_officer_received_at: new Date(), status: 'with_relevant_officer' };

    const updated = await Letter.updateStatus(letter.id, fields);
    res.json({ letter: updated });
  } catch (err) {
    next(err);
  }
});

// POST /api/links/:token/send - subject officer forwards to the relevant officer
router.post('/:token/send', async (req, res, next) => {
  try {
    const { error, letter, role, link } = await resolveLink(req.params.token);
    if (error) return res.status(400).json({ error });
    if (role !== 'subject') {
      return res.status(403).json({ error: 'Only the subject officer can forward this letter.' });
    }
    if (!letter.subject_officer_received_at) {
      return res.status(409).json({
        error: 'Mark the letter as received before forwarding it.',
      });
    }

    const updated = await Letter.updateStatus(letter.id, {
      sent_to_relevant_at: new Date(),
      status: 'sent_to_relevant',
    });
    await markLinkUsed(link.id);
    res.json({ letter: updated });
  } catch (err) {
    next(err);
  }
});

// POST /api/links/:token/action - relevant officer records the action taken
router.post('/:token/action', async (req, res, next) => {
  try {
    const { error, letter, role, link } = await resolveLink(req.params.token);
    if (error) return res.status(400).json({ error });
    if (role !== 'relevant') {
      return res.status(403).json({ error: 'Only the relevant officer can record an action.' });
    }
    if (!letter.relevant_officer_received_at) {
      return res.status(409).json({
        error: 'Mark the letter as received before recording an action.',
      });
    }

    const { notes } = req.body;
    if (!notes) return res.status(400).json({ error: 'Action notes are required.' });

    const updated = await Letter.updateStatus(letter.id, {
      action_taken_at: new Date(),
      action_notes: notes,
      status: 'action_taken',
    });
    await markLinkUsed(link.id);
    res.json({ letter: updated });
  } catch (err) {
    next(err);
  }
});

// GET /api/links/:token/officers - relevant officer picks a colleague to
// hand the letter to. Not scoped to the letter's division - reassignment is
// a manual judgment call by the current officer, not division-bound routing
// (unlike new-letter.html's division-scoped Relevant Officer picker).
router.get('/:token/officers', async (req, res, next) => {
  try {
    const { error, role } = await resolveLink(req.params.token);
    if (error) return res.status(400).json({ error });
    if (role !== 'relevant') {
      return res.status(403).json({ error: 'Only the relevant officer can view this list.' });
    }

    const officers = await Officer.findAll();
    res.json({ officers });
  } catch (err) {
    next(err);
  }
});

// POST /api/links/:token/reassign - relevant officer hands the letter to a
// different relevant officer. Expires every relevant-officer link issued so
// far for this letter (including the caller's own) and mints a fresh one
// for the new officer, so only the newest assignee can receive/act on it,
// and the admin dashboard picks up the new name via the usual join.
router.post('/:token/reassign', async (req, res, next) => {
  try {
    const { error, letter, role } = await resolveLink(req.params.token);
    if (error) return res.status(400).json({ error });
    if (role !== 'relevant') {
      return res.status(403).json({ error: 'Only the relevant officer can reassign this letter.' });
    }
    if (!letter.relevant_officer_received_at) {
      return res.status(409).json({
        error: 'Mark the letter as received before reassigning it.',
      });
    }
    if (letter.action_taken_at) {
      return res.status(409).json({
        error: 'This letter is already closed out and can no longer be reassigned.',
      });
    }

    const { officerId, note } = req.body;
    if (!officerId) return res.status(400).json({ error: 'officerId is required' });

    const officer = await Officer.findById(officerId);
    if (!officer || !officer.active) {
      return res.status(400).json({ error: 'Selected officer was not found.' });
    }
    if (Number(officerId) === Number(letter.relevant_officer_id)) {
      return res.status(400).json({ error: 'This letter is already assigned to that officer.' });
    }

    await pool.query(
      "UPDATE links SET expires_at = NOW() WHERE letter_id = ? AND officer_role = 'relevant'",
      [letter.id]
    );

    await Reassignment.create({
      letterId: letter.id,
      fromOfficerId: letter.relevant_officer_id,
      toOfficerId: officer.id,
      note,
    });

    const updated = await Letter.updateStatus(letter.id, {
      relevant_officer_id: officer.id,
      relevant_officer_received_at: null,
      sent_to_relevant_at: new Date(),
      status: 'sent_to_relevant',
    });

    await emailController.sendRelevantOfficerLink(updated, officer, {
      fromOfficerName: letter.relevant_officer_name,
      note,
    });

    res.json({ letter: updated });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
