const Letter = require('../models/Letter');
const Settings = require('../models/Settings');
const Reassignment = require('../models/Reassignment');
const numberService = require('../services/numberService');
const emailController = require('./email.controller');

// POST /api/letters
// Creates a letter and assigns its officers in one step. If `letterNumber`
// was already reserved (new-letter.html issues one as soon as a division is
// picked, see js/new-letter.js), pass it through; otherwise a fresh number is
// issued for `division`.
async function create(req, res, next) {
  try {
    const {
      letterNumber,
      division,
      subject,
      senderName,
      receivedDate,
      relevantOfficerId,
    } = req.body;

    if (!division) {
      return res.status(400).json({ error: 'division is required' });
    }
    if (!relevantOfficerId) {
      return res.status(400).json({ error: 'relevantOfficerId is required' });
    }

    // Subject Officer is a single permanent post rather than a per-letter
    // choice - see officers.controller.js#setSubjectOfficer.
    const subjectOfficerId = req.body.subjectOfficerId || (await Settings.get('subject_officer_id'));
    if (!subjectOfficerId) {
      return res.status(400).json({
        error: 'No Subject Officer configured yet. Set one from the dashboard first.',
      });
    }

    const finalNumber = letterNumber || (await numberService.issueNext(division));

    const letter = await Letter.create({
      letterNumber: finalNumber,
      division,
      subject,
      senderName,
      receivedDate,
      subjectOfficerId,
      relevantOfficerId,
      createdByRole: 'dcs',
    });

    await emailController.sendOfficerLinks(letter);
    await Letter.updateStatus(letter.id, { status: 'sent_to_subject' });

    res.status(201).json({ letter: await Letter.findById(letter.id) });
  } catch (err) {
    next(err);
  }
}

// POST /api/letters/:id/review
// DCS reviews a letter the Subject Officer submitted (status
// 'pending_review'), assigns/confirms the Relevant Officer, and routes it
// back to the Subject Officer to distribute - same emailed-links step the
// direct-create path above already performs.
async function reviewLetter(req, res, next) {
  try {
    const letter = await Letter.findById(req.params.id);
    if (!letter) return res.status(404).json({ error: 'Letter not found' });
    if (letter.status !== 'pending_review') {
      return res.status(409).json({
        error: 'This letter is not awaiting review.',
      });
    }

    const { relevantOfficerId } = req.body;
    if (!relevantOfficerId) {
      return res.status(400).json({ error: 'relevantOfficerId is required' });
    }

    await Letter.updateStatus(letter.id, {
      relevant_officer_id: relevantOfficerId,
      status: 'sent_to_subject',
    });

    const updated = await Letter.findById(letter.id);
    await emailController.sendOfficerLinks(updated);

    res.json({ letter: updated });
  } catch (err) {
    next(err);
  }
}

async function list(req, res, next) {
  try {
    const { status, division, search } = req.query;
    const letters = await Letter.findAll({ status, division, search });
    res.json({ letters });
  } catch (err) {
    next(err);
  }
}

async function getOne(req, res, next) {
  try {
    const letter = await Letter.findById(req.params.id);
    if (!letter) return res.status(404).json({ error: 'Letter not found' });
    const reassignments = await Reassignment.findByLetterId(letter.id);
    res.json({ letter, reassignments });
  } catch (err) {
    next(err);
  }
}

module.exports = { create, list, getOne, reviewLetter };
