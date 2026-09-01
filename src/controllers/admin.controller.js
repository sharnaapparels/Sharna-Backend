const prisma = require('../config/database');

// GET /api/admin/users
exports.getAllUsers = async (req, res) => {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
    select: { id: true, name: true, email: true, phone: true, role: true, isBlocked: true, isVerified: true, createdAt: true }
  });
  res.json({ success: true, users });
};

// PUT /api/admin/users/:id/block
exports.blockUser = async (req, res) => {
  const user = await prisma.user.update({
    where: { id: req.params.id },
    data: { isBlocked: true }
  });
  res.json({ success: true, user });
};

// GET /api/admin/orders
exports.getAllOrders = async (req, res) => {
  const orders = await prisma.order.findMany({
    include: {
      user: { select: { name: true, email: true } },
      items: {
        include: {
          product: {
            include: {
              images: true
            }
          }
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  });
  res.json({ success: true, orders });
};

// PUT /api/admin/orders/:id/status
exports.updateOrderStatus = async (req, res) => {
  const { status } = req.body;
  const order = await prisma.order.update({
    where: { id: req.params.id },
    data: { status }
  });
  res.json({ success: true, order });
};
