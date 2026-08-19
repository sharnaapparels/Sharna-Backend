const prisma = require('../config/database');

// GET /api/wishlist
exports.getWishlist = async (req, res) => {
  try {
    const wishlistRecords = await prisma.wishlist.findMany({
      where: { userId: req.user.id },
      include: { product: { include: { images: true } } }
    });
    const wishlist = wishlistRecords
      .filter(w => w.product)
      .map(w => ({
        ...w.product,
        id: w.product.id,
        title: w.product.title,
        price: w.product.price,
        image: w.product.images?.[0]?.url || w.product.image || '',
        images: w.product.images
      }));
    res.json({ success: true, wishlist });
  } catch (err) {
    console.error('Error fetching wishlist:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch wishlist' });
  }
};

// POST /api/wishlist
exports.addToWishlist = async (req, res) => {
  try {
    const { productId } = req.body;
    if (!productId) {
      return res.status(400).json({ success: false, message: 'Product ID is required' });
    }

    // Verify product exists in database first
    const productExists = await prisma.product.findUnique({
      where: { id: String(productId) },
      select: { id: true }
    });

    if (!productExists) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    const item = await prisma.wishlist.upsert({
      where: { userId_productId: { userId: req.user.id, productId: String(productId) } },
      update: {},
      create: { userId: req.user.id, productId: String(productId) }
    });
    res.status(201).json({ success: true, item });
  } catch (err) {
    console.error('Error adding to wishlist:', err);
    res.status(500).json({ success: false, message: 'Failed to add to wishlist' });
  }
};

// DELETE /api/wishlist/:productId
exports.removeFromWishlist = async (req, res) => {
  try {
    const { productId } = req.params;
    await prisma.wishlist.deleteMany({
      where: { userId: req.user.id, productId: String(productId) }
    });
    res.json({ success: true, message: 'Removed from wishlist' });
  } catch (err) {
    console.error('Error removing from wishlist:', err);
    res.status(500).json({ success: false, message: 'Failed to remove from wishlist' });
  }
};

// POST /api/wishlist/sync
exports.syncWishlist = async (req, res) => {
  try {
    const { productIds = [] } = req.body;
    if (!req.user || !Array.isArray(productIds)) {
      return res.status(400).json({ success: false, message: 'Invalid payload' });
    }

    const cleanIds = productIds
      .map(item => (typeof item === 'object' ? (item.id || item._id) : item))
      .filter(Boolean)
      .map(String);

    if (cleanIds.length > 0) {
      const existingProducts = await prisma.product.findMany({
        where: { id: { in: cleanIds } },
        select: { id: true }
      });
      const validDbIds = new Set(existingProducts.map(p => p.id));

      for (const validId of validDbIds) {
        try {
          await prisma.wishlist.upsert({
            where: { userId_productId: { userId: req.user.id, productId: validId } },
            update: {},
            create: { userId: req.user.id, productId: validId }
          });
        } catch (_) {}
      }
    }

    const updatedWishlistRecords = await prisma.wishlist.findMany({
      where: { userId: req.user.id },
      include: { product: { include: { images: true } } }
    });

    const wishlist = updatedWishlistRecords
      .filter(w => w.product)
      .map(w => ({
        ...w.product,
        id: w.product.id,
        title: w.product.title,
        price: w.product.price,
        image: w.product.images?.[0]?.url || w.product.image || '',
        images: w.product.images
      }));

    res.json({ success: true, wishlist });
  } catch (err) {
    console.error('Error syncing wishlist:', err);
    res.status(500).json({ success: false, message: 'Failed to sync wishlist' });
  }
};

// POST /api/wishlist/send-reminder
exports.sendAbandonedWishlistReminder = async (req, res) => {
  const { sendEmailInvoice, sendWishlistReminderEmail } = require('../utils/email.service');
  const { sendWhatsAppWishlistReminder } = require('../utils/whatsapp.service');

  const { items: payloadItems, email: customEmail, phone: customPhone } = req.body || {};

  let targetEmail = customEmail;
  let targetPhone = customPhone;
  let userName = 'Valued Customer';
  let itemsToNotify = [];

  if (req.user) {
    const userObj = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (userObj) {
      targetEmail = targetEmail || userObj.email;
      targetPhone = targetPhone || userObj.phone;
      userName = userObj.name || userName;
    }
  }

  if (Array.isArray(payloadItems) && payloadItems.length > 0) {
    itemsToNotify = payloadItems;
  } else if (req.user) {
    const dbWishlist = await prisma.wishlist.findMany({
      where: { userId: req.user.id },
      include: { product: { include: { images: true } } }
    });
    itemsToNotify = dbWishlist.map(w => ({
      id: w.product.id,
      title: w.product.title,
      price: w.product.price,
      category: w.product.category,
      image: w.product.images?.[0]?.url || ''
    }));
  }

  if (itemsToNotify.length === 0) {
    return res.status(400).json({ success: false, message: 'Wishlist is empty, no reminder sent.' });
  }

  const results = { emailSent: false, whatsappSent: false };

  // Send Email Reminder
  if (targetEmail) {
    try {
      await sendWishlistReminderEmail(targetEmail, { name: userName, items: itemsToNotify });
      results.emailSent = true;
    } catch (err) {
      console.error('Wishlist email reminder error:', err.message);
    }
  }

  // Send WhatsApp Reminder
  if (targetPhone) {
    try {
      await sendWhatsAppWishlistReminder(targetPhone, { name: userName, items: itemsToNotify });
      results.whatsappSent = true;
    } catch (err) {
      console.error('Wishlist WhatsApp reminder error:', err.message);
    }
  }

  res.json({
    success: true,
    message: 'Wishlist reminder dispatched successfully!',
    sentTo: { email: targetEmail || null, phone: targetPhone || null },
    itemCount: itemsToNotify.length,
    results
  });
};

