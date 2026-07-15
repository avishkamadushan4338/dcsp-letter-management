const express = require('express');
const lettersController = require('../controllers/letters.controller');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth);

router.get('/', lettersController.list);
router.get('/:id', lettersController.getOne);
router.post('/', lettersController.create);
router.post('/:id/review', lettersController.reviewLetter);

module.exports = router;
