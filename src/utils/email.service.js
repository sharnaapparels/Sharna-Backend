const axios = require('axios');
const nodemailer = require('nodemailer');

const RESEND_API_KEY = process.env.RESEND_API_KEY || 're_sharna_demo_key_984102';
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'SHARNA Luxury <orders@sharna.in>';
const RESEND_BASE_URL = 'https://api.resend.com/emails';

/**
 * Send email using Resend API (with Nodemailer fallback if SMTP configured)
 */
const sendResendEmail = async ({ to, subject, html, text }) => {
  // If RESEND_API_KEY is configured and valid, call Resend REST API
  if (process.env.RESEND_API_KEY && !process.env.RESEND_API_KEY.includes('demo')) {
    try {
      const response = await axios.post(
        RESEND_BASE_URL,
        {
          from: RESEND_FROM_EMAIL,
          to: Array.isArray(to) ? to : [to],
          subject,
          html,
          text: text || 'Please view this email in an HTML-compatible email reader.'
        },
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

      // If domain is unverified on Resend free tier, retry with onboarding@resend.dev default testing domain
      if (errMsg.includes('domain') || errMsg.includes('verify') || err.response?.status === 403 || err.response?.status === 422) {
        try {
          console.log(`🔄 Retrying Resend with testing domain (onboarding@resend.dev)...`);
          const retryRes = await axios.post(
            RESEND_BASE_URL,
            {
              from: 'SHARNA Luxury <onboarding@resend.dev>',
              to: Array.isArray(to) ? to : [to],
              subject,
              html,
              text: text || 'Please view this email in an HTML-compatible email reader.'
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
        html
      });
      console.log(`✅ [SMTP Email Sent]: To ${to}`);
      return { success: true };
    } catch (err) {
      console.warn("⚠️ SMTP fallback warning:", err.message);
    }
  }

  // Development simulation log
  console.log(`\n=================== [RESEND EMAIL SIMULATION] ===================`);
  console.log(`To: ${to}`);
  console.log(`From: ${RESEND_FROM_EMAIL}`);
  console.log(`Subject: ${subject}`);
  console.log(`=================================================================\n`);
  return { success: true, simulated: true };
};

/**
 * Professional HTML Order Invoice Email Template
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

  const itemsHtml = (orderDetails.items || []).map(item => `
    <tr>
      <td style="padding: 14px 12px; border-bottom: 1px solid #FAF0E4; font-family: 'Helvetica Neue', Arial, sans-serif; color: #1e1915; font-size: 13.5px; font-weight: 600;">
        ${item.title || 'Luxury Garment'}
      </td>
      <td style="padding: 14px 12px; border-bottom: 1px solid #FAF0E4; font-family: sans-serif; color: #7A6960; text-transform: uppercase; font-size: 12px; text-align: center;">
        Size: <strong>${item.size || 'S'}</strong> | ${item.color || 'Default'}
      </td>
      <td style="padding: 14px 12px; text-align: center; border-bottom: 1px solid #FAF0E4; font-family: sans-serif; color: #7A6960; font-size: 13px;">
        ${item.quantity}
      </td>
      <td style="padding: 14px 12px; text-align: right; border-bottom: 1px solid #FAF0E4; font-family: sans-serif; color: #7A6960; font-size: 13px;">
        ${formatPrice(item.price)}
      </td>
      <td style="padding: 14px 12px; text-align: right; border-bottom: 1px solid #FAF0E4; font-family: sans-serif; color: #1e1915; font-weight: 700; font-size: 13.5px;">
        ${formatPrice(item.price * item.quantity)}
      </td>
    </tr>
  `).join('');

  const trackingBlock = orderDetails.awbCode ? `
    <div style="background-color: #FAF4EB; border: 1.5px solid #c5a86b; border-radius: 8px; padding: 16px; margin: 20px 0; text-align: center;">
      <span style="font-size: 11px; font-weight: 700; color: #A67E39; letter-spacing: 0.1em; text-transform: uppercase; display: block; margin-bottom: 4px;">AUTOMATED SHIPROCKET DISPATCH</span>
      <div style="font-size: 14px; font-weight: 700; color: #1e1915;">Courier: ${orderDetails.courierName || 'Delhivery Express Air'}</div>
      <div style="font-size: 13px; color: #5C4E46; margin-top: 2px;">AWB Tracking Code: <strong>${orderDetails.awbCode}</strong></div>
      ${orderDetails.trackingUrl ? `
        <a href="${orderDetails.trackingUrl}" target="_blank" style="display: inline-block; margin-top: 10px; padding: 8px 18px; background-color: #1e1915; color: #FAF7F2; text-decoration: none; border-radius: 20px; font-size: 11px; font-weight: 700; letter-spacing: 0.05em;">TRACK SHIPMENT ON SHIPROCKET →</a>
      ` : ''}
    </div>
  ` : '';

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>SHARNA Tax Invoice</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #FAF7F2; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;">
      
      <div style="max-width: 620px; margin: 30px auto; background-color: #ffffff; border-radius: 16px; border: 1px solid #EAE1D5; overflow: hidden; box-shadow: 0 15px 40px rgba(30,25,21,0.06);">
        
        <!-- Header Banner -->
        <div style="background-color: #1e1915; padding: 35px 25px; text-align: center; border-bottom: 3px solid #c5a86b;">
          <h1 style="color: #ffffff; font-family: 'Cinzel', Georgia, serif; margin: 0; letter-spacing: 0.25em; font-size: 30px; text-transform: uppercase; font-weight: 400;">SHARNA</h1>
          <p style="font-size: 10px; color: #c5a86b; margin: 8px 0 0 0; text-transform: uppercase; letter-spacing: 0.2em;">REDEFINING ETHNIC FASHION WITH ELEGANCE • JABALPUR</p>
        </div>

        <div style="padding: 35px 30px;">
          
          <!-- Order Confirmation Title -->
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1.5px solid #FAF0E4; padding-bottom: 18px; margin-bottom: 25px;">
            <div>
              <span style="font-size: 10px; font-weight: 700; color: #155724; background-color: #D4EDDA; padding: 4px 10px; border-radius: 12px; text-transform: uppercase; letter-spacing: 0.05em;">
                OFFICIAL TAX INVOICE ✓
              </span>
              <h2 style="color: #1e1915; font-family: Georgia, serif; font-size: 20px; margin: 10px 0 0 0; font-weight: 400;">Thank You For Shopping!</h2>
            </div>
            <div style="text-align: right;">
              <div style="font-size: 14px; font-weight: 700; color: #1e1915;">#${orderDetails.orderId}</div>
              <div style="font-size: 11px; color: #7A6960; margin-top: 2px;">Payment: <strong>PAID</strong></div>
            </div>
          </div>

          <p style="font-size: 14px; color: #5C4E46; line-height: 1.6; margin-bottom: 20px;">
            Dear <strong>${orderDetails.shippingName || 'Valued Customer'}</strong>,<br>
            Your order has been verified and confirmed at our Jabalpur warehouse. Below is the official itemized tax invoice for your purchase.
          </p>

          ${trackingBlock}

          <!-- Items Table -->
          <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
            <thead>
              <tr style="background-color: #FAF4EB; border-bottom: 1.5px solid #EAE1D5;">
                <th style="padding: 10px 12px; text-align: left; font-size: 11px; text-transform: uppercase; color: #1e1915; letter-spacing: 0.05em;">Garment</th>
                <th style="padding: 10px 12px; text-align: center; font-size: 11px; text-transform: uppercase; color: #1e1915; letter-spacing: 0.05em;">Variant</th>
                <th style="padding: 10px 12px; text-align: center; font-size: 11px; text-transform: uppercase; color: #1e1915; letter-spacing: 0.05em;">Qty</th>
                <th style="padding: 10px 12px; text-align: right; font-size: 11px; text-transform: uppercase; color: #1e1915; letter-spacing: 0.05em;">Price</th>
                <th style="padding: 10px 12px; text-align: right; font-size: 11px; text-transform: uppercase; color: #1e1915; letter-spacing: 0.05em;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>

          <!-- Financial Breakdown -->
          <div style="margin-top: 25px; display: flex; justify-content: flex-end;">
            <table style="width: 250px; border-collapse: collapse; font-size: 13px; color: #5C4E46;">
              <tr>
                <td style="padding: 4px 0;">Subtotal:</td>
                <td style="padding: 4px 0; text-align: right; color: #1e1915; font-weight: 600;">${formatPrice(orderDetails.totalAmount - (orderDetails.shippingAmount || 0))}</td>
              </tr>
              <tr>
                <td style="padding: 4px 0;">Express Shipping:</td>
                <td style="padding: 4px 0; text-align: right; color: #155724; font-weight: 600;">${orderDetails.shippingAmount === 0 ? 'Complimentary' : formatPrice(orderDetails.shippingAmount)}</td>
              </tr>
              <tr style="border-top: 2px solid #1e1915; font-size: 16px; font-weight: 700; color: #1e1915;">
                <td style="padding: 10px 0 0 0;">Total Paid:</td>
                <td style="padding: 10px 0 0 0; text-align: right; color: #A67E39;">${formatPrice(orderDetails.totalAmount)}</td>
              </tr>
            </table>
          </div>

          <!-- Shipping Destination -->
          <div style="margin-top: 30px; padding: 20px; background-color: #FAF4EB; border-radius: 10px; border: 1px solid #EAE1D5;">
            <span style="font-size: 10px; font-weight: 700; color: #A67E39; text-transform: uppercase; letter-spacing: 0.1em; display: block; margin-bottom: 6px;">DELIVERY DESTINATION</span>
            <div style="font-size: 13.5px; color: #1e1915; font-weight: 600;">${orderDetails.shippingName}</div>
            <div style="font-size: 12.5px; color: #5C4E46; margin-top: 4px; line-height: 1.5;">
              ${orderDetails.shippingStreet}<br>
              ${orderDetails.shippingCity}, ${orderDetails.shippingState} - ${orderDetails.shippingPostalCode}<br>
              ${orderDetails.shippingCountry || 'India'}
            </div>
          </div>

          <!-- Direct Account CTA -->
          <div style="text-align: center; margin-top: 35px;">
            <a href="https://sharna.com/orders" target="_blank" style="display: inline-block; padding: 14px 32px; background-color: #1e1915; color: #FAF7F2; text-decoration: none; border-radius: 25px; font-size: 12px; font-weight: 700; letter-spacing: 0.15em; text-transform: uppercase; box-shadow: 0 4px 15px rgba(30,25,21,0.15);">
              VIEW ORDER IN PROFILE →
            </a>
          </div>

        </div>

        <!-- Footer -->
        <div style="background-color: #FAF7F2; padding: 25px; text-align: center; border-top: 1px solid #EAE1D5; font-size: 11px; color: #7A6960; line-height: 1.6;">
          <p style="margin: 0; font-weight: 600; color: #1e1915;">SHARNA ETHNIC WEAR</p>
          <p style="margin: 4px 0 0 0;">Founded by Mrs. Swati Kureel • Jabalpur, Madhya Pradesh, India</p>
          <p style="margin: 8px 0 0 0; color: #999;">Need assistance? Contact sharnaapparels@gmail.com or WhatsApp +91 62682 18135</p>
        </div>

      </div>

    </body>
    </html>
  `;

  return sendResendEmail({
    to: email,
    subject: `Order Confirmed #${orderDetails.orderId} - SHARNA Tax Invoice`,
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
          <p style="margin: 4px 0 0 0;">Founded by Mrs. Swati Kureel • Jabalpur, Madhya Pradesh, India</p>
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
  sendWishlistReminderEmail
};
