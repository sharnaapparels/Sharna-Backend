const express = require('express');
const router = express.Router();
const cmsController = require('./cms.controller');
const { protect, adminOnly } = require('../middleware/auth.middleware');

// Public route to fetch homepage CMS settings
router.get('/homepage', cmsController.getHomepageCMS);

// Public lightweight route to fetch testimonials only (used by PDP to avoid loading full CMS)
router.get('/testimonials', cmsController.getTestimonials);

// Public route to fetch collections page CMS settings
router.get('/collections', cmsController.getCollectionsCMS);

// Admin protected route to update homepage CMS settings
router.put('/homepage', protect, adminOnly, cmsController.updateHomepageCMS);

// Admin protected route to update collections page CMS settings
router.put('/collections', protect, adminOnly, cmsController.updateCollectionsCMS);

module.exports = router;
