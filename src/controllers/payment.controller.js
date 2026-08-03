const Razorpay = require('razorpay');
const crypto = require('crypto');
const prisma = require('../config/database');
const { sendWhatsAppInvoice } = require('../utils/whatsapp.service');
const { sendEmailInvoice } = require('../utils/email.service');

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

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
    try {
      razorpayOrder = await razorpay.orders.create(options);
    } catch (rzpErr) {
      console.error("Razorpay order creation error:", rzpErr);
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
      // Find matching products in DB for the order items
      const orderItemsToCreate = [];
      if (items && Array.isArray(items)) {
        for (const item of items) {
          // Look up product in DB by ID or title
          let dbProduct = await prisma.product.findFirst({
            where: {
              OR: [
                { id: item.id || item.productId || '' },
                { title: item.title || '' }
              ]
            }
          });

          // Fallback: if not found, grab first product in the DB to satisfy foreign key
          if (!dbProduct) {
            dbProduct = await prisma.product.findFirst();
          }

          if (dbProduct) {
            orderItemsToCreate.push({
              productId: dbProduct.id,
              quantity: item.quantity || 1,
              price: Number(item.price) || 0,
              size: item.selectedSize || item.size || 'S',
              color: item.selectedColor || item.color || 'Default'
            });
          }
        }
      }

      // Create order in DB
      const order = await prisma.order.create({
        data: {
          userId: req.user.id,
          totalAmount: amount,
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
            product: true
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
        color: item.color || 'Default'
      }))
    };

    // ─── AUTOMATED SHIPROCKET DISPATCH ──────────────────────────────────────────
    try {
      const { createShiprocketOrder } = require('../utils/shiprocket.service');
      const shipmentResult = await createShiprocketOrder(orderWithDetails);

      if (shipmentResult && shipmentResult.awbCode) {
        let existingNotes = {};
        if (orderWithDetails.notes) {
          try { existingNotes = JSON.parse(orderWithDetails.notes); } catch (e) {}
        }

        const updatedNotes = JSON.stringify({
          ...existingNotes,
          shipmentId: shipmentResult.shipmentId,
          awbCode: shipmentResult.awbCode,
          courierName: shipmentResult.courierName,
          trackingUrl: shipmentResult.trackingUrl,
          shippedAt: new Date().toISOString()
        });

        // Automatically set status to SHIPPED in database
        await prisma.order.update({
          where: { id: orderWithDetails.id },
          data: {
            status: 'SHIPPED',
            notes: updatedNotes
          }
        });

        orderDetails.awbCode = shipmentResult.awbCode;
        orderDetails.courierName = shipmentResult.courierName;
        orderDetails.trackingUrl = shipmentResult.trackingUrl;
      }
    } catch (shipErr) {
      console.warn("Automated Shiprocket dispatch background warning:", shipErr);
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

  const razorpaySecret = process.env.RAZORPAY_KEY_SECRET;
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
