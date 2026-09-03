const Razorpay = require('razorpay');
const crypto = require('crypto');
const prisma = require('../config/database');
const { sendWhatsAppInvoice } = require('../utils/whatsapp.service');
const { sendEmailInvoice } = require('../utils/email.service');

const getRazorpayInstance = () => {
  const key_id = (process.env.RAZORPAY_KEY_ID || '').trim();
  const key_secret = (process.env.RAZORPAY_KEY_SECRET || '').trim();
  return new Razorpay({ key_id, key_secret });
};

// POST /api/payment/create-order
exports.createOrder = async (req, res) => {
  const { amount, shippingAddress, items } = req.body;

  try {
    const options = {
      amount: Math.round(amount * 100), // paise
      currency: 'INR',
      receipt: `receipt_${Date.now()}`
    };

    let razorpayOrder = null;
    const razorpay = getRazorpayInstance();
    try {
      razorpayOrder = await razorpay.orders.create(options);
    } catch (rzpErr) {
      console.error("Razorpay order creation error:", rzpErr?.error || rzpErr?.message || rzpErr);
      if (process.env.NODE_ENV === 'production') {
        return res.status(500).json({ 
          success: false, 
          message: 'Payment gateway failed to initialize order. Please try again.' 
        });
      }
      // Development testing fallback only
      razorpayOrder = {
        id: `order_mock_${Date.now()}`,
        amount: options.amount,
        currency: 'INR'
      };
    }

    let dbOrderId = `db_mock_${Date.now()}`;
    try {
      let calculatedSubtotal = 0;
      const orderItemsToCreate = [];
      if (items && Array.isArray(items)) {
        for (const item of items) {
          let dbProduct = await prisma.product.findFirst({
            where: {
              OR: [
                { id: item.id || item.productId || '' },
                { title: item.title || '' }
              ]
            }
          });

          if (!dbProduct) {
            dbProduct = await prisma.product.findFirst();
          }

          if (dbProduct) {
            const unitPrice = dbProduct.salePrice || dbProduct.price;
            const safeQty = Math.max(1, Math.floor(Number(item.quantity) || 1));
            calculatedSubtotal += unitPrice * safeQty;

            orderItemsToCreate.push({
              productId: dbProduct.id,
              quantity: safeQty,
              price: unitPrice,
              size: item.selectedSize || item.size || 'S',
              color: item.selectedColor || item.color || 'Default'
            });
          }
        }
      }

      const verifiedShipping = 0; // Complimentary free shipping
      const verifiedTotal = calculatedSubtotal > 0 ? (calculatedSubtotal + verifiedShipping) : amount;

      // Resolve user ID (authenticated user or fallback guest user)
      let activeUserId = req.user?.id;
      if (!activeUserId) {
        const guestPhone = shippingAddress?.phone || '9999999999';
        const guestEmail = shippingAddress?.email || 'guest@sharna.in';
        const guestUser = await prisma.user.upsert({
          where: { phone: guestPhone },
          update: { name: shippingAddress?.name || 'Guest Customer' },
          create: {
            phone: guestPhone,
            email: guestEmail,
            name: shippingAddress?.name || 'Guest Customer',
            password: '',
            isVerified: true
          }
        });
        activeUserId = guestUser.id;
      }

      // Create order in DB
      const order = await prisma.order.create({
        data: {
          userId: activeUserId,
          totalAmount: verifiedTotal,
          shippingAmount: verifiedShipping,
          razorpayOrderId: razorpayOrder.id,
          paymentStatus: 'PENDING',
          status: 'PENDING',
          shippingStreet: shippingAddress?.street || '',
          shippingCity: shippingAddress?.city || '',
          shippingState: shippingAddress?.state || '',
          shippingPostalCode: shippingAddress?.postalCode || '',
          shippingCountry: shippingAddress?.country || 'India',
          notes: JSON.stringify({
            shippingName: shippingAddress?.name,
            shippingEmail: shippingAddress?.email,
            shippingPhone: shippingAddress?.phone
          }),
          items: {
            create: orderItemsToCreate
          }
        }
      });
      dbOrderId = order.id;
    } catch (dbErr) {
      console.error("Database order creation failed:", dbErr);
      if (process.env.NODE_ENV === 'production') {
        return res.status(500).json({ success: false, message: 'Failed to record order details.' });
      }
    }

    res.json({
      success: true,
      order: razorpayOrder,
      dbOrderId: dbOrderId,
      keyId: process.env.RAZORPAY_KEY_ID
    });
  } catch (err) {
    console.error("Create order failed:", err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

const triggerInvoiceNotifications = async (orderId) => {
  if (!orderId || orderId.startsWith('db_mock_')) {
    console.log("⚠️ Cannot trigger notifications for mock DB order ID:", orderId);
    return;
  }

  try {
    const orderWithDetails = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        user: true,
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

    if (!orderWithDetails) {
      console.warn("⚠️ Order not found for sending invoice notifications:", orderId);
      return;
    }

    let shippingName = orderWithDetails.user.name;
    let shippingEmail = orderWithDetails.user.email;
    let shippingPhone = orderWithDetails.user.phone;

    if (orderWithDetails.notes) {
      try {
        const parsedNotes = JSON.parse(orderWithDetails.notes);
        if (parsedNotes.shippingName) shippingName = parsedNotes.shippingName;
        if (parsedNotes.shippingEmail) shippingEmail = parsedNotes.shippingEmail;
        if (parsedNotes.shippingPhone) shippingPhone = parsedNotes.shippingPhone;
      } catch (e) {
        // Ignore JSON parse errors
      }
    }

    const orderDetails = {
      orderId: orderWithDetails.id,
      totalAmount: orderWithDetails.totalAmount,
      shippingAmount: orderWithDetails.shippingAmount || 0,
      shippingName,
      shippingStreet: orderWithDetails.shippingStreet || '',
      shippingCity: orderWithDetails.shippingCity || '',
      shippingState: orderWithDetails.shippingState || '',
      shippingPostalCode: orderWithDetails.shippingPostalCode || '',
      shippingCountry: orderWithDetails.shippingCountry || 'India',
      items: orderWithDetails.items.map(item => ({
        title: item.product?.title || 'Luxury Product',
        price: item.price,
        quantity: item.quantity,
        size: item.size || 'S',
        color: item.color || 'Default',
        image: item.product?.images?.find(img => img.isPrimary)?.url || item.product?.images?.[0]?.url || item.product?.image || ''
      }))
    };

    // Update order status to CONFIRMED and paymentStatus to PAID
    try {
      await prisma.order.update({
        where: { id: orderWithDetails.id },
        data: {
          status: 'CONFIRMED',
          paymentStatus: 'PAID'
        }
      });
    } catch (dbErr) {
      console.warn("Order confirmation update warning:", dbErr);
    }

    // Asynchronously send invoices in background (non-blocking)
    if (shippingEmail) {
      sendEmailInvoice(shippingEmail, orderDetails).catch(err => 
        console.error("Email send background error:", err)
      );
    }

    if (shippingPhone) {
      sendWhatsAppInvoice(shippingPhone, orderDetails).catch(err => 
        console.error("WhatsApp send background error:", err)
      );
    }
  } catch (err) {
    console.error("Failed to fetch order details or send invoice notifications:", err);
  }
};

// POST /api/payment/verify
exports.verifyPayment = async (req, res) => {
  const { razorpayOrderId, razorpayPaymentId, razorpaySignature, orderId } = req.body;

  const isMockRequest = (razorpayOrderId && razorpayOrderId.startsWith('order_mock_')) || (orderId && orderId.startsWith('db_mock_'));

  // Strictly block mock payment exploits in production
  if (process.env.NODE_ENV === 'production' && isMockRequest) {
    return res.status(400).json({
      success: false,
      message: 'Payment verification failed: Mock payment processing is prohibited in production.'
    });
  }

  // Development testing mode fallback
  if (isMockRequest) {
    if (orderId && !orderId.startsWith('db_mock_')) {
      try {
        await prisma.order.update({
          where: { id: orderId },
          data: {
            paymentStatus: 'PAID',
            status: 'CONFIRMED'
          }
        });
        triggerInvoiceNotifications(orderId);
      } catch (err) {
        console.error("Failed to update mock order in DB:", err);
      }
    }
    return res.json({ 
      success: true, 
      order: {
        id: orderId,
        paymentStatus: 'PAID',
        status: 'CONFIRMED'
      } 
    });
  }

  // Validate strict presence of Razorpay parameters
  if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
    return res.status(400).json({
      success: false,
      message: 'Payment verification failed: Missing required Razorpay credentials.'
    });
  }

  const razorpaySecret = (process.env.RAZORPAY_KEY_SECRET || '').trim();
  if (!razorpaySecret) {
    return res.status(500).json({
      success: false,
      message: 'Payment verification failed: Missing Razorpay Key Secret configuration.'
    });
  }

  const body = razorpayOrderId + '|' + razorpayPaymentId;
  const expectedSignature = crypto
    .createHmac('sha256', razorpaySecret)
    .update(body.toString())
    .digest('hex');

  if (expectedSignature !== razorpaySignature) {
    return res.status(400).json({ 
      success: false, 
      message: 'Payment verification failed: Invalid HMAC signature.' 
    });
  }

  try {
    // Update order status securely
    const order = await prisma.order.update({
      where: { id: orderId },
      data: {
        razorpayPaymentId,
        razorpaySignature,
        paymentStatus: 'PAID',
        status: 'CONFIRMED'
      }
    });

    // Trigger Notifications & Auto-Shipment
    triggerInvoiceNotifications(orderId);

    res.json({ success: true, order });
  } catch (dbErr) {
    console.error("Database payment verification update failed:", dbErr);
    res.status(500).json({
      success: false,
      message: 'Failed to record payment verification in database.'
    });
  }
};
