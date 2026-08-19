const express = require('express');
const router = express.Router();
const orderController = require('../controllers/order.controller');
const { protect } = require('../middleware/auth.middleware');

// Public Invoice download & view routes
router.get('/:id/invoice.pdf', orderController.downloadInvoicePDF);
router.get('/:id/invoice', orderController.viewInvoiceHTML);

// Protected routes
router.use(protect);
router.get('/', orderController.getMyOrders);
router.get('/:id', orderController.getOrderById);
router.post('/', orderController.createOrder);

module.exports = router;
