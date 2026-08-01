const express = require('express');
const router = express.Router();
const cmsController = require('./cms.controller');
const { protect, adminOnly } = require('../middleware/auth.middleware');

// Public route to fetch homepage CMS settings
router.get('/homepage', cmsController.getHomepageCMS);

// Admin protected route to update homepage CMS settings
router.put('/homepage', protect, adminOnly, cmsController.updateHomepageCMS);

module.exports = router;
