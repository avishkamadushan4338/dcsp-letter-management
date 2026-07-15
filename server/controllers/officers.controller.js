const Officer = require('../models/Officer');
const Settings = require('../models/Settings');

const SUBJECT_OFFICER_SETTING_KEY = 'subject_officer_id';

// The Subject Officer is a single permanent post (same person on every
// letter), unlike the Relevant Officer which is picked per letter. Its
// identity is just an officers.id pointed to by app_settings, so it still
// reuses the officers table (and every join/email path that already reads
// subject_officer_id off a letter) - only *which* officer that id names
// changes, via PUT below.
async function getSubjectOfficer(req, res, next) {
  try {
    const id = await Settings.get(SUBJECT_OFFICER_SETTING_KEY);
    const officer = id ? await Officer.findById(id) : null;
    res.json({ officer });
  } catch (err) {
    next(err);
  }
}

async function setSubjectOfficer(req, res, next) {
  try {
    const { name, email } = req.body;
    if (!name || !email) {
      return res.status(400).json({ error: 'name and email are required' });
    }

    const existingId = await Settings.get(SUBJECT_OFFICER_SETTING_KEY);
    let officer;
    if (existingId) {
      officer = await Officer.updateContact(existingId, { name, email });
    } else {
      officer = await Officer.create({ name, email, designation: 'Subject Officer' });
      await Settings.set(SUBJECT_OFFICER_SETTING_KEY, officer.id);
    }

    res.json({ officer });
  } catch (err) {
    next(err);
  }
}

async function list(req, res, next) {
  try {
    const { division } = req.query;
    const officers = await Officer.findAll({ division });
    res.json({ officers });
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
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
}

async function update(req, res, next) {
  try {
    const officer = await Officer.update(req.params.id, req.body);
    res.json({ officer });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, create, update, getSubjectOfficer, setSubjectOfficer };
