const express = require('express');
const router = express.Router();
const contactController = require('../controllers/contact.controller');
const { protect, adminOnly, optionalAuth } = require('../middleware/auth.middleware');

router.post('/', optionalAuth, contactController.submitContact);
router.get('/', protect, adminOnly, contactController.getAllContacts);
router.patch('/:id/status', protect, adminOnly, contactController.updateContactStatus);
router.delete('/:id', protect, adminOnly, contactController.deleteContact);

module.exports = router;
