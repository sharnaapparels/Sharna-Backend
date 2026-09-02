const axios = require('axios');
const nodemailer = require('nodemailer');
const PDFDocument = require('pdfkit');

const RESEND_API_KEY = process.env.RESEND_API_KEY || 're_sharna_demo_key_984102';
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'SHARNA Luxury <orders@sharna.in>';
const RESEND_BASE_URL = 'https://api.resend.com/emails';

/**
 * Generate a PDF Tax Invoice buffer using PDFKit
 */
const generateInvoicePdfBuffer = (orderDetails) => {
  return new Promise((resolve) => {
    try {
      const doc = new PDFDocument({ margin: 36, size: 'A4' });
      const buffers = [];
      doc.on('data', b => buffers.push(b));
      doc.on('end', () => resolve(Buffer.concat(buffers)));

      // Dark Luxury Header Banner
      doc.rect(0, 0, doc.page.width, 95).fill('#181412');
      doc.fillColor('#C5A86B').fontSize(22).font('Helvetica-Bold').text('S H A R N A', 0, 28, { align: 'center', width: doc.page.width });
      doc.fillColor('#FAF7F2').fontSize(8).font('Helvetica').text('HANDCRAFTED ETHNIC LUXURY  •  OFFICIAL TAX INVOICE', 0, 58, { align: 'center', width: doc.page.width });

      // Invoice Details Block
      doc.fillColor('#181412').fontSize(13).font('Helvetica-Bold').text(`TAX INVOICE #${orderDetails.orderId || 'ORDER-SUCCESS'}`, 40, 115);
      doc.fillColor('#7A6960').fontSize(9).font('Helvetica').text(`Date: ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}  |  Status: PAID`, 40, 133);

      // Customer Info Block
      doc.fillColor('#3D312A').fontSize(9.5).font('Helvetica-Bold').text('BILLED & SHIPPED TO:', 40, 160);
      const rawName = orderDetails.shippingName || orderDetails.user?.name || 'Valued Customer';
      const name = rawName.toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
      doc.fontSize(11).font('Helvetica-Bold').fillColor('#181412').text(name, 40, 175);
      
      const street = orderDetails.shippingStreet || '123 Luxury Avenue';
      const city = orderDetails.shippingCity || 'Jabalpur';
      const state = orderDetails.shippingState || 'Madhya Pradesh';
      const pincode = orderDetails.shippingPostalCode || '482001';
      const addressStr = `${street}, ${city}, ${state} - ${pincode}, ${orderDetails.shippingCountry || 'India'}`;
      doc.fontSize(9).font('Helvetica').fillColor('#5C4E46').text(addressStr, 40, 190, { width: 500 });

      // Table Header
      let y = 230;
      doc.rect(40, y, 515, 24).fill('#FAF4EB');
      doc.fillColor('#181412').fontSize(8.5).font('Helvetica-Bold');
      doc.text('GARMENT ITEM', 50, y + 7);
      doc.text('VARIANT', 260, y + 7, { width: 100, align: 'center' });
      doc.text('QTY', 360, y + 7, { width: 40, align: 'center' });
      doc.text('PRICE', 410, y + 7, { width: 60, align: 'right' });
      doc.text('TOTAL', 480, y + 7, { width: 65, align: 'right' });

      y += 24;
      doc.font('Helvetica').fontSize(9).fillColor('#2A221E');

      const items = orderDetails.items || [];
      items.forEach((item) => {
        y += 8;
        const itemTitle = (item.title || item.product?.title || 'Luxury Garment').toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
        const sizeStr = (item.size || 'S').toUpperCase();
        const colorStr = (item.color || 'Default').toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
        const variantStr = `Size: ${sizeStr} | ${colorStr}`;
        const qty = Number(item.quantity) || 1;
        const price = Number(item.price) || 0;
        const total = price * qty;

        doc.text(itemTitle, 50, y, { width: 200 });
        doc.text(variantStr, 260, y, { width: 100, align: 'center' });
        doc.text(String(qty), 360, y, { width: 40, align: 'center' });
        doc.text(`INR ${price.toLocaleString('en-IN')}`, 410, y, { width: 60, align: 'right' });
        doc.text(`INR ${total.toLocaleString('en-IN')}`, 480, y, { width: 65, align: 'right' });

        y += 22;
        doc.moveTo(40, y).lineTo(555, y).strokeColor('#EAE1D5').stroke();
      });

      // Financial Totals
      y += 15;
      const totalAmount = Number(orderDetails.totalAmount || 0);
      const shippingAmount = Number(orderDetails.shippingAmount || 0);
      const subtotal = totalAmount - shippingAmount;

      doc.fontSize(9).font('Helvetica').fillColor('#5C4E46');
      doc.text('Subtotal:', 380, y);
      doc.text(`INR ${subtotal.toLocaleString('en-IN')}`, 470, y, { align: 'right' });

      y += 18;
      doc.text('Express Shipping:', 380, y);
      doc.text(shippingAmount === 0 ? 'COMPLIMENTARY' : `INR ${shippingAmount}`, 470, y, { align: 'right' });

      y += 20;
      doc.rect(365, y, 190, 28).fill('#181412');
      doc.fillColor('#C5A86B').fontSize(10.5).font('Helvetica-Bold');
      doc.text('TOTAL PAID:', 375, y + 8);
      doc.text(`INR ${totalAmount.toLocaleString('en-IN')}`, 465, y + 8, { align: 'right', width: 80 });

      // Symmetrical Footer
      doc.fontSize(8).font('Helvetica').fillColor('#7A6960');
      doc.text('SHARNA ETHNIC WEAR  •  Founded by Mrs. Chetna Kureel  •  Jabalpur, Madhya Pradesh', 40, doc.page.height - 40, { align: 'center', width: 515 });

      doc.end();
    } catch (e) {
      console.warn('PDF Buffer generation notice:', e);
      resolve(null);
    }
  });
};

/**
 * Send email using Resend API (with Nodemailer fallback if SMTP configured)
 */
const sendResendEmail = async ({ to, subject, html, text, attachments }) => {
  const payload = {
    from: RESEND_FROM_EMAIL,
    to: Array.isArray(to) ? to : [to],
    subject,
    html,
    text: text || 'Please view this email in an HTML-compatible email reader.'
  };

  if (attachments && attachments.length > 0) {
    payload.attachments = attachments;
  }

  // If RESEND_API_KEY is configured and valid, call Resend REST API
  if (process.env.RESEND_API_KEY && !process.env.RESEND_API_KEY.includes('demo')) {
    try {
      const response = await axios.post(
        RESEND_BASE_URL,
        payload,
        {
          headers: {
            'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log(`✅ [Resend Email Sent]: To ${to} | ID: ${response.data.id}`);
      return { success: true, id: response.data.id };
    } catch (err) {
      const errMsg = err.response?.data?.message || err.message;
      console.warn("⚠️ Resend API primary domain attempt warning:", errMsg);

      // Retry with testing domain if unverified
      if (errMsg.includes('domain') || errMsg.includes('verify') || err.response?.status === 403 || err.response?.status === 422) {
        try {
          console.log(`🔄 Retrying Resend with testing domain (onboarding@resend.dev)...`);
          const retryRes = await axios.post(
            RESEND_BASE_URL,
            {
              ...payload,
              from: 'SHARNA Luxury <onboarding@resend.dev>'
            },
            {
              headers: {
                'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
                'Content-Type': 'application/json'
              }
            }
          );
          console.log(`✅ [Resend Email Sent via onboarding@resend.dev]: To ${to} | ID: ${retryRes.data.id}`);
          return { success: true, id: retryRes.data.id };
        } catch (retryErr) {
          console.error("❌ Resend retry warning:", retryErr.response?.data?.message || retryErr.message);
        }
      }
    }
  }

  // Fallback to Nodemailer if SMTP credentials exist
  if (process.env.SMTP_USER && process.env.SMTP_PASS) {
    try {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        }
      });

      await transporter.sendMail({
        from: RESEND_FROM_EMAIL,
        to,
        subject,
        html,
        attachments
      });
      console.log(`✅ [SMTP Email Sent]: To ${to}`);
      return { success: true };
    } catch (err) {
      console.warn("⚠️ SMTP fallback warning:", err.message);
    }
  }

  console.log(`\n=================== [RESEND EMAIL SIMULATION] ===================`);
  console.log(`To: ${to}`);
  console.log(`Subject: ${subject}`);
  console.log(`=================================================================\n`);
  return { success: true, simulated: true };
};

/**
 * Ultra-Responsive Luxury Order Invoice Email Template (White Card / Cream Background + Dark Header)
 */
const sendEmailInvoice = async (email, orderDetails) => {
  if (!email) return;

  const formatPrice = (price) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(price || 0);
  };

  const capitalizeText = (str) => {
    if (!str) return '';
    return String(str)
      .toLowerCase()
      .trim()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const formattedCustomerName = capitalizeText(orderDetails.shippingName || orderDetails.user?.name || 'Valued Customer');
  const totalAmount = Number(orderDetails.totalAmount || 0);
  const shippingAmount = Number(orderDetails.shippingAmount || 0);
  const subtotal = totalAmount - shippingAmount;

  const resolveItemImage = (item) => {
    if (!item) return 'https://res.cloudinary.com/fcmtpwwu/image/upload/v1787862351/sharna_products/bhhjppaimu0ojppewehu.png';
    if (typeof item.image === 'string' && item.image.startsWith('http')) return item.image;
    if (Array.isArray(item.product?.images) && item.product.images.length > 0) {
      const p = item.product.images.find(img => img.isPrimary) || item.product.images[0];
      if (p?.url && p.url.startsWith('http')) return p.url;
    }
    if (typeof item.product?.image === 'string' && item.product.image.startsWith('http')) return item.product.image;
    
    // Keyword fallback for known catalog items to prevent broken images in Gmail
    const titleLow = (item.title || item.product?.title || '').toLowerCase();
    if (titleLow.includes('toga') || titleLow.includes('blush')) {
      return 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=400&q=80';
    }
    if (titleLow.includes('sand') || titleLow.includes('beige')) {
      return 'https://images.unsplash.com/photo-1554412933-514a83d2f3c8?auto=format&fit=crop&w=400&q=80';
    }
    if (titleLow.includes('reception') || titleLow.includes('bridal') || titleLow.includes('lehenga') || titleLow.includes('saree')) {
      return 'https://res.cloudinary.com/fcmtpwwu/image/upload/v1787658311/sharna_products/sxeopgxcfbdev4pbj6w4.jpg';
    }
    return 'https://res.cloudinary.com/fcmtpwwu/image/upload/v1787862351/sharna_products/bhhjppaimu0ojppewehu.png';
  };

  const itemsRows = (orderDetails.items || []).map((item, index, arr) => {
    const rawTitle = item.title || item.product?.title || 'Luxury Designer Garment';
    const formattedTitle = capitalizeText(rawTitle);
    const sizeStr = String(item.size || 'S').toUpperCase();
    const colorStr = capitalizeText(item.color || 'Default');
    const itemPrice = Number(item.price || 0);
    const itemQty = Number(item.quantity || 1);
    const itemImg = resolveItemImage(item);
    const isLast = index === arr.length - 1;

    return `
      <tr>
        <td style="padding: 14px 0; ${isLast ? '' : 'border-bottom: 1px solid #FAF0E4;'}">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
            <tr>
              <td width="64" valign="top" style="padding-right: 12px;">
                <img src="${itemImg}" width="56" height="70" alt="${formattedTitle}" style="width: 56px; height: 70px; object-fit: cover; border-radius: 6px; border: 1px solid #EAE1D5; display: block;" />
              </td>
              <td valign="top" style="text-align: left;">
                <div style="font-size: 14px; font-weight: 700; color: #1E1915; font-family: 'Helvetica Neue', Arial, sans-serif; line-height: 1.35;">${formattedTitle}</div>
                <div style="font-size: 12.5px; color: #5C4E46; margin-top: 4px; font-family: 'Helvetica Neue', Arial, sans-serif;">Size ${sizeStr} &nbsp;•&nbsp; ${colorStr}</div>
                <div style="font-size: 12px; color: #7A6960; margin-top: 3px; font-family: 'Helvetica Neue', Arial, sans-serif;">
                  Qty: ${itemQty} &nbsp;(${formatPrice(itemPrice)} each)
                </div>
              </td>
              <td valign="top" align="right" style="white-space: nowrap; font-size: 14.5px; font-weight: 700; color: #1E1915; font-family: 'Helvetica Neue', Arial, sans-serif; padding-left: 10px;">
                ${formatPrice(itemPrice * itemQty)}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    `;
  }).join('');

  const trackingBlock = orderDetails.awbCode ? `
    <div style="background-color: #FAF4EB; border-left: 4px solid #C5A86B; border-radius: 8px; padding: 16px; margin-bottom: 22px; text-align: left;">
      <span style="font-size: 10px; font-weight: 700; color: #A67E39; letter-spacing: 0.14em; text-transform: uppercase; display: block; margin-bottom: 4px;">AUTOMATED SHIPROCKET DISPATCH</span>
      <div style="font-size: 13.5px; font-weight: 700; color: #1E1915;">Courier: ${orderDetails.courierName || 'Delhivery Express Air'}</div>
      <div style="font-size: 12.5px; color: #5C4E46; margin-top: 2px;">AWB Tracking Code: <strong style="color: #1E1915;">${orderDetails.awbCode}</strong></div>
      ${orderDetails.trackingUrl ? `
        <a href="${orderDetails.trackingUrl}" target="_blank" style="display: inline-block; margin-top: 10px; padding: 8px 18px; background: #181412; color: #C5A86B; text-decoration: none; border-radius: 20px; font-size: 10.5px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase;">TRACK SHIPMENT ON SHIPROCKET →</a>
      ` : ''}
    </div>
  ` : '';

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta name="color-scheme" content="only light">
      <meta name="supported-color-schemes" content="only light">
      <title>SHARNA Tax Invoice #${orderDetails.orderId}</title>
      <style>
        :root {
          color-scheme: only light;
          supported-color-schemes: only light;
        }
        u + .body .email-card {
          background-color: #ffffff !important;
          background: #ffffff linear-gradient(0deg, #ffffff 0%, #ffffff 100%) !important;
        }
        u + .body .email-bg {
          background-color: #faf7f2 !important;
          background: #faf7f2 linear-gradient(0deg, #faf7f2 0%, #faf7f2 100%) !important;
        }
      </style>
    </head>
    <body class="body" style="margin: 0; padding: 0; background-color: #FAF7F2; background: #FAF7F2 linear-gradient(0deg, #FAF7F2 0%, #FAF7F2 100%); font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; color: #1E1915;">
      
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" class="email-bg" style="background-color: #FAF7F2; background: #FAF7F2 linear-gradient(0deg, #FAF7F2 0%, #FAF7F2 100%); padding: 20px 10px 40px 10px; width: 100%;">
        <tr>
          <td align="center">
            
            <!-- MAIN CONTAINER CARD (Max 500px - Perfect Mobile & Desktop Fit) -->
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" class="email-card" style="max-width: 500px; background-color: #FFFFFF; background: #FFFFFF linear-gradient(0deg, #FFFFFF 0%, #FFFFFF 100%); border-radius: 16px; border: 1px solid #EAE1D5; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.06);">
              
              <!-- DARK CHARCOAL BRAND HEADER BANNER WITH OFFICIAL SHARNA LOGO -->
              <tr>
                <td align="center" style="background-color: #181412; background: #181412 linear-gradient(0deg, #181412 0%, #181412 100%); padding: 32px 20px 28px; border-bottom: 3px solid #C5A86B;">
                  <div style="color: #C5A86B !important; font-size: 13px; margin-bottom: 8px; letter-spacing: 0.3em;">❖</div>
                  <img src="https://res.cloudinary.com/fcmtpwwu/image/upload/v1788374485/sharna_brand/sharna_official_logo.png" alt="SHARNA" width="160" style="width: 160px; max-width: 180px; height: auto; display: block; margin: 0 auto; filter: brightness(0) invert(1);" />
                  <div style="width: 40px; height: 1px; background-color: #C5A86B; margin: 12px auto 8px;"></div>
                  <p style="font-size: 9.5px; color: #C5A86B !important; margin: 0; text-transform: uppercase; letter-spacing: 0.24em; font-family: 'Helvetica Neue', Arial, sans-serif; font-weight: 600; opacity: 0.95;">HANDCRAFTED ETHNIC LUXURY</p>
                </td>
              </tr>

              <!-- WHITE CARD CONTENT AREA -->
              <tr>
                <td class="email-card" style="padding: 30px 24px; background-color: #FFFFFF; background: #FFFFFF linear-gradient(0deg, #FFFFFF 0%, #FFFFFF 100%); text-align: left;">
                  
                  <!-- OFFICIAL TAX INVOICE BADGE & META -->
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom: 18px;">
                    <tr>
                      <td align="center">
                        <span style="font-size: 10px; font-weight: 700; color: #FFFFFF !important; background-color: #0E9F6E; padding: 5px 14px; border-radius: 20px; text-transform: uppercase; letter-spacing: 0.06em; display: inline-block; margin-bottom: 10px;">
                          OFFICIAL TAX INVOICE ✓
                        </span>
                        <div style="font-size: 14px; font-weight: 700; color: #1E1915 !important; font-family: 'Helvetica Neue', Arial, sans-serif;">Invoice Number: #${orderDetails.orderId}</div>
                        <div style="font-size: 11.5px; color: #7A6960 !important; margin-top: 4px; font-family: 'Helvetica Neue', Arial, sans-serif;">Date: ${new Date().toLocaleDateString('en-IN', { month: 'long', day: 'numeric', year: 'numeric' })}</div>
                      </td>
                    </tr>
                  </table>

                  <div style="border-bottom: 1px solid #EAE1D5; margin-bottom: 22px;"></div>

                  <!-- GREETING -->
                  <div style="margin-bottom: 22px;">
                    <div style="font-size: 16px; font-weight: 700; color: #1E1915 !important;">Hello, ${formattedCustomerName}.</div>
                    <div style="font-size: 13.5px; color: #5C4E46 !important; margin-top: 4px; line-height: 1.5;">Thank you for shopping with SHARNA. Your order details and receipt summary are provided below.</div>
                  </div>

                  <!-- DOWNLOAD PDF TAX INVOICE BUTTON -->
                  <div style="background-color: #FAF4EB; background: #FAF4EB linear-gradient(0deg, #FAF4EB 0%, #FAF4EB 100%); border: 1px solid #E5D5C3; border-radius: 12px; padding: 14px 18px; margin-bottom: 24px; text-align: center;">
                    <div style="font-size: 12px; color: #5C4E46 !important; font-weight: 500; margin-bottom: 10px; line-height: 1.4;">
                      Need a formal printable PDF receipt for your records?
                    </div>
                    <a href="${process.env.SELF_URL || 'https://sharna-backend-production.up.railway.app'}/api/orders/${orderDetails.orderId}/invoice.pdf" target="_blank" style="display: inline-block; padding: 10px 24px; background-color: #181412; background: #181412 linear-gradient(0deg, #181412 0%, #181412 100%); color: #C5A86B !important; text-decoration: none; border-radius: 20px; font-size: 10.5px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase;">
                      📥 DOWNLOAD TAX INVOICE PDF
                    </a>
                  </div>

                  ${trackingBlock}

                  <!-- ITEMS LIST -->
                  <div style="margin-bottom: 10px;">
                    <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.12em; color: #A67E39 !important; font-weight: 700; margin-bottom: 12px;">ORDERED GARMENTS</div>
                    <table width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse: collapse;">
                      <tbody>
                        ${itemsRows}
                      </tbody>
                    </table>
                  </div>

                  <div style="border-bottom: 1px solid #EAE1D5; margin: 20px 0;"></div>

                  <!-- FINANCIAL BREAKDOWN -->
                  <table width="100%" cellspacing="0" cellpadding="0" border="0" style="font-size: 13.5px; color: #5C4E46 !important; margin-bottom: 22px;">
                    <tr>
                      <td align="left" style="padding: 5px 0;">Subtotal</td>
                      <td align="right" style="padding: 5px 0; color: #1E1915 !important; font-weight: 600;">${formatPrice(subtotal)}</td>
                    </tr>
                    <tr>
                      <td align="left" style="padding: 5px 0;">GST Tax (18% Included)</td>
                      <td align="right" style="padding: 5px 0; color: #0E9F6E !important; font-weight: 600;">Included</td>
                    </tr>
                    <tr>
                      <td align="left" style="padding: 5px 0;">Express Shipping</td>
                      <td align="right" style="padding: 5px 0; color: #0E9F6E !important; font-weight: 600;">Complimentary</td>
                    </tr>
                    <tr style="border-top: 1.5px solid #1E1915;">
                      <td align="left" style="padding: 14px 0 0 0; font-size: 15.5px; font-weight: 700; color: #1E1915 !important;">Total Paid</td>
                      <td align="right" style="padding: 14px 0 0 0;">
                        <div style="font-size: 20px; font-weight: 700; color: #C5A86B !important;">${formatPrice(totalAmount)}</div>
                        <div style="font-size: 10.5px; color: #7A6960 !important; margin-top: 2px;">Paid via Online Payment</div>
                      </td>
                    </tr>
                  </table>

                  <div style="border-bottom: 1px solid #EAE1D5; margin-bottom: 22px;"></div>

                  <!-- DELIVERY DESTINATION CARD -->
                  <div style="background-color: #FAF7F2; background: #FAF7F2 linear-gradient(0deg, #FAF7F2 0%, #FAF7F2 100%); border: 1px solid #EAE1D5; border-radius: 12px; padding: 18px; margin-bottom: 26px;">
                    <div style="font-size: 10px; font-weight: 700; color: #A67E39 !important; text-transform: uppercase; letter-spacing: 0.12em; margin-bottom: 6px;">DELIVERY DESTINATION</div>
                    <div style="font-size: 14px; color: #1E1915 !important; font-weight: 700;">${formattedCustomerName}</div>
                    <div style="font-size: 12.5px; color: #5C4E46 !important; margin-top: 4px; line-height: 1.55;">
                      ${orderDetails.shippingStreet || ''}<br>
                      ${orderDetails.shippingCity || ''}, ${orderDetails.shippingState || ''} - ${orderDetails.shippingPostalCode || ''}, ${orderDetails.shippingCountry || 'India'}
                    </div>
                  </div>

                  <!-- VIEW ORDER IN PROFILE CTA -->
                  <a href="https://sharna.in/orders" target="_blank" style="display: block; width: 100%; text-align: center; padding: 15px 0; background-color: #181412; background: #181412 linear-gradient(0deg, #181412 0%, #181412 100%); color: #C5A86B !important; border-radius: 25px; font-size: 11.5px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; text-decoration: none; box-sizing: border-box; box-shadow: 0 6px 18px rgba(24,20,18,0.15);">
                    VIEW ORDER IN PROFILE &gt;
                  </a>

                </td>
              </tr>
            </table>

            <!-- FOOTER EMBLEM & LINKS -->
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width: 500px; margin-top: 28px; text-align: center;">
              <tr>
                <td align="center" style="font-size: 11px; color: #7A6960;">
                  <div style="margin-bottom: 10px;">
                    <span style="font-family: Georgia, serif; font-size: 15px; font-weight: 700; color: #181412; border: 1.5px solid #181412; padding: 3px 8px; border-radius: 50%;">S</span>
                  </div>
                  <p style="margin: 0; line-height: 1.6;">
                    Return Policy &nbsp;•&nbsp; Track Order &nbsp;•&nbsp; Contact Support
                  </p>
                  <p style="margin: 6px 0 0 0; color: #999999;">© SHARNA 2026</p>
                </td>
              </tr>
            </table>

          </td>
        </tr>
      </table>

    </body>
    </html>
  `;

  return sendResendEmail({
    to: email,
    subject: `Official Tax Invoice #${orderDetails.orderId} — SHARNA Luxury`,
    html: htmlContent
  });
};

/**
 * Password Reset / Verification OTP Email Template
 */
const sendPasswordResetEmail = async (email, otpCode) => {
  if (!email) return;

  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 30px auto; padding: 30px; background-color: #ffffff; border: 1px solid #c5a86b; border-radius: 16px; text-align: center;">
      <h1 style="font-family: Georgia, serif; color: #1e1915; letter-spacing: 0.2em; font-size: 26px; margin-bottom: 5px;">SHARNA</h1>
      <p style="font-size: 10px; color: #A67E39; text-transform: uppercase; letter-spacing: 0.15em; margin-bottom: 25px;">SECURITY VERIFICATION</p>

      <div style="background-color: #FAF4EB; padding: 20px; border-radius: 10px; border: 1px solid #EAE1D5; margin-bottom: 25px;">
        <p style="font-size: 13px; color: #5C4E46; margin: 0 0 10px 0;">Your password reset OTP security code is:</p>
        <div style="font-size: 32px; font-weight: 700; color: #1e1915; letter-spacing: 0.25em;">${otpCode}</div>
        <p style="font-size: 11px; color: #888; margin: 10px 0 0 0;">This code is valid for 10 minutes. Do not share it with anyone.</p>
      </div>

      <p style="font-size: 11px; color: #999; margin: 0;">If you did not request this verification, please ignore this email.</p>
    </div>
  `;

  return sendResendEmail({
    to: email,
    subject: `${otpCode} is your SHARNA Password Reset Security Code`,
    html: htmlContent
  });
};

/**
 * Admin Two-Factor Authentication (2FA) Security OTP Email Template
 */
const sendAdmin2FAEmail = async (email, otpCode, adminName = 'Administrator') => {
  if (!email) return;

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>SHARNA Admin Portal - 2FA Security Code</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #1e1915; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;">
      
      <div style="max-width: 520px; margin: 30px auto; background-color: #ffffff; border-radius: 16px; border: 1px solid #c5a86b; overflow: hidden; box-shadow: 0 20px 50px rgba(0,0,0,0.5);">
        
        <!-- Luxury Header Banner -->
        <div style="background-color: #181412; padding: 30px 20px; text-align: center; border-bottom: 2px solid #c5a86b;">
          <h1 style="color: #c5a86b; font-family: 'Cinzel', Georgia, serif; margin: 0; letter-spacing: 0.25em; font-size: 26px; text-transform: uppercase;">SHARNA</h1>
          <p style="font-size: 10px; color: #FAF7F2; margin: 6px 0 0 0; text-transform: uppercase; letter-spacing: 0.2em;">ADMINISTRATOR PORTAL SECURITY</p>
        </div>

        <div style="padding: 35px 30px; text-align: center;">
          
          <div style="display: inline-block; padding: 6px 16px; background-color: #FAF4EB; border: 1px solid #EAE1D5; border-radius: 20px; font-size: 11px; font-weight: 700; color: #8C6B28; letter-spacing: 0.1em; text-transform: uppercase; margin-bottom: 18px;">
            🔒 TWO-FACTOR AUTHENTICATION (2FA)
          </div>

          <h2 style="color: #1e1915; font-size: 20px; margin: 0 0 10px 0; font-weight: 600;">Admin Login Verification</h2>
          <p style="font-size: 13.5px; color: #5C4E46; line-height: 1.5; margin: 0 0 25px 0;">
            Hello <strong>${adminName}</strong>,<br>
            A login attempt was initiated for your SHARNA Administrator Account. Use the one-time security code below to complete authentication:
          </p>

          <!-- OTP Box -->
          <div style="background-color: #FAF4EB; border: 2px dashed #c5a86b; border-radius: 12px; padding: 22px 15px; margin: 0 auto 25px auto; max-width: 340px;">
            <span style="font-size: 11px; color: #8C6B28; font-weight: 600; text-transform: uppercase; letter-spacing: 0.1em; display: block; margin-bottom: 8px;">YOUR 6-DIGIT 2FA CODE</span>
            <div style="font-size: 34px; font-weight: 800; letter-spacing: 0.3em; color: #181412; font-family: 'Courier New', Courier, monospace;">
              ${otpCode}
            </div>
            <span style="font-size: 11px; color: #888; display: block; margin-top: 8px;">Valid for 10 minutes • Single use only</span>
          </div>

          <p style="font-size: 12px; color: #888888; line-height: 1.5; margin: 0;">
            ⚠️ If you did not attempt to sign in to the SHARNA Admin Portal, please secure your account immediately or notify your system administrator.
          </p>

        </div>

        <!-- Footer -->
        <div style="background-color: #FAF7F2; padding: 18px; text-align: center; border-top: 1px solid #EAE1D5; font-size: 11px; color: #7A6960;">
          <p style="margin: 0; font-weight: 600; color: #1e1915;">SHARNA ETHNIC WEAR SECURITY</p>
          <p style="margin: 4px 0 0 0;">Automated Security Dispatch • Please do not reply</p>
        </div>

      </div>

    </body>
    </html>
  `;

  return sendResendEmail({
    to: email,
    subject: `🔐 [${otpCode}] SHARNA Admin Portal 2FA Verification Code`,
    html: htmlContent
  });
};

/**
 * Abandoned Wishlist Reminder Email Template
 */
const sendWishlistReminderEmail = async (email, { name, items = [] }) => {
  if (!email || !items || items.length === 0) return;

  const formatPrice = (price) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(price || 0);
  };

  const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';

  const itemsHtml = items.map(item => `
    <tr style="border-bottom: 1px solid #FAF0E4;">
      <td style="padding: 12px; width: 60px;">
        ${item.image ? `<img src="${item.image}" alt="${item.title}" style="width: 55px; height: 70px; object-fit: cover; border-radius: 6px;" />` : `<div style="width: 55px; height: 70px; background: #FAF4EB; border-radius: 6px;"></div>`}
      </td>
      <td style="padding: 12px; font-family: 'Helvetica Neue', Arial, sans-serif; color: #1e1915; font-size: 14px; font-weight: 600;">
        ${item.title || 'Luxury Ethnic Garment'}
        <div style="font-size: 12px; color: #7A6960; margin-top: 4px; font-weight: normal;">Category: ${item.category || 'Ethnic Wear'}</div>
      </td>
      <td style="padding: 12px; text-align: right; font-family: sans-serif; color: #8C6B28; font-weight: 700; font-size: 14px;">
        ${formatPrice(item.price)}
      </td>
    </tr>
  `).join('');

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Items left in your SHARNA Wishlist</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #FAF7F2; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;">
      
      <div style="max-width: 600px; margin: 30px auto; background-color: #ffffff; border-radius: 16px; border: 1px solid #EAE1D5; overflow: hidden; box-shadow: 0 15px 40px rgba(30,25,21,0.06);">
        
        <!-- Header Banner -->
        <div style="background-color: #1e1915; padding: 35px 25px; text-align: center; border-bottom: 3px solid #c5a86b;">
          <h1 style="color: #ffffff; font-family: 'Cinzel', Georgia, serif; margin: 0; letter-spacing: 0.25em; font-size: 28px; text-transform: uppercase; font-weight: 400;">SHARNA</h1>
          <p style="font-size: 10px; color: #c5a86b; margin: 8px 0 0 0; text-transform: uppercase; letter-spacing: 0.2em;">SUSTAINABLE FASHION & LASTING LUXURY</p>
        </div>

        <div style="padding: 35px 30px;">
          
          <div style="text-align: center; margin-bottom: 25px;">
            <span style="font-size: 10px; font-weight: 700; color: #8C6B28; background-color: #FAF4EB; padding: 5px 14px; border-radius: 15px; text-transform: uppercase; letter-spacing: 0.08em; border: 1px solid #EAE1D5;">
              WISHLIST REMINDER 🌸
            </span>
            <h2 style="color: #1e1915; font-family: Georgia, serif; font-size: 22px; margin: 12px 0 6px 0; font-weight: 400;">Don't Let Your Favorites Slip Away!</h2>
            <p style="font-size: 13.5px; color: #5C4E46; line-height: 1.6; margin: 0;">
              Hello <strong>${name || 'Valued Customer'}</strong>,<br>
              You saved some exquisite handcrafted designs in your wishlist. Stock for these pieces is strictly limited—order now before they run out!
            </p>
          </div>

          <!-- Items Table -->
          <table style="width: 100%; border-collapse: collapse; margin: 20px 0; background-color: #ffffff; border: 1px solid #FAF0E4; border-radius: 10px;">
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>

          <!-- Direct CTA -->
          <div style="text-align: center; margin-top: 30px;">
            <a href="${clientUrl}/wishlist" target="_blank" style="display: inline-block; padding: 14px 36px; background-color: #1e1915; color: #FAF7F2; text-decoration: none; border-radius: 25px; font-size: 12px; font-weight: 700; letter-spacing: 0.15em; text-transform: uppercase; box-shadow: 0 4px 15px rgba(30,25,21,0.15);">
              VIEW & ORDER MY WISHLIST →
            </a>
          </div>

        </div>

        <!-- Footer -->
        <div style="background-color: #FAF7F2; padding: 22px; text-align: center; border-top: 1px solid #EAE1D5; font-size: 11px; color: #7A6960; line-height: 1.6;">
          <p style="margin: 0; font-weight: 600; color: #1e1915;">SHARNA ETHNIC WEAR</p>
          <p style="margin: 4px 0 0 0;">Founded by Mrs. Chetna Kureel • Jabalpur, Madhya Pradesh, India</p>
        </div>

      </div>

    </body>
    </html>
  `;

  return sendResendEmail({
    to: email,
    subject: `🌸 Your favorite SHARNA pieces are waiting in your wishlist!`,
    html: htmlContent
  });
};

module.exports = {
  sendResendEmail,
  sendEmailInvoice,
  sendPasswordResetEmail,
  sendAdmin2FAEmail,
  sendWishlistReminderEmail
};
