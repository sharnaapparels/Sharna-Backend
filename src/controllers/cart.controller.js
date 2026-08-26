const prisma = require('../config/database');

// GET /api/cart
exports.getCart = async (req, res) => {
  const cart = await prisma.cartItem.findMany({
    where: { userId: req.user.id },
    include: {
      product: {
        select: {
          id: true,
          title: true,
          price: true,
          salePrice: true,
          category: true,
          collection: true,
          images: { select: { id: true, url: true, isPrimary: true } }
        }
      }
    }
  });
  res.json({ success: true, cart });
};

// POST /api/cart
exports.addToCart = async (req, res) => {
  const { productId, quantity = 1, size, color } = req.body;

  const existing = await prisma.cartItem.findFirst({
    where: { userId: req.user.id, productId, size, color }
  });

  let item;
  if (existing) {
    item = await prisma.cartItem.update({
      where: { id: existing.id },
      data: { quantity: existing.quantity + quantity }
    });
  } else {
    item = await prisma.cartItem.create({
      data: { userId: req.user.id, productId, quantity, size, color }
    });
  }

  res.status(201).json({ success: true, item });
};

// PUT /api/cart/:id
exports.updateCartItem = async (req, res) => {
  const { quantity } = req.body;
  const item = await prisma.cartItem.update({
    where: { id: req.params.id },
    data: { quantity }
  });
  res.json({ success: true, item });
};

// DELETE /api/cart/:id
exports.removeFromCart = async (req, res) => {
  await prisma.cartItem.delete({ where: { id: req.params.id } });
  res.json({ success: true, message: 'Item removed from cart' });
};

// DELETE /api/cart
exports.clearCart = async (req, res) => {
  await prisma.cartItem.deleteMany({ where: { userId: req.user.id } });
  res.json({ success: true, message: 'Cart cleared' });
};
