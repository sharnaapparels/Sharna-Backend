const Review = require('../models/review.model');

exports.getProductReviews = async (req, res) => {
  const reviews = await Review.find({ product: req.params.productId, isApproved: true })
    .populate('user', 'name')
    .sort('-createdAt');
  res.json({ success: true, reviews });
};

exports.createReview = async (req, res) => {
  const { productId, rating, comment, images } = req.body;

  try {
    const review = await Review.create({
      user: req.user._id,
      product: productId,
      rating,
      comment,
      images
    });
    res.status(201).json({ success: true, review });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: 'You have already reviewed this product' });
    }
    res.status(500).json({ success: false, message: 'Review creation failed', error: error.message });
  }
};
