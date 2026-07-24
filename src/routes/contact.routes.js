const express = require('express');
const router = express.Router();
const contactController = require('../controllers/contact.controller');
const { protect, adminOnly } = require('../middleware/auth.middleware');

router.post('/', contactController.submitContact);
router.get('/', protect, adminOnly, contactController.getAllContacts);

module.exports = router;
