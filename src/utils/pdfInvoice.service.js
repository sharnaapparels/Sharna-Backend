const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');

/**
 * Generate 100% Official SHARNA Brand Kit Tax Invoice PDF with Proprietor Seal
 * - Supports both Seal options: 'vector' (Clean Digital Seal) and 'real' (Real Inked Physical Stamp)
 * - Perfect vertical & horizontal alignment with zero text overlapping
 * - Official Typography: RudeSlab (Bold, Medium, Book)
 * - Indian Rupee symbol (₹) using NotoSans-Full with zero missing boxes
 */
const generateInvoicePDFBuffer = (order = {}, sealType = 'vector') => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 0, size: 'A4' });
      const buffers = [];

      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', (err) => reject(err));

      const pageWidth = doc.page.width; // 595.28 pt

      // Register Brand Kit Fonts (RudeSlab)
      const fontsDir = path.join(__dirname, '../assets/fonts');
      const rudeSlabBold = path.join(fontsDir, 'RudeSlab-Bold.otf');
      const rudeSlabMedium = path.join(fontsDir, 'RudeSlab-Medium.otf');
      const rudeSlabBook = path.join(fontsDir, 'RudeSlab-Book.otf');
      const notoSans = path.join(fontsDir, 'NotoSans-Full.ttf');

      const fontHeading = fs.existsSync(rudeSlabBold) ? rudeSlabBold : 'Helvetica-Bold';
      const fontMedium = fs.existsSync(rudeSlabMedium) ? rudeSlabMedium : (fs.existsSync(rudeSlabBold) ? rudeSlabBold : 'Helvetica-Bold');
      const fontBook = fs.existsSync(rudeSlabBook) ? rudeSlabBook : (fs.existsSync(notoSans) ? notoSans : 'Helvetica');
      const fontRupee = fs.existsSync(notoSans) ? notoSans : 'Helvetica';

      // Extract details
      let parsedNotes = {};
      if (order.notes) {
        try {
          parsedNotes = typeof order.notes === 'string' ? JSON.parse(order.notes) : order.notes;
        } catch (e) {}
      }

      const rawId = order.id || order.orderNumber || 'cmt1cuunj0001vs1k40h8jtwb';
      const cleanOrderId = String(rawId).replace(/^#+/, '');
      const invoiceNo = `#${cleanOrderId}`;
      const invoiceDate = new Date(order.createdAt || Date.now()).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });

      const customerName = parsedNotes.shippingName || order.shippingAddress?.fullName || order.user?.name || 'Mr.priyanshu lokhande';
      const customerEmail = parsedNotes.shippingEmail || order.user?.email || 'priyanshulokhande72@gmail.com';
      let customerPhone = parsedNotes.shippingPhone || order.shippingAddress?.phone || order.user?.phone || '7999715256';
      if (!customerPhone.startsWith('+')) customerPhone = '+91 ' + customerPhone.replace(/\D/g, '').slice(-10);

      const street = order.shippingAddress?.streetAddress || order.shippingStreet || 'NH548C';
      const city = order.shippingAddress?.city || order.shippingCity || 'Khedi Sawligarh';
      const state = order.shippingAddress?.state || order.shippingState || 'Madhya Pradesh';
      const pincode = order.shippingAddress?.postalCode || order.shippingPostalCode || '460001';
      const country = order.shippingAddress?.country || order.shippingCountry || 'India';

      const totalAmount = Number(order.totalAmount || 2300);
      const shippingAmount = Number(order.shippingAmount || 0);
      const subtotalAmount = totalAmount - shippingAmount;

      const gstRate = 0.12;
      const taxableValue = Math.round(subtotalAmount / (1 + gstRate));
      const totalGst = subtotalAmount - taxableValue;

      const formatINR = (val) => '₹' + Math.round(Number(val || 0)).toLocaleString('en-IN');

      // ── 1. BACKGROUND & GOLD DASHED BORDER ──
      const boxLeft = 24;
      const boxTop = 24;
      const boxWidth = pageWidth - boxLeft * 2; // 547.28 pt
      const boxHeight = 580;

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
      const headerTop = 40;
      const logoPath = path.join(__dirname, '../assets/logo.png');

      // Draw Logo Image (width 140 pt, ends at x=182)
      if (fs.existsSync(logoPath)) {
        try {
          doc.image(logoPath, 42, headerTop, { width: 140 });
        } catch (e) {}
      }

      // Two-Line Tagline beside Logo (starting at x=202 with clean 20 pt gap)
      doc.fillColor('#C5A86B')
         .fontSize(6.8)
         .font(fontMedium)
         .text("WOMEN'S ETHNIC LUXURY • CO-ORDS •", 202, headerTop + 10, { characterSpacing: 0.8, lineBreak: false })
         .text("KURTAS • SUITS", 202, headerTop + 21, { characterSpacing: 0.8, lineBreak: false });

      // Right Burgundy Badge
      const badgeWidth = 142;
      const badgeX = boxLeft + boxWidth - 18 - badgeWidth; // 411.28 pt
      doc.roundedRect(badgeX, headerTop - 2, badgeWidth, 20, 2).fill('#6B3E3E');

      doc.fillColor('#FAF7F2')
         .fontSize(8.5)
         .font(fontHeading)
         .text('OFFICIAL TAX INVOICE', badgeX, headerTop + 4, { width: badgeWidth, align: 'center', characterSpacing: 1, lineBreak: false });

      // Meta: Invoice # and Date
      doc.fillColor('#7A6960')
         .fontSize(7.5)
         .font(fontBook)
         .text('Invoice #:', badgeX - 40, headerTop + 24, { width: badgeWidth + 40, align: 'right', lineBreak: false });

      doc.fillColor('#1E1915')
         .fontSize(8)
         .font(fontHeading)
         .text(invoiceNo, badgeX - 40, headerTop + 35, { width: badgeWidth + 40, align: 'right', lineBreak: false });

      doc.fillColor('#5C4E46')
         .fontSize(7.5)
         .font(fontBook)
         .text(`Date: ${invoiceDate}`, badgeX - 40, headerTop + 47, { width: badgeWidth + 40, align: 'right', lineBreak: false });

      // Header bottom divider line
      const headerLineY = headerTop + 62;
      doc.strokeColor('#6B3E3E').lineWidth(1.5)
         .moveTo(42, headerLineY)
         .lineTo(boxLeft + boxWidth - 18, headerLineY)
         .stroke();

      // ── 3. SELLER & BUYER CARDS (RUDESLAB BRAND TYPOGRAPHY) ──
      const cardsY = headerLineY + 12;
      const cardWidth = (boxWidth - 48) / 2; // 249.6 pt
      const cardHeight = 115;

      // Card 1: Seller Details
      const card1X = 42;
      doc.rect(card1X, cardsY, cardWidth, cardHeight).fillAndStroke('#FFFFFF', '#EAE1D5');

      doc.fillColor('#6B3E3E').fontSize(8.5).font(fontHeading)
         .text('SELLER & SUPPLIER DETAILS', card1X + 12, cardsY + 9, { lineBreak: false });

      doc.strokeColor('#EAE1D5').lineWidth(0.5)
         .moveTo(card1X + 12, cardsY + 21)
         .lineTo(card1X + cardWidth - 12, cardsY + 21)
         .stroke();

      doc.fillColor('#1E1915').fontSize(8.5).font(fontHeading)
         .text('SHARNA (sharna.in)', card1X + 12, cardsY + 28, { lineBreak: false });

      doc.fillColor('#5C4E46').fontSize(7.8).font(fontBook)
         .text('Studio & Flagship Headquarters', card1X + 12, cardsY + 41, { lineBreak: false })
         .text('Jabalpur, Madhya Pradesh – 482001, India', card1X + 12, cardsY + 54, { lineBreak: false });

      doc.font(fontBook).fillColor('#5C4E46')
         .text('Support Phone: ', card1X + 12, cardsY + 70, { continued: true, lineBreak: false })
         .font(fontHeading).fillColor('#1E1915').text('+91 62682 18135', { lineBreak: false });

      doc.font(fontBook).fillColor('#5C4E46')
         .text('Support Email: ', card1X + 12, cardsY + 83, { continued: true, lineBreak: false })
         .font(fontHeading).fillColor('#1E1915').text('support@sharna.in', { lineBreak: false });

      doc.font(fontBook).fillColor('#5C4E46')
         .text('Website: ', card1X + 12, cardsY + 96, { continued: true, lineBreak: false })
         .font(fontHeading).fillColor('#1E1915').text('https://sharna.in', { lineBreak: false });

      // Card 2: Billed & Shipped To
      const card2X = card1X + cardWidth + 12;
      doc.rect(card2X, cardsY, cardWidth, cardHeight).fillAndStroke('#FFFFFF', '#EAE1D5');

      doc.fillColor('#6B3E3E').fontSize(8.5).font(fontHeading)
         .text('BILLED & SHIPPED TO', card2X + 12, cardsY + 9, { lineBreak: false });

      doc.strokeColor('#EAE1D5').lineWidth(0.5)
         .moveTo(card2X + 12, cardsY + 21)
         .lineTo(card2X + cardWidth - 12, cardsY + 21)
         .stroke();

      // Customer Name
      doc.font(fontBook).fontSize(7.8).fillColor('#5C4E46')
         .text('Customer Name: ', card2X + 12, cardsY + 28, { continued: true, lineBreak: false })
         .font(fontHeading).fontSize(8).fillColor('#1E1915').text(customerName, { lineBreak: false });

      // Address
      doc.font(fontBook).fontSize(7.8).fillColor('#5C4E46')
         .text('Address: ', card2X + 12, cardsY + 41, { continued: true, lineBreak: false })
         .font(fontHeading).fillColor('#1E1915').text(street, { lineBreak: false });

      // City, State, Pincode, Country
      doc.font(fontBook).fontSize(7.8).fillColor('#5C4E46')
         .text(`${city}, ${state} – `, card2X + 12, cardsY + 54, { continued: true, lineBreak: false })
         .font(fontHeading).fillColor('#1E1915').text(pincode, { continued: true, lineBreak: false })
         .font(fontBook).fillColor('#5C4E46').text(`, ${country}`, { lineBreak: false });

      // Phone
      doc.font(fontBook).fontSize(7.8).fillColor('#5C4E46')
         .text('Phone: ', card2X + 12, cardsY + 70, { continued: true, lineBreak: false })
         .font(fontHeading).fillColor('#1E1915').text(customerPhone, { lineBreak: false });

      // Email
      doc.font(fontBook).fontSize(7.8).fillColor('#5C4E46')
         .text('Email: ', card2X + 12, cardsY + 83, { continued: true, lineBreak: false })
         .font(fontHeading).fillColor('#1E1915').text(customerEmail, { lineBreak: false });

      // ── 4. ITEMS TABLE ──
      const tableY = cardsY + cardHeight + 12;
      const tableWidth = boxWidth - 36; // 511.28 pt

      // Burgundy Table Header Bar
      doc.rect(42, tableY, tableWidth, 22).fill('#6B3E3E');

      doc.fillColor('#FAF7F2').fontSize(8).font(fontHeading)
         .text('#', 46, tableY + 6, { width: 22, align: 'center', lineBreak: false })
         .text('ITEM DESCRIPTION', 76, tableY + 6, { width: 195, lineBreak: false })
         .text('SIZE / COLOR', 272, tableY + 6, { width: 95, align: 'center', lineBreak: false })
         .text('QTY', 370, tableY + 6, { width: 35, align: 'center', lineBreak: false })
         .text('UNIT PRICE', 405, tableY + 6, { width: 65, align: 'right', lineBreak: false })
         .text('TOTAL (INR)', 472, tableY + 6, { width: 70, align: 'right', lineBreak: false });

      // Table Item Rows
      let rowY = tableY + 22;
      const items = order.items && order.items.length > 0 ? order.items : [
        { title: 'corod set in purple', size: 'XS', color: 'Pink', quantity: 1, price: 1800 }
      ];

      items.forEach((item, index) => {
        const itemTitle = item.product?.title || item.title || 'corod set in purple';
        const itemSize = item.size || 'XS';
        const itemColor = item.color || 'Pink';
        const itemQty = Number(item.quantity || 1);
        const itemPrice = Number(item.price || 1800);
        const itemTotal = itemPrice * itemQty;

        // White row background
        doc.rect(42, rowY, tableWidth, 34).fillAndStroke('#FFFFFF', '#F0E6D8');

        // Item Index
        doc.fillColor('#7A6960').fontSize(8).font(fontBook)
           .text(String(index + 1), 46, rowY + 11, { width: 22, align: 'center', lineBreak: false });

        // Title + HSN
        doc.fillColor('#1E1915').fontSize(8.5).font(fontHeading)
           .text(itemTitle, 76, rowY + 7, { width: 195, lineBreak: false });

        doc.fillColor('#8A796E').fontSize(7).font(fontBook)
           .text('HSN Code: 6204 • Handcrafted Ethnic Garment', 76, rowY + 19, { width: 195, lineBreak: false });

        // Pill Badges for Size & Color
        const badge1X = 272;
        doc.rect(badge1X, rowY + 9, 44, 15).fillAndStroke('#FAF4EB', '#EAE1D5');
        doc.fillColor('#5C4E46').fontSize(7).font(fontBook)
           .text(`Size: ${itemSize}`, badge1X, rowY + 12, { width: 44, align: 'center', lineBreak: false });

        const badge2X = badge1X + 48;
        doc.rect(badge2X, rowY + 9, 54, 15).fillAndStroke('#FAF4EB', '#EAE1D5');
        doc.fillColor('#5C4E46').fontSize(7).font(fontBook)
           .text(`Color: ${itemColor}`, badge2X, rowY + 12, { width: 54, align: 'center', lineBreak: false });

        // Qty, Price, Amount with native Unicode Rupee font
        doc.fillColor('#1E1915').fontSize(8.5).font(fontHeading)
           .text(String(itemQty), 370, rowY + 11, { width: 35, align: 'center', lineBreak: false });

        doc.fillColor('#5C4E46').fontSize(8.5).font(fontRupee)
           .text(formatINR(itemPrice), 405, rowY + 11, { width: 65, align: 'right', lineBreak: false });

        doc.fillColor('#1E1915').fontSize(9).font(fontRupee)
           .text(formatINR(itemTotal), 472, rowY + 11, { width: 70, align: 'right', lineBreak: false });

        rowY += 34;
      });

      // ── 5. SUMMARY CARDS ──
      const summaryY = rowY + 12;
      const sumCardWidth = (boxWidth - 48) / 2;
      const sumCardHeight = 82;

      // Left Box: Payment Status
      const leftSumX = 42;
      doc.rect(leftSumX, summaryY, sumCardWidth, sumCardHeight).fillAndStroke('#FFFFFF', '#EAE1D5');

      doc.fillColor('#488B49').fontSize(8).font(fontHeading)
         .text('PAYMENT CONFIRMED (PAID ONLINE)', leftSumX + 12, summaryY + 10, { lineBreak: false });

      doc.fillColor('#5C4E46').fontSize(7.5).font(fontBook)
         .text('Transaction Processed via Razorpay Secured Gateway.', leftSumX + 12, summaryY + 24, { lineBreak: false })
         .text('All taxes (CGST 6% + SGST 6%) are included in total amount as per Indian GST Regulations.', leftSumX + 12, summaryY + 38, { width: sumCardWidth - 24 });

      // Right Box: Totals Breakdown
      const rightSumX = leftSumX + sumCardWidth + 12;
      doc.rect(rightSumX, summaryY, sumCardWidth, sumCardHeight).fillAndStroke('#FFFFFF', '#EAE1D5');

      doc.fillColor('#5C4E46').fontSize(7.8).font(fontBook)
         .text('Item Subtotal (Excl. Tax):', rightSumX + 12, summaryY + 10, { lineBreak: false });
      doc.font(fontRupee).text(formatINR(taxableValue), rightSumX + sumCardWidth - 100, summaryY + 10, { width: 88, align: 'right', lineBreak: false });

      doc.font(fontBook).text('Estimated GST (12%):', rightSumX + 12, summaryY + 22, { lineBreak: false });
      doc.font(fontRupee).text(formatINR(totalGst), rightSumX + sumCardWidth - 100, summaryY + 22, { width: 88, align: 'right', lineBreak: false });

      doc.font(fontBook).text('Shipping & Logistics:', rightSumX + 12, summaryY + 34, { lineBreak: false });
      doc.fillColor('#488B49').font(fontRupee)
         .text(shippingAmount === 0 ? 'Complimentary' : formatINR(shippingAmount), rightSumX + sumCardWidth - 110, summaryY + 34, { width: 98, align: 'right', lineBreak: false });

      // Total Bar
      doc.strokeColor('#EAE1D5').lineWidth(0.5)
         .moveTo(rightSumX + 10, summaryY + 48)
         .lineTo(rightSumX + sumCardWidth - 10, summaryY + 48)
         .stroke();

      doc.fillColor('#1E1915').fontSize(10).font(fontHeading)
         .text('TOTAL PAID:', rightSumX + 12, summaryY + 58, { lineBreak: false });

      doc.fillColor('#1E1915').fontSize(11).font(fontRupee)
         .text(formatINR(totalAmount), rightSumX + sumCardWidth - 120, summaryY + 57, { width: 108, align: 'right', lineBreak: false });

      // ── 6. PROPRIETOR SEAL STAMP & SIGNATURE SECTION (PERFECTLY ALIGNED) ──
      const sealSectionY = summaryY + sumCardHeight + 14;
      const chosenSealFile = sealType === 'real' ? 'seal_real_ink.jpg' : 'seal_stamp.jpg';
      const sealStampPath = path.join(__dirname, '../assets', chosenSealFile);

      const sealBoxWidth = 140;
      const sealBoxX = rightSumX + sumCardWidth - sealBoxWidth; // 413.2 pt

      // 'For SHARNA' Heading
      doc.fillColor('#1E1915').fontSize(8.5).font(fontHeading)
         .text('For SHARNA', sealBoxX, sealSectionY, { width: sealBoxWidth, align: 'center', lineBreak: false });

      // Stamp Image with dedicated vertical space
      if (fs.existsSync(sealStampPath)) {
        try {
          const imgWidth = 84;
          const imgX = sealBoxX + (sealBoxWidth - imgWidth) / 2;
          doc.image(sealStampPath, imgX, sealSectionY + 12, { width: imgWidth });
        } catch (e) {
          console.warn('Seal stamp render note:', e);
        }
      }

      // 'Authorised Signatory / Proprietor' below image with zero overlap
      doc.fillColor('#7A6960').fontSize(7.5).font(fontBook)
         .text('Authorised Signatory / Proprietor', sealBoxX - 10, sealSectionY + 68, { width: sealBoxWidth + 20, align: 'center', lineBreak: false });

      // ── 7. FOOTER ──
      const footerY = sealSectionY + 84;
      doc.fillColor('#7A6960').fontSize(7.5).font(fontBook)
         .text('Thank you for choosing SHARNA. For returns, exchanges or support inquiries, please contact support@sharna.in.', 42, footerY, { width: boxWidth - 36, align: 'center', lineBreak: false })
         .text('This is a computer-generated official tax receipt. Authenticated with official proprietor seal.', 42, footerY + 11, { width: boxWidth - 36, align: 'center', lineBreak: false });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
};

module.exports = { generateInvoicePDFBuffer };
