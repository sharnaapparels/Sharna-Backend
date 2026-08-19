const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/payment.controller');
const { optionalAuth } = require('../middleware/auth.middleware');

router.post('/create-order', optionalAuth, paymentController.createOrder);
router.post('/verify', optionalAuth, paymentController.verifyPayment);

module.exports = router;
