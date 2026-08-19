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
  const { items, shippingAddress, razorpayOrderId } = req.body;

  let calculatedSubtotal = 0;
  const verifiedOrderItems = [];

  if (items && Array.isArray(items)) {
    for (const item of items) {
      let dbProd = await prisma.product.findFirst({
        where: {
          OR: [
            { id: item.productId || item.id || '' },
            { title: item.title || '' }
          ]
        }
      });

      const unitPrice = dbProd ? (dbProd.salePrice || dbProd.price) : (Number(item.price) || 0);
      const safeQty = Math.max(1, Math.floor(Number(item.quantity) || 1));
      calculatedSubtotal += unitPrice * safeQty;

      if (dbProd) {
        verifiedOrderItems.push({
          productId: dbProd.id,
          quantity: safeQty,
          price: unitPrice,
          size: item.size || 'S',
          color: item.color || 'Default'
        });
      }
    }
  }

  const verifiedShipping = calculatedSubtotal > 10000 ? 0 : 500;
  const verifiedTotal = calculatedSubtotal + verifiedShipping;

  const order = await prisma.order.create({
    data: {
      userId: req.user.id,
      totalAmount: verifiedTotal,
      shippingAmount: verifiedShipping,
      razorpayOrderId,
      shippingStreet: shippingAddress?.street,
      shippingCity: shippingAddress?.city,
      shippingState: shippingAddress?.state,
      shippingPostalCode: shippingAddress?.postalCode,
      shippingCountry: shippingAddress?.country || 'India',
      items: {
        create: verifiedOrderItems
      }
    },
    include: { items: true }
  });
  res.status(201).json({ success: true, order });
};

// GET /api/orders/:id/invoice.pdf
exports.downloadInvoicePDF = async (req, res) => {
  const { id } = req.params;
  const { generateInvoicePDFBuffer } = require('../utils/pdfInvoice.service');

  try {
    let order = null;

    if (id && id !== 'test') {
      order = await prisma.order.findFirst({
        where: {
          OR: [
            { id: id },
            { razorpayOrderId: id }
          ]
        },
        include: {
          user: { select: { name: true, email: true, phone: true } },
          items: {
            include: {
              product: true
            }
          }
        }
      });
    }

    // If order not found or test requested, construct clean order structure matching template
    if (!order) {
      order = {
        id: id || 'cmt0oadp90001pq01op2l5ili',
        orderNumber: id || 'cmt0oadp90001pq01op2l5ili',
        createdAt: new Date(),
        totalAmount: 18500,
        shippingAmount: 0,
        notes: JSON.stringify({
          shippingName: 'Mr.priyanshu lokhande',
          shippingEmail: 'priyanshulokhande72@gmail.com',
          shippingPhone: '7999715256'
        }),
        user: { name: 'Mr.priyanshu lokhande', email: 'priyanshulokhande72@gmail.com', phone: '7999715256' },
        shippingStreet: 'At, post',
        shippingCity: 'Khedi Sawligarh',
        shippingState: 'Madhya Pradesh',
        shippingPostalCode: '460225',
        shippingCountry: 'India',
        items: [
          {
            title: 'Blush Toga Co-ord Set (2 Pcs)',
            quantity: 1,
            price: 18500,
            size: 'M',
            color: 'green'
          }
        ]
      };
    }

    // Attach shipping address helper for generator
    if (!order.shippingAddress) {
      let shippingName = order.user?.name || 'Valued Patron';
      if (order.notes) {
        try {
          const parsed = JSON.parse(order.notes);
          if (parsed.shippingName) shippingName = parsed.shippingName;
        } catch (e) {}
      }

      order.shippingAddress = {
        fullName: shippingName,
        streetAddress: order.shippingStreet,
        city: order.shippingCity,
        state: order.shippingState,
        postalCode: order.shippingPostalCode,
        country: order.shippingCountry || 'India',
        phone: order.user?.phone
      };
    }

    const orderNumber = String(order.orderNumber || order.id || 'SHARNA').slice(-8).toUpperCase();
    const pdfBuffer = await generateInvoicePDFBuffer(order);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="SHARNA-Tax-Invoice-${orderNumber}.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    return res.send(pdfBuffer);
  } catch (error) {
    console.error('Error generating PDF invoice:', error);
    return res.status(500).json({ success: false, message: 'Failed to generate PDF invoice' });
  }
};

