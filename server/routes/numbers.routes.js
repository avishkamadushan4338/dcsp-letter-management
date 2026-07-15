const express = require('express');
const numbersController = require('../controllers/numbers.controller');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth);

router.post('/issue', numbersController.issue);

module.exports = router;
