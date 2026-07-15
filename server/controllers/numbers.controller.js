const numberService = require('../services/numberService');

// POST /api/numbers/issue { division, count? }
// Atomically reserves one or more numbers. Used by new-letter.html (count=1)
// to pre-issue a number before a letter is saved. print-numbers.html no
// longer calls this - it lists already-created letters instead (see
// js/print.js), so batch issuing here is otherwise unused but kept as a
// general capability of the endpoint.
async function issue(req, res, next) {
  try {
    const { division, count = 1 } = req.body;

    if (!division) {
      return res.status(400).json({ error: 'division is required' });
    }
    const n = Math.max(1, Math.min(Number(count) || 1, 100));

    const numbers = n === 1
      ? [await numberService.issueNext(division)]
      : await numberService.issueBatch(division, n);

    res.status(201).json({ numbers });
  } catch (err) {
    next(err);
  }
}

module.exports = { issue };
