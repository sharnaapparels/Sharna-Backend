const express = require('express');
const router = express.Router();
const reviewController = require('../controllers/review.controller');
const { protect, adminOnly, optionalAuth } = require('../middleware/auth.middleware');

router.get('/all', reviewController.getAllReviews);
router.get('/product/:productId', reviewController.getProductReviews);
router.post('/', optionalAuth, reviewController.createReview);
router.patch('/:id/visibility', optionalAuth, reviewController.toggleVisibility);
router.delete('/:id', optionalAuth, reviewController.deleteReview);

module.exports = router;
