const express = require('express');
const router = express.Router();
const productController = require('../controllers/product.controller');
const { protect, adminOnly } = require('../middleware/auth.middleware');

router.get('/', productController.getAllProducts);
router.get('/:slug', productController.getProductBySlug);
router.post('/', protect, adminOnly, productController.createProduct);
router.put('/:id', protect, adminOnly, productController.updateProduct);
router.delete('/:id', protect, adminOnly, productController.deleteProduct);

module.exports = router;
