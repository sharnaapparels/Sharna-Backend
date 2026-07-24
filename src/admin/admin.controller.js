const prisma = require('../config/database');

// GET /api/admin/stats
exports.getDashboardStats = async (req, res) => {
  try {
    const totalOrdersCount = await prisma.order.count();
    const pendingOrdersCount = await prisma.order.count({ where: { status: 'PENDING' } });
    const confirmedOrdersCount = await prisma.order.count({ where: { status: 'CONFIRMED' } });
    const shippedOrdersCount = await prisma.order.count({ where: { status: 'SHIPPED' } });
    const deliveredOrdersCount = await prisma.order.count({ where: { status: 'DELIVERED' } });

    const totalProductsCount = await prisma.product.count();
    const totalUsersCount = await prisma.user.count({ where: { role: 'USER' } });

    // Aggregate paid revenue
    const revenueAggregate = await prisma.order.aggregate({
      _sum: {
        totalAmount: true
      },
      where: {
        paymentStatus: 'PAID'
      }
    });

    const totalRevenue = revenueAggregate._sum.totalAmount || 0;

    // Fetch 5 most recent orders
    const recentOrders = await prisma.order.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { name: true, email: true, phone: true } },
        items: { include: { product: true } }
      }
    });

    res.json({
      success: true,
      stats: {
        totalRevenue,
        totalOrdersCount,
        pendingOrdersCount,
        confirmedOrdersCount,
        shippedOrdersCount,
        deliveredOrdersCount,
        totalProductsCount,
        totalUsersCount
      },
      recentOrders
    });
  } catch (err) {
    console.error("Fetch admin stats failed:", err);
    res.status(500).json({ success: false, message: 'Failed to retrieve dashboard analytics' });
  }
};

// GET /api/admin/orders
exports.getAllOrders = async (req, res) => {
  try {
    const orders = await prisma.order.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, name: true, email: true, phone: true } },
        items: { include: { product: true } }
      }
    });
    res.json({ success: true, orders });
  } catch (err) {
    console.error("Fetch admin orders failed:", err);
    res.status(500).json({ success: false, message: 'Failed to retrieve orders list' });
  }
};

// PUT /api/admin/orders/:id/status
exports.updateOrderStatus = async (req, res) => {
  const { id } = req.params;
  const { status, paymentStatus } = req.body;

  try {
    const updateData = {};
    if (status) updateData.status = status;
    if (paymentStatus) updateData.paymentStatus = paymentStatus;

    const updatedOrder = await prisma.order.update({
      where: { id },
      data: updateData,
      include: {
        user: { select: { id: true, name: true, email: true, phone: true } },
        items: { include: { product: true } }
      }
    });

    res.json({ success: true, order: updatedOrder });
  } catch (err) {
    console.error("Update order status failed:", err);
    res.status(500).json({ success: false, message: 'Failed to update order status' });
  }
};

// POST /api/admin/orders/:id/shipment
exports.createShipment = async (req, res) => {
  const { id } = req.params;
  const { createShiprocketOrder } = require('../utils/shiprocket.service');

  try {
    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true, email: true, phone: true } },
        items: { include: { product: true } }
      }
    });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const shipmentResult = await createShiprocketOrder(order);

    let existingNotes = {};
    if (order.notes) {
      try { existingNotes = JSON.parse(order.notes); } catch (e) {}
    }

    const updatedNotes = JSON.stringify({
      ...existingNotes,
      shipmentId: shipmentResult.shipmentId,
      awbCode: shipmentResult.awbCode,
      courierName: shipmentResult.courierName,
      trackingUrl: shipmentResult.trackingUrl,
      shippedAt: new Date().toISOString()
    });

    const updatedOrder = await prisma.order.update({
      where: { id },
      data: {
        status: 'SHIPPED',
        notes: updatedNotes
      },
      include: {
        user: { select: { id: true, name: true, email: true, phone: true } },
        items: { include: { product: true } }
      }
    });

    res.json({
      success: true,
      message: `Dispatched via ${shipmentResult.courierName}! AWB: ${shipmentResult.awbCode}`,
      shipment: shipmentResult,
      order: updatedOrder
    });
  } catch (err) {
    console.error("Create shipment error:", err);
    res.status(500).json({ success: false, message: 'Failed to dispatch shipment' });
  }
};

// GET /api/admin/products
exports.getAllProducts = async (req, res) => {
  try {
    const products = await prisma.product.findMany({
      orderBy: { createdAt: 'desc' },
      include: { images: true }
    });
    res.json({ success: true, products });
  } catch (err) {
    console.error("Fetch admin products failed:", err);
    res.status(500).json({ success: false, message: 'Failed to retrieve products list' });
  }
};

// POST /api/admin/products
exports.createProduct = async (req, res) => {
  const { title, description, price, originalPrice, category, isFeatured, stock, images, color, colors } = req.body;

  if (!title || !price || !category) {
    return res.status(400).json({ success: false, message: 'Title, price, and category are required' });
  }

  try {
    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '') + '-' + Date.now();

    const product = await prisma.product.create({
      data: {
        title,
        slug,
        description: description || '',
        price: parseFloat(price),
        salePrice: originalPrice ? parseFloat(price) : null,
        category,
        isFeatured: isFeatured || false,
        images: images && images.length > 0 ? {
          create: images.map((url, idx) => ({ url, isPrimary: idx === 0 }))
        } : undefined
      },
      include: { images: true }
    });

    res.json({
      success: true,
      product: {
        ...product,
        color: color || (colors && colors[0]) || 'Pink',
        colors: Array.isArray(colors) ? colors : (color ? [color] : ['Pink']),
        stock: stock ? parseInt(stock) : 50
      }
    });
  } catch (err) {
    console.error("Create product failed:", err);
    res.status(500).json({ success: false, message: 'Failed to create product' });
  }
};

// PUT /api/admin/products/:id
exports.updateProduct = async (req, res) => {
  const { id } = req.params;
  const { title, description, price, originalPrice, category, isFeatured, stock, color, colors } = req.body;

  try {
    const product = await prisma.product.update({
      where: { id },
      data: {
        title,
        description,
        price: price ? parseFloat(price) : undefined,
        category,
        isFeatured
      },
      include: { images: true }
    });

    res.json({
      success: true,
      product: {
        ...product,
        color: color || (colors && colors[0]) || 'Pink',
        colors: Array.isArray(colors) ? colors : (color ? [color] : ['Pink']),
        stock: stock !== undefined ? parseInt(stock) : 50
      }
    });
  } catch (err) {
    console.error("Update product failed:", err);
    res.status(500).json({ success: false, message: 'Failed to update product' });
  }
};

// DELETE /api/admin/products/:id
exports.deleteProduct = async (req, res) => {
  const { id } = req.params;

  try {
    // Delete product images & items first if needed, or rely on cascade
    await prisma.productImage.deleteMany({ where: { productId: id } });
    await prisma.product.delete({ where: { id } });

    res.json({ success: true, message: 'Product deleted successfully' });
  } catch (err) {
    console.error("Delete product failed:", err);
    res.status(500).json({ success: false, message: 'Failed to delete product' });
  }
};

// GET /api/admin/users
exports.getAllUsers = async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        isVerified: true,
        isBlocked: true,
        createdAt: true,
        addresses: true
      }
    });

    res.json({ success: true, users });
  } catch (err) {
    console.error("Fetch admin users failed:", err);
    res.status(500).json({ success: false, message: 'Failed to retrieve users list' });
  }
};
