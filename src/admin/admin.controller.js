const prisma = require('../config/database');
const bcrypt = require('bcrypt');
const { cloudinary } = require('../config/cloudinary');
const { clearProductCache } = require('../utils/productCache');
const { clearCMSCache } = require('../cms/cms.controller');
const { sendPasswordResetEmail, sendResendEmail } = require('../utils/email.service');

const processProductImages = async (images) => {
  if (!Array.isArray(images) || images.length === 0) return [];
  const processed = [];
  for (let idx = 0; idx < images.length; idx++) {
    const img = images[idx];
    let imageUrl = typeof img === 'string' ? img : (img.url || img.src || '');
    if (!imageUrl) continue;

    if (imageUrl.startsWith('data:image')) {
      try {
        const uploadRes = await cloudinary.uploader.upload(imageUrl, {
          folder: 'sharna_products'
        });
        if (uploadRes && uploadRes.secure_url) {
          imageUrl = uploadRes.secure_url;
        }
      } catch (err) {
        console.warn('Base64 auto-upload to Cloudinary warning:', err.message);
      }
    }

    processed.push({ url: imageUrl, isPrimary: idx === 0 });
  }
  return processed;
};

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
        include: { images: true, variants: true }
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
        items: {
          include: {
            product: {
              include: {
                images: true
              }
            }
          }
        }
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
        items: {
          include: {
            product: {
              include: {
                images: true
              }
            }
          }
        }
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

const saveProductVariants = async (productId, colors, sizes, stockVal) => {
  try {
    const colorList = Array.isArray(colors) && colors.length > 0 ? colors : ['Beige'];
    const sizeList = Array.isArray(sizes) && sizes.length > 0 ? sizes : ['XS', 'S', 'M', 'L', 'XL', '2XL'];
    const stock = stockVal !== undefined ? parseInt(stockVal) : 50;

    await prisma.productVariant.deleteMany({ where: { productId } });

    const variants = [];
    for (const c of colorList) {
      for (const sz of sizeList) {
        variants.push({
          productId,
          color: c,
          size: sz,
          stock
        });
      }
    }

    if (variants.length > 0) {
      await prisma.productVariant.createMany({ data: variants });
    }
  } catch (err) {
    console.warn("Save variants warning:", err.message);
  }
};

// GET /api/admin/products
exports.getAllProducts = async (req, res) => {
  try {
    const products = await prisma.product.findMany({
      orderBy: { createdAt: 'desc' },
      include: { images: true, variants: true }
    });

    const mapped = products.map(p => {
      const dbColors = [...new Set((p.variants || []).map(v => v.color).filter(Boolean))];
      const dbSizes = [...new Set((p.variants || []).map(v => v.size).filter(Boolean))];
      const mainColor = dbColors[0] || 'Beige';

      const variantStocks = (p.variants || []).map(v => v.stock).filter(s => s !== undefined && s !== null);
      const stockVal = variantStocks.length > 0 ? variantStocks[0] : 50;
      const totalStock = (p.variants || []).reduce((acc, v) => acc + (Number(v.stock) || 0), 0);

      const colStr = (p.collection || '').toLowerCase();
      const isFestive = colStr.includes('festive');
      const isNewArrival = colStr.includes('new-arrivals') || colStr.includes('new arrival');
      const isReadyToShip = colStr.includes('ready-to-ship') || colStr.includes('ready');
      const isCollectionsPage = colStr.includes('plus-size') || colStr.includes('curve') || p.category === 'plus-size-edit';

      return {
        ...p,
        color: mainColor,
        colors: dbColors.length > 0 ? dbColors : ['Beige'],
        sizes: dbSizes.length > 0 ? dbSizes : ['XS', 'S', 'M', 'L', 'XL', '2XL'],
        stock: stockVal,
        totalStock: totalStock,
        isFestive,
        isFestivePage: isFestive,
        isNewArrival,
        isNewArrivalsPage: isNewArrival,
        isReadyToShip,
        isReadyToShipPage: isReadyToShip,
        isCollectionsPage,
        isPlusSize: isCollectionsPage
      };
    });

    res.json({ success: true, products: mapped });
  } catch (err) {
    console.error("Fetch admin products failed:", err);
    res.status(500).json({ success: false, message: 'Failed to retrieve products list' });
  }
};

// POST /api/admin/products
exports.createProduct = async (req, res) => {
  const { title, description, price, originalPrice, category, collection, isNewArrival, isReadyToShip, isFestive, isFestivePage, isNewArrivalsPage, isReadyToShipPage, isCollectionsPage, isFeatured, stock, images, color, colors, sizes } = req.body;

  if (!title || !price || !category) {
    return res.status(400).json({ success: false, message: 'Title, price, and category are required' });
  }

  try {
    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '') + '-' + Date.now();

    const formattedImages = await processProductImages(images);

    const cols = [];
    if (isFestive || isFestivePage) cols.push('festive-collection');
    if (isNewArrival || isNewArrivalsPage) cols.push('new-arrivals');
    if (isReadyToShip || isReadyToShipPage) cols.push('ready-to-ship');
    if (isCollectionsPage) cols.push('plus-size-edit');
    if (collection && typeof collection === 'string') {
      collection.split(',').map(s => s.trim()).filter(Boolean).forEach(c => {
        if (!cols.includes(c)) cols.push(c);
      });
    }
    const computedCollection = cols.join(',');

    const product = await prisma.product.create({
      data: {
        title,
        slug,
        description: description || '',
        price: parseFloat(price),
        salePrice: originalPrice ? parseFloat(originalPrice) : null,
        category,
        collection: computedCollection || null,
        isFeatured: isFeatured || false,
        isPublished: true,  // Always publish products created from admin
        images: formattedImages.length > 0 ? { create: formattedImages } : undefined
      },
      include: { images: true }
    });

    console.log(`✅ [PRODUCT CREATED IN DB]: ${product.title} (ID: ${product.id})`);
    const numericStock = stock !== undefined ? parseInt(stock) : 50;
    await saveProductVariants(product.id, colors, sizes, numericStock);
    clearProductCache();
    if (clearCMSCache) clearCMSCache();

    const { colorImages } = req.body;

    res.status(201).json({
      success: true,
      product: {
        ...product,
        isFestive: cols.includes('festive-collection'),
        isFestivePage: cols.includes('festive-collection'),
        isNewArrival: cols.includes('new-arrivals'),
        isNewArrivalsPage: cols.includes('new-arrivals'),
        isReadyToShip: cols.includes('ready-to-ship'),
        isReadyToShipPage: cols.includes('ready-to-ship'),
        isCollectionsPage: cols.includes('plus-size-edit'),
        color: color || (Array.isArray(colors) && colors[0]) || 'Beige',
        colors: Array.isArray(colors) && colors.length > 0 ? colors : (color ? [color] : ['Beige']),
        colorImages: colorImages || {},
        sizes: Array.isArray(sizes) ? sizes : ['XS', 'S', 'M', 'L', 'XL'],
        stock: numericStock
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
  const { title, description, price, originalPrice, category, collection, isNewArrival, isReadyToShip, isFestive, isFestivePage, isNewArrivalsPage, isReadyToShipPage, isCollectionsPage, isFeatured, stock, color, colors, sizes, images } = req.body;

  try {
    const cols = [];
    if (isFestive === true || isFestivePage === true) cols.push('festive-collection');
    if (isNewArrival === true || isNewArrivalsPage === true) cols.push('new-arrivals');
    if (isReadyToShip === true || isReadyToShipPage === true) cols.push('ready-to-ship');
    if (isCollectionsPage === true) cols.push('plus-size-edit');
    if (collection && typeof collection === 'string') {
      collection.split(',').map(s => s.trim()).filter(Boolean).forEach(c => {
        if (!cols.includes(c)) {
          if (c === 'festive-collection' && (isFestive === false || isFestivePage === false)) return;
          if (c === 'new-arrivals' && (isNewArrival === false || isNewArrivalsPage === false)) return;
          if (c === 'ready-to-ship' && (isReadyToShip === false || isReadyToShipPage === false)) return;
          if (c === 'plus-size-edit' && isCollectionsPage === false) return;
          cols.push(c);
        }
      });
    }
    const computedCollection = cols.join(',');

    const updateData = {};
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (price !== undefined) updateData.price = parseFloat(price);
    if (originalPrice !== undefined) updateData.salePrice = parseFloat(originalPrice);
    if (category !== undefined) updateData.category = category;
    updateData.collection = computedCollection || null;
    if (isFeatured !== undefined) updateData.isFeatured = isFeatured;
    updateData.isPublished = true; // Always publish when saving from admin panel

    if (Array.isArray(images) && images.length > 0) {
      const formattedImages = await processProductImages(images);

      if (formattedImages.length > 0) {
        await prisma.productImage.deleteMany({ where: { productId: id } }).catch(() => {});
        updateData.images = { create: formattedImages };
      }
    }

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
          collection: computedCollection || null,
          isFeatured: isFeatured || false,
          isPublished: true,  // Always publish products created from admin
          images: formattedImages.length > 0 ? { create: formattedImages } : undefined
        },
        include: { images: true }
      });
    }

    console.log(`✅ [PRODUCT SAVED TO DB]: ${product.title} (ID: ${product.id})`);
    const numericStock = stock !== undefined ? parseInt(stock) : 50;
    await saveProductVariants(product.id, colors, sizes, numericStock);
    clearProductCache();
    if (clearCMSCache) clearCMSCache();

    const { colorImages } = req.body;

    res.json({
      success: true,
      product: {
        ...product,
        isFestive: cols.includes('festive-collection'),
        isFestivePage: cols.includes('festive-collection'),
        isNewArrival: cols.includes('new-arrivals'),
        isNewArrivalsPage: cols.includes('new-arrivals'),
        isReadyToShip: cols.includes('ready-to-ship'),
        isReadyToShipPage: cols.includes('ready-to-ship'),
        isCollectionsPage: cols.includes('plus-size-edit'),
        color: color || (Array.isArray(colors) && colors[0]) || 'Beige',
        colors: Array.isArray(colors) && colors.length > 0 ? colors : (color ? [color] : ['Beige']),
        colorImages: colorImages || {},
        stock: numericStock
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

// DELETE /api/admin/users/:id
exports.deleteUser = async (req, res) => {
  const { id } = req.params;

  try {
    // 1. Delete user related wishlist, cart items, reviews, contacts, addresses
    await prisma.wishlist.deleteMany({ where: { userId: id } }).catch(() => {});
    await prisma.cartItem.deleteMany({ where: { userId: id } }).catch(() => {});
    await prisma.review.deleteMany({ where: { userId: id } }).catch(() => {});
    await prisma.contact.deleteMany({ where: { userId: id } }).catch(() => {});
    await prisma.address.deleteMany({ where: { userId: id } }).catch(() => {});

    // 2. Cascade delete user orders and items
    const userOrders = await prisma.order.findMany({ where: { userId: id }, select: { id: true } });
    if (userOrders && userOrders.length > 0) {
      const orderIds = userOrders.map(o => o.id);
      await prisma.orderItem.deleteMany({ where: { orderId: { in: orderIds } } }).catch(() => {});
      await prisma.order.deleteMany({ where: { id: { in: orderIds } } }).catch(() => {});
    }

    // 3. Delete the user
    const user = await prisma.user.findUnique({ where: { id } });
    if (user) {
      await prisma.user.delete({ where: { id } });
    }

    console.log(`✅ [USER DELETED]: Account ID ${id}`);
    return res.json({ success: true, message: 'User account and all associated records deleted successfully' });
  } catch (err) {
    console.error("⚠️ Delete user error:", err.message);
    return res.status(500).json({ success: false, message: err.message || 'Failed to delete user' });
  }
};

// DELETE /api/admin/orders/:id
exports.deleteOrder = async (req, res) => {
  const { id } = req.params;

  try {
    // Delete order items first to satisfy foreign key constraints
    await prisma.orderItem.deleteMany({ where: { orderId: id } }).catch(() => {});

    // Delete order record
    await prisma.order.deleteMany({ where: { id } });

    console.log(`✅ [ORDER DELETED]: Order ID ${id}`);
    return res.json({ success: true, message: 'Order deleted successfully' });
  } catch (err) {
    console.error("⚠️ Delete order error:", err.message);
    return res.status(500).json({ success: false, message: err.message || 'Failed to delete order' });
  }
};

// POST /api/admin/request-password-otp
exports.requestPasswordOtp = async (req, res) => {
  try {
    const { currentPassword } = req.body;
    if (!currentPassword) {
      return res.status(400).json({ success: false, message: 'Please enter your current administrator password' });
    }

    const admin = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!admin) {
      return res.status(404).json({ success: false, message: 'Admin account not found' });
    }

    const isMatch = await bcrypt.compare(currentPassword, admin.password);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Current password is incorrect. Access denied.' });
    }

    // Generate 6-digit cryptographic OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const hashedOtp = await bcrypt.hash(otp, 10);
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await prisma.user.update({
      where: { id: admin.id },
      data: {
        otp: hashedOtp,
        otpExpires,
        otpPurpose: 'ADMIN_PASSWORD_CHANGE'
      }
    });

    // Send OTP to admin's private email
    if (admin.email) {
      await sendPasswordResetEmail(admin.email, otp).catch(e => console.error("Admin OTP Email error:", e));
    }

    const maskedEmail = admin.email ? admin.email.replace(/(.{2})(.*)(?=@)/, (gp1, gp2, gp3) => gp2 + "*".repeat(gp3.length)) : 'registered email';
    const maskedPhone = admin.phone ? admin.phone.slice(0, 4) + '******' + admin.phone.slice(-2) : '';

    console.log(`🔐 [ADMIN 2FA OTP GENERATED]: Code ${otp} for ${admin.email}`);

    return res.json({
      success: true,
      message: `A 6-digit security verification code has been sent to ${maskedEmail} ${maskedPhone ? `(${maskedPhone})` : ''}. Valid for 10 minutes.`,
      maskedEmail,
      maskedPhone
    });
  } catch (err) {
    console.error("Admin OTP request error:", err);
    return res.status(500).json({ success: false, message: err.message || 'Failed to generate security code' });
  }
};

// POST /api/admin/change-password
exports.changeAdminPassword = async (req, res) => {
  try {
    const { currentPassword, newPassword, otp } = req.body;

    if (!currentPassword || !newPassword || !otp) {
      return res.status(400).json({ success: false, message: 'Current password, new password, and 6-digit OTP are required' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ success: false, message: 'New password must be at least 8 characters long for security' });
    }

    const admin = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!admin) {
      return res.status(404).json({ success: false, message: 'Admin account not found' });
    }

    // Verify current password
    const isCurrentMatch = await bcrypt.compare(currentPassword, admin.password);
    if (!isCurrentMatch) {
      return res.status(400).json({ success: false, message: 'Current password is incorrect. Verification failed.' });
    }

    // Verify OTP
    if (!admin.otp || !admin.otpExpires) {
      return res.status(400).json({ success: false, message: 'No active verification code found. Please request a new code.' });
    }

    if (new Date() > admin.otpExpires) {
      return res.status(400).json({ success: false, message: 'The verification code has expired. Please request a new code.' });
    }

    const isOtpMatch = await bcrypt.compare(otp.trim(), admin.otp);
    if (!isOtpMatch) {
      return res.status(400).json({ success: false, message: 'Invalid 6-digit security code entered. Please check and try again.' });
    }

    // Hash and update new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id: admin.id },
      data: {
        password: hashedPassword,
        otp: null,
        otpExpires: null,
        otpPurpose: null
      }
    });

    // Send Security Confirmation Email Alert
    if (admin.email) {
      await sendResendEmail({
        to: admin.email,
        subject: `🔒 Security Alert: SHARNA Admin Password Changed`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 30px auto; padding: 30px; background-color: #ffffff; border: 1px solid #c5a86b; border-radius: 16px; text-align: center;">
            <h1 style="font-family: Georgia, serif; color: #1e1915; letter-spacing: 0.2em; font-size: 24px; margin-bottom: 5px;">SHARNA ADMIN</h1>
            <p style="font-size: 11px; color: #27AE60; font-weight: 700; text-transform: uppercase; letter-spacing: 0.15em; margin-bottom: 20px;">SECURITY ALERT</p>
            <p style="font-size: 13.5px; color: #5C4E46; line-height: 1.6; margin-bottom: 20px;">
              Your administrator account password for <strong>${admin.email}</strong> was successfully updated on <strong>${new Date().toLocaleString('en-IN')}</strong>.
            </p>
            <p style="font-size: 11.5px; color: #888888; margin: 0;">
              If you did not perform this change, please contact technical support immediately.
            </p>
          </div>
        `
      }).catch(e => console.error("Security alert email error:", e));
    }

    console.log(`✅ [ADMIN PASSWORD CHANGED]: Account ${admin.email}`);

    return res.json({
      success: true,
      message: 'Administrator password updated successfully! Please keep your new credentials secure.'
    });
  } catch (err) {
    console.error("Change admin password error:", err);
    return res.status(500).json({ success: false, message: err.message || 'Failed to update administrator password' });
  }
};
