const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/payment.controller');
const { protect } = require('../middleware/auth.middleware');

router.post('/create-order', protect, paymentController.createRazorpayOrder);
router.post('/verify', protect, paymentController.verifyPaymentSignature);

module.exports = router;
