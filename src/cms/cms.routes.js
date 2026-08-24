const express = require('express');
const router = express.Router();
const cmsController = require('./cms.controller');
const { protect, adminOnly } = require('../middleware/auth.middleware');

// Public route to fetch homepage CMS settings
router.get('/homepage', cmsController.getHomepageCMS);

// Public lightweight route to fetch testimonials only (used by PDP to avoid loading full CMS)
router.get('/testimonials', cmsController.getTestimonials);

// Admin protected route to update homepage CMS settings
router.put('/homepage', protect, adminOnly, cmsController.updateHomepageCMS);

module.exports = router;
