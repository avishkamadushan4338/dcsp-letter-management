const express = require('express');
const officersController = require('../controllers/officers.controller');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth);

router.get('/subject-officer', officersController.getSubjectOfficer);
router.put('/subject-officer', officersController.setSubjectOfficer);

router.get('/', officersController.list);
router.post('/', officersController.create);
router.put('/:id', officersController.update);

module.exports = router;
