const express = require('express');
const router = express.Router();
const adminController = require('./admin.controller');
const { adminProtect } = require('./admin.middleware');

// ─── Protected Admin Endpoints ────────────────────────────────────────────────
router.get('/stats', adminProtect, adminController.getDashboardStats);
router.get('/orders', adminProtect, adminController.getAllOrders);
router.put('/orders/:id/status', adminProtect, adminController.updateOrderStatus);
router.post('/orders/:id/shipment', adminProtect, adminController.createShipment);
router.delete('/orders/:id', adminProtect, adminController.deleteOrder);

router.get('/products', adminProtect, adminController.getAllProducts);
router.post('/products', adminProtect, adminController.createProduct);
router.put('/products/:id', adminProtect, adminController.updateProduct);
router.delete('/products/:id', adminProtect, adminController.deleteProduct);

router.get('/users', adminProtect, adminController.getAllUsers);
router.delete('/users/:id', adminProtect, adminController.deleteUser);

module.exports = router;
