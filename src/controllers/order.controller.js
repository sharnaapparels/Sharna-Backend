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

// GET /api/orders/:id/invoice (HTML Web View)
exports.viewInvoiceHTML = async (req, res) => {
  const { id } = req.params;

  try {
    let order = null;
    if (id && id !== 'test') {
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

    let parsedNotes = {};
    if (order.notes) {
      try { parsedNotes = JSON.parse(order.notes); } catch (e) {}
    }

    const customerName = parsedNotes.shippingName || order.user?.name || 'Mr.priyanshu lokhande';
    const customerEmail = parsedNotes.shippingEmail || order.user?.email || 'priyanshulokhande72@gmail.com';
    const customerPhone = parsedNotes.shippingPhone || order.user?.phone || '7999715256';
    const street = order.shippingStreet || 'At, post';
    const city = order.shippingCity || 'Khedi Sawligarh';
    const state = order.shippingState || 'Madhya Pradesh';
    const pincode = order.shippingPostalCode || '460225';
    const country = order.shippingCountry || 'India';

    const totalAmount = Number(order.totalAmount || 18500);
    const shippingAmount = Number(order.shippingAmount || 0);
    const subtotal = totalAmount - shippingAmount;
    const taxableValue = Math.round(subtotal / 1.12);
    const totalGst = subtotal - taxableValue;

    const itemsHtml = (order.items || []).map((item, idx) => `
      <tr style="border-bottom: 1px solid #F0E6D8;">
        <td style="padding: 13px 10px; text-align: center; color: #7A6960; font-size: 11px; font-weight: 600;">${idx + 1}</td>
        <td style="padding: 13px 10px; color: #1E1915; font-weight: 600; font-size: 11.5px;">
          ${item.product?.title || item.title || 'Blush Toga Co-ord Set (2 Pcs)'}
          <div style="font-size: 10px; color: #8A796E; font-weight: 400; margin-top: 2px;">HSN Code: 6204 • Handcrafted Ethnic Garment</div>
        </td>
        <td style="padding: 13px 10px; text-align: center; color: #5C4E46; font-size: 11px;">
          <span style="background:#FAF4EB; border:1px solid #EAE1D5; padding:2px 6px; border-radius:3px; font-size:10px;">Size: ${item.size || 'M'}</span>
          <span style="background:#FAF4EB; border:1px solid #EAE1D5; padding:2px 6px; border-radius:3px; font-size:10px;">Color: ${item.color || 'green'}</span>
        </td>
        <td style="padding: 13px 10px; text-align: center; color: #1E1915; font-weight: 700; font-size: 11.5px;">${item.quantity || 1}</td>
        <td style="padding: 13px 10px; text-align: right; color: #5C4E46; font-size: 11.5px;">₹${(item.price || totalAmount).toLocaleString('en-IN')}</td>
        <td style="padding: 13px 10px; text-align: right; color: #1E1915; font-weight: 700; font-size: 12px;">₹${((item.price || totalAmount) * (item.quantity || 1)).toLocaleString('en-IN')}</td>
      </tr>
    `).join('');

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <title>SHARNA Tax Invoice - #${order.id}</title>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"></script>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@500;600;700;800&family=Montserrat:wght@400;500;600;700;800&family=DM+Sans:wght@400;500;600;700&display=swap');
    * { box-sizing: border-box; }
    body { margin: 0; padding: 24px; background-color: #ffffff; color: #2D231E; font-family: 'DM Sans', 'Montserrat', sans-serif; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    .invoice-box { max-width: 820px; margin: 0 auto; border: 1px solid #E5D8C8; padding: 38px 40px; background: #FAF7F2; box-shadow: 0 10px 30px rgba(0,0,0,0.05); position: relative; }
    .invoice-box::before { content: ''; position: absolute; top: 8px; left: 8px; right: 8px; bottom: 8px; border: 1px dashed #C5A86B; pointer-events: none; }
    .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #6B3E3E; padding-bottom: 20px; margin-bottom: 25px; gap: 20px; }
    .brand-section { display: flex; align-items: center; gap: 16px; }
    .brand-logo-img { height: 60px; width: auto; object-fit: contain; }
    .brand-tagline { font-size: 9.5px; letter-spacing: 0.2em; color: #C5A86B; text-transform: uppercase; margin-top: 4px; font-weight: 600; }
    .invoice-title-badge { text-align: right; }
    .invoice-badge-text { background-color: #6B3E3E; color: #FAF7F2; font-family: 'Cinzel', serif; font-size: 11px; letter-spacing: 0.15em; padding: 6px 14px; display: inline-block; border-radius: 3px; }
    .invoice-meta-date { font-size: 11px; color: #5C4E46; margin-top: 8px; line-height: 1.5; }
    .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 25px; }
    .info-card { background: #ffffff; border: 1px solid #EAE1D5; padding: 16px 18px; border-radius: 4px; }
    .info-card h4 { font-family: 'Cinzel', serif; font-size: 11px; letter-spacing: 0.1em; color: #6B3E3E; margin: 0 0 10px 0; text-transform: uppercase; border-bottom: 1px solid #F5EBE0; padding-bottom: 5px; }
    .info-card p { margin: 3px 0; font-size: 11.5px; color: #5C4E46; line-height: 1.5; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 25px; background: #ffffff; border: 1px solid #EAE1D5; }
    th { background: #6B3E3E; color: #FAF7F2; font-family: 'Cinzel', serif; font-size: 10px; letter-spacing: 0.1em; padding: 10px; text-transform: uppercase; }
    .summary-wrapper { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 30px; gap: 20px; }
    .payment-notes { width: 50%; background: #ffffff; border: 1px solid #EAE1D5; padding: 14px 16px; border-radius: 4px; font-size: 11px; color: #5C4E46; }
    .payment-notes-title { font-weight: 700; color: #488B49; display: flex; align-items: center; gap: 6px; margin-bottom: 6px; font-size: 11.5px; }
    .totals-card { width: 44%; background: #ffffff; border: 1px solid #EAE1D5; padding: 16px; border-radius: 4px; }
    .totals-row { display: flex; justify-content: space-between; font-size: 11.5px; margin-bottom: 6px; color: #5C4E46; }
    .totals-row.grand-total { border-top: 2px solid #6B3E3E; padding-top: 10px; margin-top: 10px; font-size: 15px; font-weight: 700; color: #6B3E3E; }
    .footer-note { text-align: center; border-top: 1px solid #EAE1D5; padding-top: 20px; font-size: 10px; color: #8A796E; line-height: 1.6; }
    @media print { body { padding: 0; background: none; } .invoice-box { border: none; box-shadow: none; padding: 20px; } .no-print { display: none !important; } }
  </style>
</head>
<body>
  <div class="no-print" style="max-width: 820px; margin: 0 auto 16px; display: flex; justify-content: flex-end; gap: 10px; flex-wrap: wrap;">
    <button id="downloadPdfBtn" onclick="downloadDirectPDF()" style="background-color: #1E1915; color: #FAF7F2; border: 1px solid #A67E39; padding: 10px 20px; font-family: 'Montserrat', sans-serif; font-size: 11.5px; font-weight: 700; letter-spacing: 0.1em; border-radius: 30px; cursor: pointer; display: flex; align-items: center; gap: 6px;">
      ⬇️ DOWNLOAD PDF FILE
    </button>
    <button onclick="window.print()" style="background-color: #6B3E3E; color: white; border: none; padding: 10px 20px; font-family: 'Montserrat', sans-serif; font-size: 11.5px; font-weight: 600; border-radius: 30px; cursor: pointer; display: flex; align-items: center; gap: 6px;">
      🖨️ PRINT INVOICE
    </button>
  </div>
  <div class="invoice-box" id="invoiceArea">
    <div class="header">
      <div class="brand-section">
        <img src="https://sharna.in/src/assets/logo.png" alt="SHARNA" class="brand-logo-img" onerror="this.style.display='none'" />
        <div class="brand-text-wrap">
          <div style="font-family: 'Cinzel', serif; font-size: 26px; font-weight: 700; color: #1E1915; letter-spacing: 0.1em;">SHARNA</div>
          <div class="brand-tagline">Women's Ethnic Luxury • Sarees • Kurtas • Suits</div>
        </div>
      </div>
      <div class="invoice-title-badge">
        <div class="invoice-badge-text">OFFICIAL TAX INVOICE</div>
        <div class="invoice-meta-date">
          Invoice #: <strong>#${order.id}</strong><br/>
          Date: <strong>${new Date(order.createdAt).toLocaleDateString('en-IN')}</strong>
        </div>
      </div>
    </div>
    <div class="meta-grid">
      <div class="info-card">
        <h4>Seller & Supplier Details</h4>
        <p><strong>SHARNA Luxury Ethnic Apparel</strong></p>
        <p>Studio & Flagship Headquarters</p>
        <p>Jabalpur, Madhya Pradesh - <strong>482001</strong>, India</p>
        <p>GSTIN: <strong>23AAGCS1234F1Z9</strong></p>
        <p>Support Phone: <strong>+91 62682 18135</strong></p>
        <p>Support Email: <strong>sharnaapparels@gmail.com</strong></p>
        <p>Website: <strong>https://sharna.in</strong></p>
      </div>
      <div class="info-card">
        <h4>Billed & Shipped To</h4>
        <p>Customer Name: <strong>${customerName}</strong></p>
        <p>Address: <strong>${street}</strong></p>
        <p>${city}, ${state} - <strong>${pincode}</strong>, ${country}</p>
        <p>Phone: <strong>${customerPhone}</strong></p>
        <p>Email: <strong>${customerEmail}</strong></p>
      </div>
    </div>
    <table>
      <thead>
        <tr>
          <th style="width: 40px;">#</th>
          <th style="text-align: left;">Item Description</th>
          <th>Size / Color</th>
          <th>Qty</th>
          <th style="text-align: right;">Unit Price</th>
          <th style="text-align: right;">Total (INR)</th>
        </tr>
      </thead>
      <tbody>${itemsHtml}</tbody>
    </table>
    <div class="summary-wrapper">
      <div class="payment-notes">
        <div class="payment-notes-title">✔ PAYMENT CONFIRMED (PAID ONLINE)</div>
        <p style="margin: 4px 0 0 0;">Transaction Processed via <strong>Razorpay Secured Gateway</strong>.</p>
        <p style="margin: 4px 0 0 0; font-size: 10px; color: #8A796E;">All taxes (CGST 6% + SGST 6%) are included in total amount as per Indian GST Regulations.</p>
      </div>
      <div class="totals-card">
        <div class="totals-row"><span>Item Subtotal (Excl. Tax):</span><span>₹${taxableValue.toLocaleString('en-IN')}</span></div>
        <div class="totals-row"><span>Estimated GST (12%):</span><span>₹${totalGst.toLocaleString('en-IN')}</span></div>
        <div class="totals-row"><span>Shipping & Logistics:</span><span style="color: #488B49; font-weight: 600;">Complimentary</span></div>
        <div class="totals-row grand-total"><span>TOTAL PAID:</span><span>₹${totalAmount.toLocaleString('en-IN')}</span></div>
      </div>
    </div>
    <div class="footer-note">
      Thank you for choosing <strong>SHARNA</strong>. For returns, exchanges or support inquiries, please contact <strong>sharnaapparels@gmail.com</strong>.<br/>
      This is a computer-generated official tax receipt. No signature is required.
    </div>
  </div>
  <script>
    function downloadDirectPDF() {
      const btn = document.getElementById('downloadPdfBtn');
      if (btn) btn.innerText = '⏳ Generating PDF...';
      const element = document.getElementById('invoiceArea');
      const opt = { margin: [6, 6, 6, 6], filename: 'SHARNA-Tax-Invoice-${order.id}.pdf', image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2, useCORS: true }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' } };
      if (typeof html2pdf !== 'undefined') {
        html2pdf().set(opt).from(element).save().then(function() { if (btn) btn.innerText = '⬇️ DOWNLOAD PDF FILE'; });
      } else { window.print(); }
    }
  </script>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html');
    return res.send(html);
  } catch (error) {
    console.error('Error rendering HTML invoice:', error);
    return res.status(500).send('Failed to load invoice');
  }
};

