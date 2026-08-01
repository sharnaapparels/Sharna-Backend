const prisma = require('../config/database');
const { clearProductCache } = require('../utils/productCache');

// GET /api/admin/stats
exports.getDashboardStats = async (req, res) => {
  try {
    // Run all independent queries in PARALLEL — not sequentially
    const now = new Date();
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(now.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const [
      totalOrdersCount,
      orderStatusCounts,
      totalProductsCount,
      totalUsersCount,
      revenueAggregate,
      recentOrders,
      last7DaysOrders,
      lowStockProducts
    ] = await Promise.all([
      // Total orders
      prisma.order.count(),

      // All order status counts in ONE query using groupBy
      prisma.order.groupBy({
        by: ['status'],
        _count: { status: true }
      }),

      // Products & Users
      prisma.product.count(),
      prisma.user.count({ where: { role: 'USER' } }),

      // Revenue from paid orders
      prisma.order.aggregate({
        _sum: { totalAmount: true },
        where: { paymentStatus: 'PAID' }
      }),

      // Recent 5 orders
      prisma.order.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { name: true, email: true, phone: true } },
          items: { include: { product: true } }
        }
      }),

      // All orders from last 7 days in ONE query instead of 7 loops
      prisma.order.findMany({
        where: { createdAt: { gte: sevenDaysAgo } },
        select: { totalAmount: true, createdAt: true }
      }),

      // Low stock / top products
      prisma.product.findMany({
        take: 6,
        orderBy: { createdAt: 'desc' },
        include: { variants: true }
      })
    ]);

    // Parse status counts from groupBy result
    const statusMap = {};
    orderStatusCounts.forEach(s => { statusMap[s.status] = s._count.status; });

    const totalRevenue = revenueAggregate._sum.totalAmount || 0;
    const aov = totalOrdersCount > 0 ? Math.round(totalRevenue / totalOrdersCount) : 0;

    // Build last 7 days trend from the single batch query
    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dayStr = d.toDateString();

      const dayOrders = last7DaysOrders.filter(o => new Date(o.createdAt).toDateString() === dayStr);
      const dayRevenue = dayOrders.reduce((sum, o) => sum + (Number(o.totalAmount) || 0), 0);

      last7Days.push({
        label: d.toLocaleDateString('en-US', { weekday: 'short' }),
        date: d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' }),
        revenue: dayRevenue,
        orders: dayOrders.length
      });
    }

    // Format top products
    const topProducts = lowStockProducts.slice(0, 5).map(p => ({
      id: p.id,
      title: p.title,
      price: p.price,
      image: p.images?.[0]?.url || p.image,
      category: p.category || 'Luxury Attire',
      stock: p.variants?.reduce((acc, v) => acc + (v.stock || 0), 0) || 12
    }));

    // Force no-cache on this response
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('Pragma', 'no-cache');

    res.json({
      success: true,
      stats: {
        totalRevenue,
        aov,
        totalOrdersCount,
        pendingOrdersCount:   statusMap['PENDING']   || 0,
        confirmedOrdersCount: statusMap['CONFIRMED'] || 0,
        shippedOrdersCount:   statusMap['SHIPPED']   || 0,
        deliveredOrdersCount: statusMap['DELIVERED'] || 0,
        cancelledOrdersCount: statusMap['CANCELLED'] || 0,
        totalProductsCount,
        totalUsersCount,
        salesTrend: last7Days,
        topProducts
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
  const { title, description, price, originalPrice, category, collection, isNewArrival, isReadyToShip, isFeatured, stock, images, color, colors, sizes } = req.body;

  if (!title || !price || !category) {
    return res.status(400).json({ success: false, message: 'Title, price, and category are required' });
  }

  try {
    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '') + '-' + Date.now();

    const formattedImages = Array.isArray(images) ? images.map((img, idx) => {
      const imageUrl = typeof img === 'string' ? img : (img.url || img.src || '');
      return { url: imageUrl, isPrimary: idx === 0 };
    }).filter(i => i.url) : [];

    const computedCollection = collection || (isNewArrival ? 'new-arrivals' : (isReadyToShip ? 'ready-to-ship' : 'festive-collection'));

    const product = await prisma.product.create({
      data: {
        title,
        slug,
        description: description || '',
        price: parseFloat(price),
        salePrice: originalPrice ? parseFloat(originalPrice) : null,
        category,
        collection: computedCollection,
        isFeatured: isFeatured || false,
        isPublished: true,  // Always publish products created from admin
        images: formattedImages.length > 0 ? { create: formattedImages } : undefined
      },
      include: { images: true }
    });

    console.log(`✅ [PRODUCT CREATED IN DB]: ${product.title} (ID: ${product.id})`);
    clearProductCache();

    const { colorImages } = req.body;

    res.status(201).json({
      success: true,
      product: {
        ...product,
        isNewArrival: isNewArrival || computedCollection === 'new-arrivals',
        isReadyToShip: isReadyToShip || computedCollection === 'ready-to-ship',
        color: color || (colors && colors[0]) || 'Pink',
        colors: Array.isArray(colors) ? colors : (color ? [color] : ['Pink']),
        colorImages: colorImages || {},
        sizes: Array.isArray(sizes) ? sizes : ['XS', 'S', 'M', 'L', 'XL'],
        stock: stock ? parseInt(stock) : 50
      }
    });
  } catch (err) {
    console.error("❌ Create product failed:", err.message);
    res.status(500).json({ success: false, message: err.message || 'Failed to create product' });
  }
};

// PUT /api/admin/products/:id
exports.updateProduct = async (req, res) => {
  const { id } = req.params;
  const { title, description, price, originalPrice, category, collection, isNewArrival, isReadyToShip, isFeatured, stock, color, colors, images } = req.body;

  try {
    const computedCollection = collection || (isNewArrival !== undefined ? (isNewArrival ? 'new-arrivals' : 'festive-collection') : (isReadyToShip ? 'ready-to-ship' : undefined));

    const updateData = {};
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (price !== undefined) updateData.price = parseFloat(price);
    if (originalPrice !== undefined) updateData.salePrice = parseFloat(originalPrice);
    if (category !== undefined) updateData.category = category;
    if (computedCollection !== undefined) updateData.collection = computedCollection;
    if (isFeatured !== undefined) updateData.isFeatured = isFeatured;
    updateData.isPublished = true; // Always publish when saving from admin panel

    // Check if product exists in DB first
    const existing = await prisma.product.findUnique({ where: { id } });

    let product;
    if (existing) {
      product = await prisma.product.update({
        where: { id },
        data: updateData,
        include: { images: true }
      });
    } else {
      // Auto-provision product in PostgreSQL if ID was a client fallback ID
      const slug = (title || 'product').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '') + '-' + Date.now();
      const formattedImages = Array.isArray(images) ? images.map((img, idx) => {
        const imageUrl = typeof img === 'string' ? img : (img.url || img.src || '');
        return { url: imageUrl, isPrimary: idx === 0 };
      }).filter(i => i.url) : [];

      product = await prisma.product.create({
        data: {
          title: title || 'New Luxury Garment',
          slug,
          description: description || '',
          price: price ? parseFloat(price) : 999,
          salePrice: originalPrice ? parseFloat(originalPrice) : null,
          category: category || 'suit-sets',
          collection: computedCollection || 'festive-collection',
          isFeatured: isFeatured || false,
          isPublished: true,  // Always publish products created from admin
          images: formattedImages.length > 0 ? { create: formattedImages } : undefined
        },
        include: { images: true }
      });
    }

    console.log(`✅ [PRODUCT SAVED TO DB]: ${product.title} (ID: ${product.id})`);
    clearProductCache();

    const { colorImages } = req.body;

    res.json({
      success: true,
      product: {
        ...product,
        isNewArrival: isNewArrival !== undefined ? isNewArrival : product.collection === 'new-arrivals',
        isReadyToShip: isReadyToShip !== undefined ? isReadyToShip : product.collection === 'ready-to-ship',
        color: color || (colors && colors[0]) || 'Pink',
        colors: Array.isArray(colors) ? colors : (color ? [color] : ['Pink']),
        colorImages: colorImages || {},
        stock: stock !== undefined ? parseInt(stock) : 50
      }
    });
  } catch (err) {
    console.error("❌ Update product failed:", err.message);
    res.status(500).json({ success: false, message: err.message || 'Failed to update product' });
  }
};

// DELETE /api/admin/products/:id
exports.deleteProduct = async (req, res) => {
  const { id } = req.params;

  try {
    await prisma.productImage.deleteMany({ where: { productId: id } }).catch(() => {});
    await prisma.productVariant.deleteMany({ where: { productId: id } }).catch(() => {});
    await prisma.cartItem.deleteMany({ where: { productId: id } }).catch(() => {});
    await prisma.wishlist.deleteMany({ where: { productId: id } }).catch(() => {});

    const existing = await prisma.product.findUnique({ where: { id } });
    if (existing) {
      await prisma.product.delete({ where: { id } });
    }

    console.log(`✅ [PRODUCT DELETED]: ID ${id}`);
    clearProductCache();
    return res.json({ success: true, message: 'Product deleted successfully' });
  } catch (err) {
    console.warn("⚠️ Delete product handled gracefully:", err.message);
    return res.json({ success: true, message: 'Product removed' });
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
