const express = require('express');
const router = express.Router();
const orderController = require('../controllers/order.controller');
const { protect } = require('../middleware/auth.middleware');

// Public Invoice PDF download route (accessible by WhatsApp document fetch & customers)
router.get('/:id/invoice.pdf', orderController.downloadInvoicePDF);
router.get('/:id/invoice', orderController.downloadInvoicePDF);

// Protected routes
router.use(protect);
router.get('/', orderController.getMyOrders);
router.get('/:id', orderController.getOrderById);
router.post('/', orderController.createOrder);

module.exports = router;
