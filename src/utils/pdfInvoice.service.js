const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

/**
 * Generate a Luxury SHARNA Tax Invoice PDF Buffer
 * @param {Object} order - Full order object with items, customer, and shipping info
 * @returns {Promise<Buffer>}
 */
const generateInvoicePDFBuffer = (order) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 40, size: 'A4' });
      const buffers = [];

      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        const pdfData = Buffer.concat(buffers);
        resolve(pdfData);
      });
      doc.on('error', (err) => reject(err));

      const orderNumber = String(order.orderNumber || order.id || 'SHARNA').slice(-8).toUpperCase();
      const invoiceDate = new Date(order.createdAt || Date.now()).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });

      const customerName = order.shippingAddress?.fullName || order.user?.name || 'Valued Patron';
      const customerPhone = order.shippingAddress?.phone || order.user?.phone || '';
      const customerEmail = order.user?.email || '';
      const addressLine = [
        order.shippingAddress?.streetAddress,
        order.shippingAddress?.city,
        order.shippingAddress?.state,
        order.shippingAddress?.postalCode
      ].filter(Boolean).join(', ') || 'Online Order';

      // ── HEADER / BRANDING ──
      doc.rect(0, 0, doc.page.width, 100).fill('#1E1915');
      
      doc.fillColor('#C5A86B')
         .fontSize(24)
         .font('Helvetica-Bold')
         .text('S H A R N A', 40, 30, { characterSpacing: 4 });

      doc.fillColor('#FFFFFF')
         .fontSize(9)
         .font('Helvetica')
         .text('HAUTE COUTURE & LUXURY ETHNIC WEAR', 40, 60, { characterSpacing: 1 });

      doc.fillColor('#C5A86B')
         .fontSize(14)
         .font('Helvetica-Bold')
         .text('TAX INVOICE', doc.page.width - 200, 35, { align: 'right' });

      doc.fillColor('#EAE1D5')
         .fontSize(9)
         .font('Helvetica')
         .text(`Invoice #: SH-${orderNumber}`, doc.page.width - 200, 55, { align: 'right' })
         .text(`Date: ${invoiceDate}`, doc.page.width - 200, 70, { align: 'right' });

      // ── SELLER & BUYER DETAILS ──
      const topY = 120;
      doc.fillColor('#1E1915').fontSize(10).font('Helvetica-Bold').text('SOLD BY:', 40, topY);
      doc.fillColor('#5C4E46').fontSize(9).font('Helvetica')
         .text('SHARNA APPARELS PRIVATE LIMITED', 40, topY + 16)
         .text('124 Luxury Fashion Boulevard, Civil Lines', 40, topY + 28)
         .text('Jabalpur, Madhya Pradesh - 482001', 40, topY + 40)
         .text('GSTIN: 23AABCS1429B1Z8 · support@sharna.in', 40, topY + 52);

      doc.fillColor('#1E1915').fontSize(10).font('Helvetica-Bold').text('BILL TO / SHIP TO:', doc.page.width / 2 + 20, topY);
      doc.fillColor('#5C4E46').fontSize(9).font('Helvetica')
         .text(customerName.toUpperCase(), doc.page.width / 2 + 20, topY + 16)
         .text(addressLine, doc.page.width / 2 + 20, topY + 28, { width: 230 })
         .text(`Phone: ${customerPhone}`, doc.page.width / 2 + 20, topY + 56);

      // ── TABLE HEADER ──
      const tableTop = topY + 95;
      doc.rect(40, tableTop, doc.page.width - 80, 24).fill('#F6F2EA');

      doc.fillColor('#1E1915').fontSize(9).font('Helvetica-Bold')
         .text('ITEM DESCRIPTION', 50, tableTop + 7)
         .text('SIZE / FIT', 280, tableTop + 7)
         .text('QTY', 370, tableTop + 7, { align: 'center', width: 40 })
         .text('PRICE', 420, tableTop + 7, { align: 'right', width: 60 })
         .text('AMOUNT', 490, tableTop + 7, { align: 'right', width: 60 });

      // ── ITEMS ROWS ──
      let rowY = tableTop + 30;
      const items = order.items || [];

      items.forEach((item, index) => {
        const title = item.product?.title || item.title || `Item #${index + 1}`;
        const size = item.size || item.variant?.size || 'Standard';
        const qty = item.quantity || 1;
        const price = Number(item.price || item.unitPrice || 0);
        const lineTotal = price * qty;

        doc.fillColor('#222222').fontSize(9).font('Helvetica')
           .text(title, 50, rowY, { width: 220 })
           .text(size, 280, rowY)
           .text(String(qty), 370, rowY, { align: 'center', width: 40 })
           .text(`Rs. ${price.toLocaleString('en-IN')}`, 420, rowY, { align: 'right', width: 60 })
           .text(`Rs. ${lineTotal.toLocaleString('en-IN')}`, 490, rowY, { align: 'right', width: 60 });

        doc.strokeColor('#EAE1D5').lineWidth(0.5)
           .moveTo(40, rowY + 18)
           .lineTo(doc.page.width - 40, rowY + 18)
           .stroke();

        rowY += 24;
      });

      // ── SUMMARY TOTALS ──
      const summaryY = Math.max(rowY + 20, tableTop + 140);
      const subtotal = Number(order.subtotal || order.totalAmount || 0);
      const discount = Number(order.discountAmount || 0);
      const shipping = Number(order.shippingFee || 0);
      const finalTotal = Number(order.totalAmount || subtotal - discount + shipping);

      const rightX = doc.page.width - 240;

      doc.fillColor('#5C4E46').fontSize(9).font('Helvetica')
         .text('Subtotal:', rightX, summaryY)
         .text(`Rs. ${subtotal.toLocaleString('en-IN')}`, rightX + 80, summaryY, { align: 'right', width: 110 });

      if (discount > 0) {
        doc.text('Discount Applied:', rightX, summaryY + 16)
           .text(`- Rs. ${discount.toLocaleString('en-IN')}`, rightX + 80, summaryY + 16, { align: 'right', width: 110 });
      }

      doc.text('Shipping (Express Luxe):', rightX, summaryY + 32)
         .text(shipping === 0 ? 'FREE' : `Rs. ${shipping.toLocaleString('en-IN')}`, rightX + 80, summaryY + 32, { align: 'right', width: 110 });

      // Total Box
      doc.rect(rightX - 10, summaryY + 50, 210, 30).fill('#1E1915');
      doc.fillColor('#C5A86B').fontSize(11).font('Helvetica-Bold')
         .text('TOTAL PAID:', rightX, summaryY + 59)
         .text(`Rs. ${Math.round(finalTotal).toLocaleString('en-IN')}`, rightX + 80, summaryY + 59, { align: 'right', width: 110 });

      // ── PAYMENT & FOOTER ──
      const footerY = doc.page.height - 90;
      doc.strokeColor('#C5A86B').lineWidth(1)
         .moveTo(40, footerY)
         .lineTo(doc.page.width - 40, footerY)
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
