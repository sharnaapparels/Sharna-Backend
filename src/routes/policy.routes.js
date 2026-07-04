const express = require('express');
const router = express.Router();
const policyController = require('../controllers/policy.controller');
const { protect, adminOnly } = require('../middleware/auth.middleware');

router.get('/:type', policyController.getPolicy);
router.put('/:type', protect, adminOnly, policyController.updatePolicy);

module.exports = router;
