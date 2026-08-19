const PDFDocument = require('pdfkit');

/**
 * Generate Exact Dark-Header Luxury SHARNA Tax Invoice PDF
 * Matches the dark-header Haute Couture design template
 */
const generateInvoicePDFBuffer = (order = {}) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 40, size: 'A4' });
      const buffers = [];

      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', (err) => reject(err));

      const pageWidth = doc.page.width;
      const pageHeight = doc.page.height;

      // Extract details
      let parsedNotes = {};
      if (order.notes) {
        try {
          parsedNotes = typeof order.notes === 'string' ? JSON.parse(order.notes) : order.notes;
        } catch (e) {}
      }

      const rawId = order.id || order.orderNumber || 'OP2L5ILI';
      const orderNumber = String(rawId).slice(-8).toUpperCase();
      const invoiceDate = new Date(order.createdAt || Date.now()).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });

      const customerName = String(parsedNotes.shippingName || order.shippingAddress?.fullName || order.user?.name || 'MR.PRIYANSHU LOKHANDE').toUpperCase();
      const customerPhone = parsedNotes.shippingPhone || order.shippingAddress?.phone || order.user?.phone || '+917999715256';

      const street = order.shippingAddress?.streetAddress || order.shippingStreet || 'At, post';
      const city = order.shippingAddress?.city || order.shippingCity || 'Khedi Sawligarh';
      const state = order.shippingAddress?.state || order.shippingState || 'Madhya Pradesh';
      const pincode = order.shippingAddress?.postalCode || order.shippingPostalCode || '460225';
      const fullAddress = `${street}, ${city}, ${state}, ${pincode}`;

      const totalAmount = Number(order.totalAmount || 18500);
      const shippingAmount = Number(order.shippingAmount || 0);
      const subtotal = totalAmount - shippingAmount;

      const formatPrice = (val) => 'Rs. ' + Math.round(Number(val || 0)).toLocaleString('en-IN');

      // ── 1. DARK LUXURY HEADER (Full Width Band) ──
      doc.rect(0, 0, pageWidth, 115).fill('#1A1614');

      // Left: SHARNA
      doc.fillColor('#C5A86B')
         .fontSize(26)
         .font('Helvetica-Bold')
         .text('S  H  A  R  N  A', 40, 32, { characterSpacing: 4 });

      doc.fillColor('#EAE1D5')
         .fontSize(8.5)
         .font('Helvetica')
         .text('HAUTE COUTURE & LUXURY ETHNIC WEAR', 40, 68, { characterSpacing: 1.5 });

      // Right: TAX INVOICE
      doc.fillColor('#C5A86B')
         .fontSize(15)
         .font('Helvetica-Bold')
         .text('TAX INVOICE', pageWidth - 240, 35, { width: 200, align: 'right' });

      doc.fillColor('#EAE1D5')
         .fontSize(9)
         .font('Helvetica')
         .text(`Invoice #: SH-${orderNumber}`, pageWidth - 240, 58, { width: 200, align: 'right' })
         .text(`Date: ${invoiceDate}`, pageWidth - 240, 72, { width: 200, align: 'right' });

      // ── 2. SOLD BY & BILL TO DETAILS ──
      const detailsY = 145;

      // Left: Sold By
      doc.fillColor('#1E1915').fontSize(10).font('Helvetica-Bold').text('SOLD BY:', 40, detailsY);
      doc.fillColor('#4A3E39').fontSize(9).font('Helvetica')
         .text('SHARNA APPARELS PRIVATE LIMITED', 40, detailsY + 16)
         .text('124 Luxury Fashion Boulevard, Civil Lines', 40, detailsY + 29)
         .text('Jabalpur, Madhya Pradesh - 482001', 40, detailsY + 42)
         .text('GSTIN: 23AABCS1429B1Z8 · support@sharna.in', 40, detailsY + 55);

      // Right: Bill To / Ship To
      const rightColX = pageWidth / 2 + 20;
      doc.fillColor('#1E1915').fontSize(10).font('Helvetica-Bold').text('BILL TO / SHIP TO:', rightColX, detailsY);
      doc.fillColor('#4A3E39').fontSize(9).font('Helvetica')
         .text(customerName, rightColX, detailsY + 16)
         .text(fullAddress, rightColX, detailsY + 29, { width: 220 })
         .text(`Phone: ${customerPhone}`, rightColX, detailsY + 58);

      // ── 3. TABLE HEADER BAR ──
      const tableY = detailsY + 95;
      const tableWidth = pageWidth - 80;

      doc.rect(40, tableY, tableWidth, 24).fill('#F6F2EA');

      doc.fillColor('#1E1915').fontSize(9).font('Helvetica-Bold')
         .text('ITEM DESCRIPTION', 50, tableY + 7, { width: 210 })
         .text('SIZE / FIT', 270, tableY + 7, { width: 70, align: 'center' })
         .text('QTY', 350, tableY + 7, { width: 40, align: 'center' })
         .text('PRICE', 400, tableY + 7, { width: 65, align: 'right' })
         .text('AMOUNT', 475, tableY + 7, { width: 75, align: 'right' });

      // ── 4. ITEM ROWS ──
      let rowY = tableY + 32;
      const items = order.items && order.items.length > 0 ? order.items : [
        { title: 'Blush Toga Co-ord Set (2 Pcs)', size: 'M', quantity: 1, price: totalAmount }
      ];

      items.forEach((item) => {
        const itemTitle = item.product?.title || item.title || 'Blush Toga Co-ord Set (2 Pcs)';
        const itemSize = item.size || 'M';
        const itemQty = Number(item.quantity || 1);
        const itemPrice = Number(item.price || totalAmount);
        const itemTotal = itemPrice * itemQty;

        doc.fillColor('#222222').fontSize(9.5).font('Helvetica')
           .text(itemTitle, 50, rowY, { width: 210 })
           .text(itemSize, 270, rowY, { width: 70, align: 'center' })
           .text(String(itemQty), 350, rowY, { width: 40, align: 'center' })
           .text(formatPrice(itemPrice), 400, rowY, { width: 65, align: 'right' })
           .text(formatPrice(itemTotal), 475, rowY, { width: 75, align: 'right' });

        doc.strokeColor('#EAE1D5').lineWidth(0.5)
           .moveTo(40, rowY + 20)
           .lineTo(pageWidth - 40, rowY + 20)
           .stroke();

        rowY += 32;
      });

      // ── 5. TOTALS SECTION ──
      const totalsY = Math.max(rowY + 120, 480);
      const totalBoxX = pageWidth - 260;

      doc.fillColor('#5C4E46').fontSize(9.5).font('Helvetica')
         .text('Subtotal:', totalBoxX, totalsY)
         .text(formatPrice(subtotal), totalBoxX + 90, totalsY, { width: 120, align: 'right' });

      doc.text('Shipping (Express Luxe):', totalBoxX, totalsY + 22)
         .text(shippingAmount === 0 ? 'FREE' : formatPrice(shippingAmount), totalBoxX + 90, totalsY + 22, { width: 120, align: 'right' });

      // Black TOTAL PAID Band with Gold Text
      doc.rect(totalBoxX - 10, totalsY + 45, 230, 32).fill('#1A1614');

      doc.fillColor('#C5A86B').fontSize(11).font('Helvetica-Bold')
         .text('TOTAL PAID:', totalBoxX, totalsY + 55);

      doc.fillColor('#C5A86B').fontSize(11).font('Helvetica-Bold')
         .text(formatPrice(totalAmount), totalBoxX + 90, totalsY + 55, { width: 120, align: 'right' });

      // ── 6. FOOTER ──
      const footerY = pageHeight - 75;
      doc.strokeColor('#C5A86B').lineWidth(1)
         .moveTo(40, footerY)
         .lineTo(pageWidth - 40, footerY)
         .stroke();

      doc.fillColor('#1E1915').fontSize(9).font('Helvetica-Bold')
         .text('Thank you for choosing SHARNA Haute Couture.', 40, footerY + 12);

      doc.fillColor('#7A6960').fontSize(8).font('Helvetica')
         .text('This is a computer-generated tax invoice. For queries regarding alterations or returns, contact support@sharna.in or WhatsApp +91 62682 18135.', 40, footerY + 26)
         .text('Website: www.sharna.in · Handcrafted with pride in India', 40, footerY + 38);

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
};

module.exports = { generateInvoicePDFBuffer };
