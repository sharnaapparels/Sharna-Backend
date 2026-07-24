const prisma = require('../config/database');

// POST /api/reviews
exports.createReview = async (req, res) => {
  const { productId, rating, title, body } = req.body;
  const review = await prisma.review.upsert({
    where: { userId_productId: { userId: req.user.id, productId } },
    update: { rating, title, body },
    create: { userId: req.user.id, productId, rating, title, body }
  });
  res.status(201).json({ success: true, review });
};

// GET /api/reviews/product/:productId
exports.getProductReviews = async (req, res) => {
  const reviews = await prisma.review.findMany({
    where: { productId: req.params.productId, isVisible: true },
    include: { user: { select: { name: true } } },
    orderBy: { createdAt: 'desc' }
  });
  res.json({ success: true, reviews });
};
