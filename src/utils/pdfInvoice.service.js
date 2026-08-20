const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');

/**
 * Generate 100% Exact Matching Luxury SHARNA Tax Invoice PDF
 * - Uses Brand Kit Typography (Times-Bold for Luxury Serif Accents, Helvetica for Details)
 * - Brand Name: SHARNA (sharna.in)
 * - Header has zero overlap: Logo on left, Official Tax Invoice Badge on right
 * - Clean aligned table & summary boxes with perfect margins
 */
const generateInvoicePDFBuffer = (order = {}) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 0, size: 'A4' });
      const buffers = [];

      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', (err) => reject(err));

      const pageWidth = doc.page.width; // 595.28 pt

      // Extract details
      let parsedNotes = {};
      if (order.notes) {
        try {
          parsedNotes = typeof order.notes === 'string' ? JSON.parse(order.notes) : order.notes;
        } catch (e) {}
      }

      const rawId = order.id || order.orderNumber || 'cmt0oadp90001pq01op2l5ili';
      const cleanOrderId = String(rawId).replace(/^#+/, '');
      const invoiceNo = `#${cleanOrderId}`;
      const invoiceDate = new Date(order.createdAt || Date.now()).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });

      const customerName = parsedNotes.shippingName || order.shippingAddress?.fullName || order.user?.name || 'Mr.priyanshu lokhande';
      const customerEmail = parsedNotes.shippingEmail || order.user?.email || 'priyanshulokhande72@gmail.com';
      const customerPhone = parsedNotes.shippingPhone || order.shippingAddress?.phone || order.user?.phone || '7999715256';

      const street = order.shippingAddress?.streetAddress || order.shippingStreet || 'At, post';
      const city = order.shippingAddress?.city || order.shippingCity || 'Khedi Sawligarh';
      const state = order.shippingAddress?.state || order.shippingState || 'Madhya Pradesh';
      const pincode = order.shippingAddress?.postalCode || order.shippingPostalCode || '460225';
      const country = order.shippingCountry || order.shippingAddress?.country || 'India';

      const totalAmount = Number(order.totalAmount || 18500);
      const shippingAmount = Number(order.shippingAmount || 0);
      const subtotalAmount = totalAmount - shippingAmount;

      const gstRate = 0.12;
      const taxableValue = Math.round(subtotalAmount / (1 + gstRate));
      const totalGst = subtotalAmount - taxableValue;

      const formatPrice = (val) => 'Rs. ' + Math.round(Number(val || 0)).toLocaleString('en-IN');

      // ── 1. BACKGROUND & GOLD DASHED BORDER ──
      const boxLeft = 24;
      const boxTop = 24;
      const boxWidth = pageWidth - boxLeft * 2; // 547.28 pt
      const boxHeight = 520;

      // Outer parchment box
      doc.rect(boxLeft, boxTop, boxWidth, boxHeight)
         .fillAndStroke('#FAF7F2', '#E5D8C8');

      // Inner gold dashed border
      doc.lineWidth(1)
         .dash(4, { space: 4 })
         .rect(boxLeft + 6, boxTop + 6, boxWidth - 12, boxHeight - 12)
         .stroke('#C5A86B')
         .undash();

      // ── 2. BRAND HEADER ──
      const headerTop = 44;
      const logoPath = path.join(__dirname, '../assets/logo.png');

      // Draw Logo Image (Golden Swan + Serif SHARNA)
      if (fs.existsSync(logoPath)) {
        try {
          doc.image(logoPath, 42, headerTop - 2, { height: 42 });
        } catch (e) {}
      }

      // Tagline beside Logo (No Sarees, Clean Luxury)
      doc.fillColor('#C5A86B')
         .fontSize(7)
         .font('Times-Bold')
         .text("WOMEN'S ETHNIC LUXURY", 190, headerTop + 13, { characterSpacing: 1, lineBreak: false })
         .text("CO-ORDS • KURTAS • SUITS", 190, headerTop + 24, { characterSpacing: 1, lineBreak: false });

      // Right Burgundy Badge
      const badgeWidth = 145;
      const badgeX = boxLeft + boxWidth - 18 - badgeWidth; // 408.28 pt
      doc.roundedRect(badgeX, headerTop - 2, badgeWidth, 21, 2).fill('#6B3E3E');

      doc.fillColor('#FAF7F2')
         .fontSize(9)
         .font('Times-Bold')
         .text('OFFICIAL TAX INVOICE', badgeX, headerTop + 5, { width: badgeWidth, align: 'center', characterSpacing: 1, lineBreak: false });

      // Meta: Invoice # and Date
      doc.fillColor('#7A6960')
         .fontSize(8)
         .font('Helvetica')
         .text('Invoice #:', badgeX - 40, headerTop + 26, { width: badgeWidth + 40, align: 'right', lineBreak: false });

      doc.fillColor('#1E1915')
         .fontSize(8.5)
         .font('Helvetica-Bold')
         .text(invoiceNo, badgeX - 40, headerTop + 37, { width: badgeWidth + 40, align: 'right', lineBreak: false });

      doc.fillColor('#7A6960')
         .fontSize(8)
         .font('Helvetica')
         .text(`Date: ${invoiceDate}`, badgeX - 40, headerTop + 49, { width: badgeWidth + 40, align: 'right', lineBreak: false });

      // Header bottom divider line
      const headerLineY = headerTop + 65;
      doc.strokeColor('#6B3E3E').lineWidth(1.5)
         .moveTo(42, headerLineY)
         .lineTo(boxLeft + boxWidth - 18, headerLineY)
         .stroke();

      // ── 3. SELLER & BUYER CARDS ──
      const cardsY = headerLineY + 12;
      const cardWidth = (boxWidth - 48) / 2; // 249.6 pt
      const cardHeight = 126;

      // Card 1: Seller Details
      const card1X = 42;
      doc.rect(card1X, cardsY, cardWidth, cardHeight).fillAndStroke('#FFFFFF', '#EAE1D5');

      doc.fillColor('#6B3E3E').fontSize(9).font('Times-Bold')
         .text('SELLER & SUPPLIER DETAILS', card1X + 12, cardsY + 9, { lineBreak: false });

      doc.strokeColor('#EAE1D5').lineWidth(0.5)
         .moveTo(card1X + 12, cardsY + 21)
         .lineTo(card1X + cardWidth - 12, cardsY + 21)
         .stroke();

      doc.fillColor('#1E1915').fontSize(9).font('Times-Bold')
         .text('SHARNA (sharna.in)', card1X + 12, cardsY + 27, { lineBreak: false });

      doc.fillColor('#5C4E46').fontSize(8).font('Helvetica')
         .text('Studio & Flagship Headquarters', card1X + 12, cardsY + 40, { lineBreak: false })
         .text('Jabalpur, Madhya Pradesh – 482001, India', card1X + 12, cardsY + 52, { lineBreak: false });

      doc.text('GSTIN: ', card1X + 12, cardsY + 65, { lineBreak: false });
      doc.fillColor('#1E1915').font('Helvetica-Bold')
         .text('23AAGCS1234F1Z9', card1X + 46, cardsY + 65, { lineBreak: false });

      doc.fillColor('#5C4E46').font('Helvetica')
         .text('Support Phone: ', card1X + 12, cardsY + 78, { lineBreak: false });
      doc.fillColor('#1E1915').font('Helvetica-Bold')
         .text('+91 62682 18135', card1X + 80, cardsY + 78, { lineBreak: false });

      doc.fillColor('#5C4E46').font('Helvetica')
         .text('Support Email: ', card1X + 12, cardsY + 91, { lineBreak: false });
      doc.fillColor('#1E1915').font('Helvetica-Bold')
         .text('support@sharna.in', card1X + 76, cardsY + 91, { lineBreak: false });

      doc.fillColor('#5C4E46').font('Helvetica')
         .text('Website: ', card1X + 12, cardsY + 104, { lineBreak: false });
      doc.fillColor('#1E1915').font('Helvetica-Bold')
         .text('https://sharna.in', card1X + 54, cardsY + 104, { lineBreak: false });

      // Card 2: Billed & Shipped To
      const card2X = card1X + cardWidth + 12;
      doc.rect(card2X, cardsY, cardWidth, cardHeight).fillAndStroke('#FFFFFF', '#EAE1D5');

      doc.fillColor('#6B3E3E').fontSize(9).font('Times-Bold')
         .text('BILLED & SHIPPED TO', card2X + 12, cardsY + 9, { lineBreak: false });

      doc.strokeColor('#EAE1D5').lineWidth(0.5)
         .moveTo(card2X + 12, cardsY + 21)
         .lineTo(card2X + cardWidth - 12, cardsY + 21)
         .stroke();

      doc.fillColor('#5C4E46').fontSize(8).font('Helvetica')
         .text('Customer Name: ', card2X + 12, cardsY + 27, { lineBreak: false });
      doc.fillColor('#1E1915').font('Helvetica-Bold').fontSize(8.5)
         .text(customerName, card2X + 84, cardsY + 27, { width: cardWidth - 96, lineBreak: false });

      doc.fillColor('#5C4E46').font('Helvetica').fontSize(8)
         .text('Address: ', card2X + 12, cardsY + 40, { lineBreak: false });
      doc.fillColor('#1E1915').font('Helvetica-Bold')
         .text(street, card2X + 54, cardsY + 40, { lineBreak: false });

      doc.fillColor('#5C4E46').font('Helvetica')
         .text(`${city}, ${state} – ${pincode}, ${country}`, card2X + 12, cardsY + 52, { width: cardWidth - 24, lineBreak: false });

      doc.fillColor('#5C4E46')
         .text('Phone: ', card2X + 12, cardsY + 78, { lineBreak: false });
      doc.fillColor('#1E1915').font('Helvetica-Bold')
         .text(customerPhone, card2X + 48, cardsY + 78, { lineBreak: false });

      doc.fillColor('#5C4E46').font('Helvetica')
         .text('Email: ', card2X + 12, cardsY + 91, { lineBreak: false });
      doc.fillColor('#1E1915').font('Helvetica-Bold')
         .text(customerEmail, card2X + 42, cardsY + 91, { width: cardWidth - 54, lineBreak: false });

      // ── 4. ITEMS TABLE ──
      const tableY = cardsY + cardHeight + 12;
      const tableWidth = boxWidth - 36; // 511.28 pt

      // Burgundy Table Header Bar
      doc.rect(42, tableY, tableWidth, 22).fill('#6B3E3E');

      doc.fillColor('#FAF7F2').fontSize(8.5).font('Times-Bold')
         .text('#', 46, tableY + 6, { width: 22, align: 'center', lineBreak: false })
         .text('ITEM DESCRIPTION', 76, tableY + 6, { width: 195, lineBreak: false })
         .text('SIZE / COLOR', 272, tableY + 6, { width: 95, align: 'center', lineBreak: false })
         .text('QTY', 370, tableY + 6, { width: 35, align: 'center', lineBreak: false })
         .text('UNIT PRICE', 405, tableY + 6, { width: 65, align: 'right', lineBreak: false })
         .text('TOTAL (INR)', 472, tableY + 6, { width: 70, align: 'right', lineBreak: false });

      // Table Item Rows
      let rowY = tableY + 22;
      const items = order.items && order.items.length > 0 ? order.items : [
        { title: 'Blush Toga Co-ord Set (2 Pcs)', size: 'M', color: 'green', quantity: 1, price: totalAmount }
      ];

      items.forEach((item, index) => {
        const itemTitle = item.product?.title || item.title || 'Blush Toga Co-ord Set (2 Pcs)';
        const itemSize = item.size || 'M';
        const itemColor = item.color || 'green';
        const itemQty = Number(item.quantity || 1);
        const itemPrice = Number(item.price || totalAmount);
        const itemTotal = itemPrice * itemQty;

        // White row background
        doc.rect(42, rowY, tableWidth, 34).fillAndStroke('#FFFFFF', '#F0E6D8');

        // Item Index
        doc.fillColor('#7A6960').fontSize(8.5).font('Helvetica')
           .text(String(index + 1), 46, rowY + 11, { width: 22, align: 'center', lineBreak: false });

        // Title + HSN
        doc.fillColor('#1E1915').fontSize(9).font('Helvetica-Bold')
           .text(itemTitle, 76, rowY + 7, { width: 195, lineBreak: false });

        doc.fillColor('#8A796E').fontSize(7.5).font('Helvetica')
           .text('HSN Code: 6204 • Handcrafted Ethnic Garment', 76, rowY + 19, { width: 195, lineBreak: false });

        // Pill Badges for Size & Color
        const badge1X = 272;
        doc.rect(badge1X, rowY + 9, 44, 15).fillAndStroke('#FAF4EB', '#EAE1D5');
        doc.fillColor('#5C4E46').fontSize(7.5).font('Helvetica')
           .text(`Size: ${itemSize}`, badge1X, rowY + 12, { width: 44, align: 'center', lineBreak: false });

        const badge2X = badge1X + 48;
        doc.rect(badge2X, rowY + 9, 54, 15).fillAndStroke('#FAF4EB', '#EAE1D5');
        doc.fillColor('#5C4E46').fontSize(7.5).font('Helvetica')
           .text(`Color: ${itemColor}`, badge2X, rowY + 12, { width: 54, align: 'center', lineBreak: false });

        // Qty, Price, Amount
        doc.fillColor('#1E1915').fontSize(9).font('Helvetica-Bold')
           .text(String(itemQty), 370, rowY + 11, { width: 35, align: 'center', lineBreak: false });

        doc.fillColor('#5C4E46').fontSize(8.5).font('Helvetica')
           .text(formatPrice(itemPrice), 405, rowY + 11, { width: 65, align: 'right', lineBreak: false });

        doc.fillColor('#1E1915').fontSize(9.5).font('Helvetica-Bold')
           .text(formatPrice(itemTotal), 472, rowY + 11, { width: 70, align: 'right', lineBreak: false });

        rowY += 34;
      });

      // ── 5. SUMMARY CARDS ──
      const summaryY = rowY + 12;
      const sumCardWidth = (boxWidth - 48) / 2;
      const sumCardHeight = 88;

      // Left Box: Payment Status
      const leftSumX = 42;
      doc.rect(leftSumX, summaryY, sumCardWidth, sumCardHeight).fillAndStroke('#FFFFFF', '#EAE1D5');

      doc.fillColor('#27AE60').fontSize(8.5).font('Helvetica-Bold')
         .text('✔ PAYMENT CONFIRMED (PAID ONLINE)', leftSumX + 12, summaryY + 10, { lineBreak: false });

      doc.fillColor('#5C4E46').fontSize(8).font('Helvetica')
         .text('Transaction Processed via ', leftSumX + 12, summaryY + 24, { lineBreak: false });
      doc.fillColor('#1E1915').font('Helvetica-Bold')
         .text('Razorpay Secured Gateway.', leftSumX + 118, summaryY + 24, { lineBreak: false });

      doc.fillColor('#5C4E46').font('Helvetica').fontSize(7.5)
         .text('All taxes (CGST 6% + SGST 6%) are included in total amount as per Indian GST Regulations.', leftSumX + 12, summaryY + 38, { width: sumCardWidth - 24 });

      // Right Box: Totals Breakdown
      const rightSumX = leftSumX + sumCardWidth + 12;
      doc.rect(rightSumX, summaryY, sumCardWidth, sumCardHeight).fillAndStroke('#FFFFFF', '#EAE1D5');

      doc.fillColor('#5C4E46').fontSize(8).font('Helvetica')
         .text('Item Subtotal (Excl. Tax):', rightSumX + 12, summaryY + 10, { lineBreak: false })
         .text(formatPrice(taxableValue), rightSumX + sumCardWidth - 100, summaryY + 10, { width: 88, align: 'right', lineBreak: false });

      doc.text('Estimated GST (12%):', rightSumX + 12, summaryY + 23, { lineBreak: false })
         .text(formatPrice(totalGst), rightSumX + sumCardWidth - 100, summaryY + 23, { width: 88, align: 'right', lineBreak: false });

      doc.text('Shipping & Logistics:', rightSumX + 12, summaryY + 36, { lineBreak: false });
      doc.fillColor('#27AE60').font('Helvetica-Bold')
         .text(shippingAmount === 0 ? 'Complimentary' : formatPrice(shippingAmount), rightSumX + sumCardWidth - 110, summaryY + 36, { width: 98, align: 'right', lineBreak: false });

      // Total Bar
      doc.strokeColor('#EAE1D5').lineWidth(0.5)
         .moveTo(rightSumX + 10, summaryY + 50)
         .lineTo(rightSumX + sumCardWidth - 10, summaryY + 50)
         .stroke();

      doc.fillColor('#6B3E3E').fontSize(11).font('Times-Bold')
         .text('TOTAL PAID:', rightSumX + 12, summaryY + 60, { lineBreak: false });

      doc.fillColor('#6B3E3E').fontSize(12).font('Times-Bold')
         .text(formatPrice(totalAmount), rightSumX + sumCardWidth - 120, summaryY + 60, { width: 108, align: 'right', lineBreak: false });

      // ── 6. FOOTER ──
      const footerY = summaryY + sumCardHeight + 14;
      doc.fillColor('#7A6960').fontSize(7.5).font('Helvetica')
         .text('Thank you for choosing SHARNA. For returns, exchanges or support inquiries, please visit https://sharna.in or email support@sharna.in.', 42, footerY, { width: boxWidth - 36, align: 'center', lineBreak: false })
         .text('This is a computer-generated official tax receipt. No signature is required.', 42, footerY + 11, { width: boxWidth - 36, align: 'center', lineBreak: false });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
};

module.exports = { generateInvoicePDFBuffer };
