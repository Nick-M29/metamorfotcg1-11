const express = require('express');
const router = express.Router();
const eventsController = require('../controllers/events.controller');
const { requireAuth } = require('../middleware/auth.middleware');
const { requireRole } = require('../middleware/role.middleware');

router.get('/', requireAuth, eventsController.listEvents);
router.post('/', requireAuth, requireRole('admin'), eventsController.createEvent);
router.get('/:id/attendees', requireAuth, requireRole('admin'), eventsController.listAttendees);
router.post('/:id/register', requireAuth, eventsController.registerToEvent);
router.post('/:id/finalize', requireAuth, requireRole('admin'), eventsController.finalizeEvent);

module.exports = router;
