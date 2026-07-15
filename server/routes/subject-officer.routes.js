const express = require('express');
const Letter = require('../models/Letter');
const Officer = require('../models/Officer');
const Settings = require('../models/Settings');
const numberService = require('../services/numberService');
const emailController = require('../controllers/email.controller');
const { requireSubjectOfficer } = require('../middleware/auth');

const router = express.Router();

// There is a single, permanent Subject Officer for the whole office (see
// officers.controller.js#setSubjectOfficer), so "my letters" is simply
// every letter - this dashboard exists so they can see all of them in one
// place and update receive/send status without waiting on separate emails.
router.use(requireSubjectOfficer);

// Roster of officers (Division / Position / Name / Email) that can later be
// picked as a Relevant Officer on new-letter.html. The Subject Officer
// maintains this list directly from their own dashboard.
router.get('/officers', async (req, res, next) => {
  try {
    const { division } = req.query;
    const officers = await Officer.findAll({ division });
    res.json({ officers });
  } catch (err) {
    next(err);
  }
});

router.post('/officers', async (req, res, next) => {
  try {
    const { name, email, designation, division } = req.body;
    if (!name || !email) {
      return res.status(400).json({ error: 'name and email are required' });
    }
    const officer = await Officer.create({ name, email, designation, division });
    res.status(201).json({ officer });
  } catch (err) {
    next(err);
  }
});

router.delete('/officers/:id', async (req, res, next) => {
  try {
    const officer = await Officer.findById(req.params.id);
    if (!officer) return res.status(404).json({ error: 'Officer not found' });
    await Officer.deactivate(officer.id);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.get('/letters', async (req, res, next) => {
  try {
    const { status, division, search } = req.query;
    const letters = await Letter.findAll({ status, division, search });
    res.json({ letters });
  } catch (err) {
    next(err);
  }
});

// POST /letters - the Subject Officer originates a letter themselves, with a
// choice of routing:
//   'direct'    - skip DCS entirely, goes straight to the Relevant Officer.
//   'via_admin' - DCS still needs to review it and assign/confirm the
//                 Relevant Officer; the letter sits as 'pending_review'
//                 until DCS uses POST /api/letters/:id/review to route it
//                 back here for distribution.
router.post('/letters', async (req, res, next) => {
  try {
    const {
      division,
      subject,
      senderName,
      receivedDate,
      relevantOfficerId,
      routing,
    } = req.body;

    if (!division) {
      return res.status(400).json({ error: 'division is required' });
    }
    if (routing !== 'direct' && routing !== 'via_admin') {
      return res.status(400).json({ error: 'routing must be "direct" or "via_admin"' });
    }

    const subjectOfficerId = await Settings.get('subject_officer_id');
    if (!subjectOfficerId) {
      return res.status(400).json({
        error: 'No Subject Officer configured yet. Set one from the dashboard first.',
      });
    }

    const letterNumber = await numberService.issueNext(division);

    if (routing === 'direct') {
      if (!relevantOfficerId) {
        return res.status(400).json({
          error: 'relevantOfficerId is required to send directly to a Relevant Officer.',
        });
      }
      const officer = await Officer.findById(relevantOfficerId);
      if (!officer || !officer.active) {
        return res.status(400).json({ error: 'Selected Relevant Officer was not found.' });
      }

      const now = new Date();
      const letter = await Letter.create({
        letterNumber,
        division,
        subject,
        senderName,
        receivedDate,
        subjectOfficerId,
        relevantOfficerId,
        status: 'sent_to_relevant',
        createdByRole: 'subject_officer',
        subjectOfficerReceivedAt: now,
        sentToRelevantAt: now,
      });

      await emailController.sendRelevantOfficerLink(letter, officer);
      return res.status(201).json({ letter });
    }

    const letter = await Letter.create({
      letterNumber,
      division,
      subject,
      senderName,
      receivedDate,
      subjectOfficerId,
      relevantOfficerId: relevantOfficerId || null,
      status: 'pending_review',
      createdByRole: 'subject_officer',
    });

    res.status(201).json({ letter });
  } catch (err) {
    next(err);
  }
});

router.post('/letters/:id/receive', async (req, res, next) => {
  try {
    const letter = await Letter.findById(req.params.id);
    if (!letter) return res.status(404).json({ error: 'Letter not found' });

    const updated = await Letter.updateStatus(letter.id, {
      subject_officer_received_at: new Date(),
      status: 'with_subject_officer',
    });
    res.json({ letter: updated });
  } catch (err) {
    next(err);
  }
});

router.post('/letters/:id/send', async (req, res, next) => {
  try {
    const letter = await Letter.findById(req.params.id);
    if (!letter) return res.status(404).json({ error: 'Letter not found' });
    if (!letter.subject_officer_received_at) {
      return res.status(409).json({
        error: 'Mark the letter as received before forwarding it.',
      });
    }

    const updated = await Letter.updateStatus(letter.id, {
      sent_to_relevant_at: new Date(),
      status: 'sent_to_relevant',
    });
    res.json({ letter: updated });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
