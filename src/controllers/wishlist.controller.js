const prisma = require('../config/database');

// GET /api/wishlist
exports.getWishlist = async (req, res) => {
  const wishlist = await prisma.wishlist.findMany({
    where: { userId: req.user.id },
    include: { product: { include: { images: true } } }
  });
  res.json({ success: true, wishlist });
};

// POST /api/wishlist
exports.addToWishlist = async (req, res) => {
  const { productId } = req.body;
  const item = await prisma.wishlist.upsert({
    where: { userId_productId: { userId: req.user.id, productId } },
    update: {},
    create: { userId: req.user.id, productId }
  });
  res.status(201).json({ success: true, item });
};

// DELETE /api/wishlist/:productId
exports.removeFromWishlist = async (req, res) => {
  await prisma.wishlist.deleteMany({
    where: { userId: req.user.id, productId: req.params.productId }
  });
  res.json({ success: true, message: 'Removed from wishlist' });
};

// POST /api/wishlist/sync
exports.syncWishlist = async (req, res) => {
  const { productIds = [] } = req.body;
  if (!req.user || !Array.isArray(productIds)) {
    return res.status(400).json({ success: false, message: 'Invalid payload' });
  }

  // Upsert all product IDs into user wishlist
  for (const productId of productIds) {
    try {
      await prisma.wishlist.upsert({
        where: { userId_productId: { userId: req.user.id, productId } },
        update: {},
        create: { userId: req.user.id, productId }
      });
    } catch (err) {
      // Ignore duplicates/foreign key invalid IDs
    }
  }

  const updatedWishlist = await prisma.wishlist.findMany({
    where: { userId: req.user.id },
    include: { product: { include: { images: true } } }
  });

  res.json({ success: true, wishlist: updatedWishlist });
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

