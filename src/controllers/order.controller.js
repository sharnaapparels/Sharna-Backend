const prisma = require('../config/database');

// GET /api/orders
exports.getMyOrders = async (req, res) => {
  const orders = await prisma.order.findMany({
    where: { userId: req.user.id },
    include: { items: { include: { product: { include: { images: true } } } } },
    orderBy: { createdAt: 'desc' }
  });
  res.json({ success: true, orders });
};

// GET /api/orders/:id
exports.getOrderById = async (req, res) => {
  const order = await prisma.order.findFirst({
    where: { id: req.params.id, userId: req.user.id },
    include: { items: { include: { product: { include: { images: true } } } } }
  });
  if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
  res.json({ success: true, order });
};

// POST /api/orders (create from cart after payment)
exports.createOrder = async (req, res) => {
  const { items, totalAmount, shippingAddress, razorpayOrderId } = req.body;

  const order = await prisma.order.create({
    data: {
      userId: req.user.id,
      totalAmount,
      razorpayOrderId,
      shippingStreet: shippingAddress?.street,
      shippingCity: shippingAddress?.city,
      shippingState: shippingAddress?.state,
      shippingPostalCode: shippingAddress?.postalCode,
      items: {
        create: items.map(i => ({
          productId: i.productId,
          quantity: i.quantity,
          price: i.price,
          size: i.size,
          color: i.color
        }))
      }
    },
    include: { items: true }
  });
  res.status(201).json({ success: true, order });
};
