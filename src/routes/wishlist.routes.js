const express = require('express');
const router = express.Router();
const wishlistController = require('../controllers/wishlist.controller');
const { protect, optionalAuth } = require('../middleware/auth.middleware');

// Public/Optional routes
router.post('/send-reminder', optionalAuth, wishlistController.sendAbandonedWishlistReminder);

// Protected routes
router.use(protect);
router.get('/', wishlistController.getWishlist);
router.post('/', wishlistController.addToWishlist);
router.post('/sync', wishlistController.syncWishlist);
router.delete('/:productId', wishlistController.removeFromWishlist);

module.exports = router;
