const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');

/**
 * Generate Exact Matching Luxury SHARNA Tax Invoice PDF
 * @param {Object} order - Full order object
 * @returns {Promise<Buffer>}
 */
const generateInvoicePDFBuffer = (order = {}) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 25, size: 'A4' });
      const buffers = [];

      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', (err) => reject(err));

      const pageWidth = doc.page.width;
      const pageHeight = doc.page.height;
      const margin = 25;
      const contentWidth = pageWidth - margin * 2;

      // Extract details
      let parsedNotes = {};
      if (order.notes) {
        try {
          parsedNotes = typeof order.notes === 'string' ? JSON.parse(order.notes) : order.notes;
        } catch (e) {}
      }

      const orderNumber = order.id || order.orderNumber || `SH-${Date.now().toString().slice(-6)}`;
      const invoiceNo = `#${orderNumber}`;
      const invoiceDate = new Date(order.createdAt || Date.now()).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });

      const customerName = parsedNotes.shippingName || order.shippingAddress?.fullName || order.user?.name || 'Priyanshu Lokhande';
      const customerEmail = parsedNotes.shippingEmail || order.user?.email || 'customer@sharna.in';
      const customerPhone = parsedNotes.shippingPhone || order.shippingAddress?.phone || order.user?.phone || '+91 62682 18135';

      const street = order.shippingAddress?.streetAddress || order.shippingStreet || 'At, post';
      const city = order.shippingAddress?.city || order.shippingCity || 'Jabalpur';
      const state = order.shippingAddress?.state || order.shippingState || 'Madhya Pradesh';
      const pincode = order.shippingAddress?.postalCode || order.shippingPostalCode || '482001';
      const country = order.shippingAddress?.country || order.shippingCountry || 'India';
      const fullAddress = `${street}, ${city}, ${state} - ${pincode}, ${country}`;

      const totalAmount = Number(order.totalAmount || 0);
      const shippingAmount = Number(order.shippingAmount || 0);
      const subtotalAmount = totalAmount - shippingAmount;

      const gstRate = 0.12;
      const taxableValue = Math.round(subtotalAmount / (1 + gstRate));
      const totalGst = subtotalAmount - taxableValue;

      const formatINR = (val) => 'Rs. ' + Math.round(Number(val || 0)).toLocaleString('en-IN');

      // ── 1. BACKGROUND CONTAINER ──
      doc.rect(margin, margin, contentWidth, pageHeight - margin * 2)
         .fillAndStroke('#FAF7F2', '#E5D8C8');

      // Gold dashed inner border accent
      doc.lineWidth(1)
         .dash(4, { space: 4 })
         .rect(margin + 6, margin + 6, contentWidth - 12, pageHeight - margin * 2 - 12)
         .stroke('#C5A86B')
         .undash();

      // ── 2. HEADER ──
      const headerTop = margin + 20;
      const logoPath = path.join(__dirname, '../assets/logo.png');

      if (fs.existsSync(logoPath)) {
        try {
          doc.image(logoPath, margin + 20, headerTop, { height: 42 });
        } catch (e) {}
      }

      const textStartX = margin + (fs.existsSync(logoPath) ? 68 : 20);
      doc.fillColor('#1E1915')
         .fontSize(22)
         .font('Helvetica-Bold')
         .text('SHARNA', textStartX, headerTop + 4, { characterSpacing: 2 });

      doc.fillColor('#C5A86B')
         .fontSize(7.5)
         .font('Helvetica-Bold')
         .text("WOMEN'S ETHNIC LUXURY • SAREES • KURTAS • SUITS", textStartX, headerTop + 28, { characterSpacing: 1 });

      // Right Burgundy Badge
      const badgeWidth = 140;
      const badgeX = pageWidth - margin - 20 - badgeWidth;
      doc.rect(badgeX, headerTop, badgeWidth, 22).fill('#6B3E3E');

      doc.fillColor('#FAF7F2')
         .fontSize(8.5)
         .font('Helvetica-Bold')
         .text('OFFICIAL TAX INVOICE', badgeX, headerTop + 6, { width: badgeWidth, align: 'center', characterSpacing: 1 });

      doc.fillColor('#5C4E46')
         .fontSize(8.5)
         .font('Helvetica')
         .text(`Invoice #: ${invoiceNo}`, badgeX - 40, headerTop + 28, { width: badgeWidth + 40, align: 'right' })
         .text(`Date: ${invoiceDate}`, badgeX - 40, headerTop + 40, { width: badgeWidth + 40, align: 'right' });

      // Header bottom burgundy line
      const headerLineY = headerTop + 60;
      doc.strokeColor('#6B3E3E').lineWidth(1.5)
         .moveTo(margin + 20, headerLineY)
         .lineTo(pageWidth - margin - 20, headerLineY)
         .stroke();

      // ── 3. TWO INFO CARDS (SELLER & BUYER) ──
      const cardsY = headerLineY + 14;
      const cardWidth = (contentWidth - 50) / 2;
      const cardHeight = 135;

      // Card 1: Seller
      const card1X = margin + 20;
      doc.rect(card1X, cardsY, cardWidth, cardHeight).fillAndStroke('#FFFFFF', '#EAE1D5');

      doc.fillColor('#6B3E3E').fontSize(8.5).font('Helvetica-Bold')
         .text('SELLER & SUPPLIER DETAILS', card1X + 12, cardsY + 10, { characterSpacing: 0.8 });

      doc.fillColor('#1E1915').fontSize(9).font('Helvetica-Bold')
         .text('SHARNA Luxury Ethnic Apparel', card1X + 12, cardsY + 26);

      doc.fillColor('#5C4E46').fontSize(8).font('Helvetica')
         .text('Studio & Flagship Headquarters', card1X + 12, cardsY + 39)
         .text('Jabalpur, Madhya Pradesh – 482001, India', card1X + 12, cardsY + 50)
         .text('GSTIN: 23AAGCS1234F1Z9', card1X + 12, cardsY + 63, { font: 'Helvetica-Bold' })
         .text('Support Phone: +91 62682 18135', card1X + 12, cardsY + 76)
         .text('Support Email: sharnaapparels@gmail.com', card1X + 12, cardsY + 88)
         .text('Website: https://sharna.in', card1X + 12, cardsY + 100);

      // Card 2: Buyer
      const card2X = card1X + cardWidth + 10;
      doc.rect(card2X, cardsY, cardWidth, cardHeight).fillAndStroke('#FFFFFF', '#EAE1D5');

      doc.fillColor('#6B3E3E').fontSize(8.5).font('Helvetica-Bold')
         .text('BILLED & SHIPPED TO', card2X + 12, cardsY + 10, { characterSpacing: 0.8 });

      doc.fillColor('#5C4E46').fontSize(8).font('Helvetica')
         .text('Customer Name: ', card2X + 12, cardsY + 26, { continued: true })
         .fillColor('#1E1915').font('Helvetica-Bold').text(customerName)
         .fillColor('#5C4E46').font('Helvetica')
         .text('Address: ', card2X + 12, cardsY + 39, { continued: true })
         .fillColor('#1E1915').text(fullAddress, { width: cardWidth - 24 })
         .fillColor('#5C4E46')
         .text('Phone: ', card2X + 12, cardsY + 76, { continued: true })
         .fillColor('#1E1915').font('Helvetica-Bold').text(customerPhone)
         .fillColor('#5C4E46').font('Helvetica')
         .text('Email: ', card2X + 12, cardsY + 90, { continued: true })
         .fillColor('#1E1915').font('Helvetica-Bold').text(customerEmail);

      // ── 4. TABLE OF ITEMS ──
      const tableY = cardsY + cardHeight + 14;
      const tableInnerWidth = contentWidth - 40;

      // Table Header (Dark Burgundy)
      doc.rect(margin + 20, tableY, tableInnerWidth, 22).fill('#6B3E3E');

      doc.fillColor('#FAF7F2').fontSize(8).font('Helvetica-Bold')
         .text('#', margin + 26, tableY + 7, { width: 20, align: 'center' })
         .text('ITEM DESCRIPTION', margin + 50, tableY + 7, { width: 190 })
         .text('SIZE / COLOR', margin + 245, tableY + 7, { width: 100, align: 'center' })
         .text('QTY', margin + 350, tableY + 7, { width: 35, align: 'center' })
         .text('UNIT PRICE', margin + 390, tableY + 7, { width: 65, align: 'right' })
         .text('TOTAL (INR)', margin + 460, tableY + 7, { width: 65, align: 'right' });

      // Rows
      let rowY = tableY + 22;
      const items = order.items && order.items.length > 0 ? order.items : [
        { title: 'Blush Toga Co-ord Set (2 Pcs)', size: 'M', color: 'green', quantity: 1, price: totalAmount || 18500 }
      ];

      items.forEach((item, index) => {
        const itemTitle = item.product?.title || item.title || 'SHARNA Luxury Outfit';
        const itemSize = item.size || 'M';
        const itemColor = item.color || 'Standard';
        const itemQty = Number(item.quantity || 1);
        const itemPrice = Number(item.price || 0);
        const itemTotal = itemPrice * itemQty;

        // Row background
        doc.rect(margin + 20, rowY, tableInnerWidth, 34).fillAndStroke('#FFFFFF', '#F0E6D8');

        // Item Index
        doc.fillColor('#7A6960').fontSize(8.5).font('Helvetica-Bold')
           .text(String(index + 1), margin + 26, rowY + 11, { width: 20, align: 'center' });

        // Title & HSN
        doc.fillColor('#1E1915').fontSize(9).font('Helvetica-Bold')
           .text(itemTitle, margin + 50, rowY + 7, { width: 190 });

        doc.fillColor('#8A796E').fontSize(7.5).font('Helvetica')
           .text('HSN Code: 6204 • Handcrafted Ethnic Garment', margin + 50, rowY + 19, { width: 190 });

        // Size & Color Badges
        const badge1X = margin + 245;
        doc.rect(badge1X, rowY + 8, 44, 16).fillAndStroke('#FAF4EB', '#EAE1D5');
        doc.fillColor('#5C4E46').fontSize(7.5).font('Helvetica')
           .text(`Size: ${itemSize}`, badge1X, rowY + 12, { width: 44, align: 'center' });

        const badge2X = badge1X + 48;
        doc.rect(badge2X, rowY + 8, 54, 16).fillAndStroke('#FAF4EB', '#EAE1D5');
        doc.fillColor('#5C4E46').fontSize(7.5).font('Helvetica')
           .text(`Color: ${itemColor}`, badge2X, rowY + 12, { width: 54, align: 'center' });

        // Qty, Unit Price, Total
        doc.fillColor('#1E1915').fontSize(9).font('Helvetica-Bold')
           .text(String(itemQty), margin + 350, rowY + 11, { width: 35, align: 'center' });

        doc.fillColor('#5C4E46').fontSize(8.5).font('Helvetica')
           .text(formatINR(itemPrice), margin + 390, rowY + 11, { width: 65, align: 'right' });

        doc.fillColor('#1E1915').fontSize(9).font('Helvetica-Bold')
           .text(formatINR(itemTotal), margin + 460, rowY + 11, { width: 65, align: 'right' });

        rowY += 34;
      });

      // ── 5. SUMMARY BOXES (PAYMENT & TOTALS) ──
      const summaryY = Math.max(rowY + 14, tableY + 80);
      const sumCardWidth = (contentWidth - 50) / 2;
      const sumCardHeight = 90;

      // Left Box: Payment Status
      const leftSumX = margin + 20;
      doc.rect(leftSumX, summaryY, sumCardWidth, sumCardHeight).fillAndStroke('#FFFFFF', '#EAE1D5');

      doc.fillColor('#27AE60').fontSize(8.5).font('Helvetica-Bold')
         .text('✔ PAYMENT CONFIRMED (PAID ONLINE)', leftSumX + 12, summaryY + 12);

      doc.fillColor('#5C4E46').fontSize(8).font('Helvetica')
         .text('Transaction Processed via Razorpay Secured Gateway.', leftSumX + 12, summaryY + 28, { font: 'Helvetica-Bold' })
         .text('All taxes (CGST 6% + SGST 6%) are included in total amount as per Indian GST Regulations.', leftSumX + 12, summaryY + 44, { width: sumCardWidth - 24 });

      // Right Box: Totals Breakdown
      const rightSumX = leftSumX + sumCardWidth + 10;
      doc.rect(rightSumX, summaryY, sumCardWidth, sumCardHeight).fillAndStroke('#FFFFFF', '#EAE1D5');

      doc.fillColor('#5C4E46').fontSize(8).font('Helvetica')
         .text('Item Subtotal (Excl. Tax):', rightSumX + 12, summaryY + 10)
         .text(formatINR(taxableValue), rightSumX + sumCardWidth - 85, summaryY + 10, { width: 73, align: 'right' });

      doc.text('Estimated GST (12%):', rightSumX + 12, summaryY + 23)
         .text(formatINR(totalGst), rightSumX + sumCardWidth - 85, summaryY + 23, { width: 73, align: 'right' });

      doc.text('Shipping & Logistics:', rightSumX + 12, summaryY + 36);
      doc.fillColor('#27AE60').font('Helvetica-Bold')
         .text(shippingAmount === 0 ? 'Complimentary' : formatINR(shippingAmount), rightSumX + sumCardWidth - 95, summaryY + 36, { width: 83, align: 'right' });

      // Total Bar
      doc.strokeColor('#EAE1D5').lineWidth(0.5)
         .moveTo(rightSumX + 10, summaryY + 52)
         .lineTo(rightSumX + sumCardWidth - 10, summaryY + 52)
         .stroke();

      doc.fillColor('#1E1915').fontSize(11).font('Helvetica-Bold')
         .text('TOTAL PAID:', rightSumX + 12, summaryY + 62);

      doc.fillColor('#1E1915').fontSize(12).font('Helvetica-Bold')
         .text(formatINR(totalAmount), rightSumX + sumCardWidth - 115, summaryY + 60, { width: 103, align: 'right' });

      // ── 6. FOOTER ──
      const footerY = pageHeight - margin - 35;
      doc.fillColor('#7A6960').fontSize(7.5).font('Helvetica')
         .text('Thank you for choosing SHARNA. For returns, exchanges or support inquiries, please contact sharnaapparels@gmail.com.', margin + 20, footerY, { width: contentWidth - 40, align: 'center' })
         .text('This is a computer-generated official tax receipt. No signature is required.', margin + 20, footerY + 11, { width: contentWidth - 40, align: 'center' });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
};

module.exports = { generateInvoicePDFBuffer };
