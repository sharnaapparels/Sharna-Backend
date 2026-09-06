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

  const verifiedShipping = 0; // Complimentary free shipping
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

    // If order not found, return 404 error
    if (!order) {
      if (id === 'test' || id === 'sample') {
        order = {
          id: 'SAMPLE-ORDER-1001',
          orderNumber: 'SAMPLE-ORDER-1001',
          createdAt: new Date(),
          totalAmount: 1850,
          shippingAmount: 0,
          notes: JSON.stringify({
            shippingName: 'Valued Customer',
            shippingEmail: 'customer@sharna.in',
            shippingPhone: '+91 9999999999'
          }),
          user: { name: 'Valued Customer', email: 'customer@sharna.in', phone: '9999999999' },
          shippingStreet: 'Main Commercial Hub',
          shippingCity: 'Jabalpur',
          shippingState: 'Madhya Pradesh',
          shippingPostalCode: '482001',
          shippingCountry: 'India',
          items: [
            {
              title: 'Luxury Ethnic Outfit',
              quantity: 1,
              price: 1850,
              size: 'M',
              color: 'Default'
            }
          ]
        };
      } else {
        return res.status(404).json({ success: false, message: 'Order not found' });
      }
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

// GET /api/orders/:id/invoice (HTML Web View)
exports.viewInvoiceHTML = async (req, res) => {
  const { id } = req.params;
  const { generateInvoiceHTML } = require('../utils/invoiceHtmlTemplate');

  try {
    let order = null;
    if (id && id !== 'test' && id !== 'sample') {
      order = await prisma.order.findFirst({
        where: {
          OR: [{ id: id }, { razorpayOrderId: id }]
        },
        include: {
          user: { select: { name: true, email: true, phone: true } },
          items: { include: { product: true } }
        }
      });
    }

    if (!order) {
      if (id === 'test' || id === 'sample') {
        order = {
          id: 'SAMPLE-ORDER-1001',
          orderNumber: 'SAMPLE-ORDER-1001',
          createdAt: new Date(),
          totalAmount: 1800,
          shippingAmount: 0,
          notes: JSON.stringify({
            shippingName: 'Valued Customer',
            shippingEmail: 'customer@sharna.in',
            shippingPhone: '+91 9999999999'
          }),
          user: { name: 'Valued Customer', email: 'customer@sharna.in', phone: '9999999999' },
          shippingStreet: 'Main Commercial Hub',
          shippingCity: 'Jabalpur',
          shippingState: 'Madhya Pradesh',
          shippingPostalCode: '482001',
          shippingCountry: 'India',
          items: [
            {
              title: 'Luxury Ethnic Outfit',
              quantity: 1,
              price: 1800,
              size: 'M',
              color: 'Default'
            }
          ]
        };
      } else {
        return res.status(404).send('<h2>Order Not Found</h2>');
      }
    }

    const html = generateInvoiceHTML(order);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(html);
  } catch (error) {
    console.error('Error rendering HTML invoice:', error);
    return res.status(500).send('Failed to load invoice');
  }
};

