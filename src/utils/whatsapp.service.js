const axios = require('axios');

/**
 * Send an OTP via Meta WhatsApp Cloud API
 * Uses approved 'sharna_otp' template
 */
const sendWhatsAppOTP = async (phone, otp) => {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID || '1286005934592878';
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;

  let formattedPhone = String(phone).replace(/\D/g, '');
  if (formattedPhone.length === 10) formattedPhone = '91' + formattedPhone;
  if (formattedPhone.startsWith('+')) formattedPhone = formattedPhone.slice(1);

  const url = `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`;

  const payload = {
    messaging_product: 'whatsapp',
    to: formattedPhone,
    type: 'template',
    template: {
      name: 'sharna_otp',
      language: { code: 'en' },
      components: [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: String(otp) } // {{1}} - OTP code
          ]
        },
        {
          type: 'button',
          sub_type: 'url',
          index: '0',
          parameters: [
            { type: 'text', text: String(otp) } // for "Copy code" button url
          ]
        }
      ]
    }
  };

  try {
    const response = await axios.post(url, payload, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });
    console.log(`✅ WhatsApp Live OTP sent to ${formattedPhone} (Message ID: ${response.data.messages?.[0]?.id})`);
    return { success: true, messageId: response.data.messages?.[0]?.id };
  } catch (error) {
    const errData = error.response?.data;
    console.error('❌ WhatsApp OTP Error (Non-blocking):', errData || error.message);
    return { success: false, error: errData?.error?.message || error.message };
  }
};

/**
 * Helper to safely format clean customer salutation/name
 * Handles prefixes like "Mrs. Swati Kureel" -> "Mrs. Swati", "Swati Kureel" -> "Swati"
 */
const formatCustomerName = (orderDetails = {}) => {
  const rawName = String(
    orderDetails.shippingName || 
    orderDetails.userName || 
    orderDetails.user?.name || 
    orderDetails.shippingAddress?.fullName || 
    'Valued Patron'
  ).trim();

  if (!rawName || rawName.toLowerCase() === 'valued patron') {
    return 'Valued Patron';
  }

  const parts = rawName.split(/\s+/).filter(Boolean);
  const titlePrefixes = ['mr', 'mr.', 'mrs', 'mrs.', 'ms', 'ms.', 'dr', 'dr.', 'shri', 'smt', 'prof', 'prof.'];

  // If first word is a salutation (e.g. Mrs., Mr., Dr.), combine it with the actual name
  if (parts.length >= 2 && titlePrefixes.includes(parts[0].toLowerCase())) {
    return `${parts[0]} ${parts[1]}`;
  }

  // If full name, return first name
  if (parts.length > 0) {
    return parts[0];
  }

  return rawName;
};

/**
 * Send Order Confirmation with Attached PDF Invoice via Meta WhatsApp Cloud API
 * Uses direct Meta Media Upload to bypass any CDN caching
 */
const sendWhatsAppOrderInvoicePDF = async (phone, orderDetails, pdfUrl) => {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID || '1286005934592878';
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;

  let formattedPhone = String(phone).replace(/\D/g, '');
  if (formattedPhone.length === 10) formattedPhone = '91' + formattedPhone;
  if (formattedPhone.startsWith('+')) formattedPhone = formattedPhone.slice(1);

  const url = `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`;
  const rawId = orderDetails.id || orderDetails.orderId || orderDetails.orderNumber || 'SHARNA';
  const orderId = String(rawId).slice(-8).toUpperCase();
  const totalAmt = String(Math.round(Number(orderDetails.totalAmount || 0)));
  const customerName = formatCustomerName(orderDetails);

  let docParam = null;

  // 1. Generate PDF buffer and upload directly to Meta Media API
  try {
    const FormData = require('form-data');
    const { generateInvoicePDFBuffer } = require('./pdfInvoice.service');
    const pdfBuf = await generateInvoicePDFBuffer(orderDetails);

    const form = new FormData();
    form.append('messaging_product', 'whatsapp');
    form.append('type', 'application/pdf');
    form.append('file', pdfBuf, {
      filename: `SHARNA-Tax-Invoice-${orderId}.pdf`,
      contentType: 'application/pdf'
    });

    const mediaRes = await axios.post(`https://graph.facebook.com/v21.0/${phoneNumberId}/media`, form, {
      headers: {
        ...form.getHeaders(),
        Authorization: `Bearer ${accessToken}`
      }
    });

    if (mediaRes.data?.id) {
      docParam = {
        id: mediaRes.data.id,
        filename: `SHARNA-Tax-Invoice-${orderId}.pdf`
      };
      console.log(`✅ Direct Meta Media PDF upload succeeded (Media ID: ${mediaRes.data.id})`);
    }
  } catch (mediaErr) {
    console.warn('⚠️ Meta direct media upload notice, falling back to document link:', mediaErr.response?.data || mediaErr.message);
  }

  // Fallback to URL link if direct media upload is unavailable
  if (!docParam) {
    const documentUrl = pdfUrl || orderDetails.pdfUrl || `https://sharna-backend-production.up.railway.app/api/orders/${rawId}/invoice.pdf?t=${Date.now()}`;
    docParam = {
      link: documentUrl,
      filename: `SHARNA-Tax-Invoice-${orderId}.pdf`
    };
  }

  // 2. Dispatch Approved 'sharna_order_invoice' Template
  try {
    const templateDocPayload = {
      messaging_product: 'whatsapp',
      to: formattedPhone,
      type: 'template',
      template: {
        name: 'sharna_order_invoice',
        language: { code: 'en' },
        components: [
          {
            type: 'header',
            parameters: [
              {
                type: 'document',
                document: docParam
              }
            ]
          },
          {
            type: 'body',
            parameters: [
              { type: 'text', text: customerName }, // {{1}} Name
              { type: 'text', text: orderId },      // {{2}} Order #
              { type: 'text', text: totalAmt }       // {{3}} Amount
            ]
          }
        ]
      }
    };

    const response = await axios.post(url, templateDocPayload, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    console.log(`✅ WhatsApp Order Invoice PDF sent to ${formattedPhone} (Message ID: ${response.data.messages?.[0]?.id})`);
    return { success: true, messageId: response.data.messages?.[0]?.id };
  } catch (error) {
    const errData = error.response?.data;
    console.warn('⚠️ sharna_order_invoice template error, falling back to confirmation template:', errData || error.message);
  }

  // 3. Fallback: Send standard text confirmation
  return sendWhatsAppOrderConfirmation(phone, orderDetails);
};

/**
 * Send Order Confirmation via Meta WhatsApp Cloud API
 * Uses approved 'sharna_order_confirmation' template
 */
const sendWhatsAppOrderConfirmation = async (phone, orderDetails) => {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID || '1286005934592878';
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;

  let formattedPhone = String(phone).replace(/\D/g, '');
  if (formattedPhone.length === 10) formattedPhone = '91' + formattedPhone;

  const url = `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`;

  const customerName = formatCustomerName(orderDetails);
  const orderId = String(orderDetails.orderId || orderDetails.id || 'SHARNA').slice(-8).toUpperCase();
  const totalAmt = String(Math.round(Number(orderDetails.totalAmount || 0)));

  const payload = {
    messaging_product: 'whatsapp',
    to: formattedPhone,
    type: 'template',
    template: {
      name: 'sharna_order_confirmation',
      language: { code: 'en' },
      components: [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: customerName }, // {{1}} Name (e.g. "Mrs. Swati" or "Swati")
            { type: 'text', text: orderId },      // {{2}} Order #
            { type: 'text', text: totalAmt }       // {{3}} Amount
          ]
        }
      ]
    }
  };

  try {
    const response = await axios.post(url, payload, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });
    console.log(`✅ WhatsApp Order Confirmation sent to ${formattedPhone}`);
    return { success: true, messageId: response.data.messages?.[0]?.id };
  } catch (error) {
    const errData = error.response?.data;
    console.error('❌ WhatsApp Order Confirmation Error (Non-blocking):', errData || error.message);
    return { success: false, error: errData?.error?.message || error.message };
  }
};

/**
 * Send Wishlist Reminder via Meta WhatsApp Cloud API
 * Uses approved 'sharna_wishlist_reminder' template
 */
const sendWhatsAppWishlistReminder = async (phone, { name, link = 'https://sharna.in/wishlist' }) => {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID || '1286005934592878';
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;

  let formattedPhone = String(phone).replace(/\D/g, '');
  if (formattedPhone.length === 10) formattedPhone = '91' + formattedPhone;

  const url = `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`;

  const customerName = String(name || 'Valued Patron').split(' ')[0];

  const payload = {
    messaging_product: 'whatsapp',
    to: formattedPhone,
    type: 'template',
    template: {
      name: 'sharna_wishlist_reminder',
      language: { code: 'en' },
      components: [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: customerName }, // {{1}} Name
            { type: 'text', text: link }          // {{2}} URL
          ]
        }
      ]
    }
  };

  try {
    const response = await axios.post(url, payload, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });
    console.log(`✅ WhatsApp Wishlist Reminder sent to ${formattedPhone}`);
    return { success: true, messageId: response.data.messages?.[0]?.id };
  } catch (error) {
    const errData = error.response?.data;
    console.error('❌ WhatsApp Wishlist Reminder Error (Non-blocking):', errData || error.message);
    return { success: false, error: errData?.error?.message || error.message };
  }
};

/**
 * Send Order Dispatched Notification via Meta WhatsApp Cloud API
 * Includes Delivery Estimate (3-5 Business Days), Courier & Tracking, and Support Contact (6868218135 / sharnaapparels@gmail.com)
 */
const sendWhatsAppOrderDispatched = async (phone, orderDetails = {}) => {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID || '1286005934592878';
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;

  const targetPhone = phone || orderDetails.shippingPhone || orderDetails.user?.phone;
  if (!targetPhone) {
    console.warn('⚠️ WhatsApp dispatch skipped: No phone number available');
    return { success: false, error: 'No phone number' };
  }

  let formattedPhone = String(targetPhone).replace(/\D/g, '');
  if (formattedPhone.length === 10) formattedPhone = '91' + formattedPhone;
  if (formattedPhone.startsWith('+')) formattedPhone = formattedPhone.slice(1);

  const url = `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`;

  const customerName = formatCustomerName(orderDetails);
  const rawId = orderDetails.id || orderDetails.orderId || orderDetails.orderNumber || 'SHARNA';
  const orderId = String(rawId).slice(-8).toUpperCase();

  // Extract shipment details
  let notesObj = {};
  if (orderDetails.notes) {
    try {
      notesObj = typeof orderDetails.notes === 'string' ? JSON.parse(orderDetails.notes) : orderDetails.notes;
    } catch (_) {}
  }

  const courierName = orderDetails.courierName || notesObj.courierName || 'Express Logistics (Blue Dart / Delhivery)';
  const awbCode = orderDetails.awbCode || notesObj.awbCode || `AWB-${Math.floor(1000000000 + Math.random() * 9000000000)}`;
  const trackingUrl = orderDetails.trackingUrl || notesObj.trackingUrl || `https://sharna.in/orders`;

  // Calculate delivery date window (7-10 days)
  const now = new Date();
  const minDeliveryDate = new Date(now);
  minDeliveryDate.setDate(minDeliveryDate.getDate() + 7);
  const maxDeliveryDate = new Date(now);
  maxDeliveryDate.setDate(maxDeliveryDate.getDate() + 10);
  const deliveryWindowStr = `${minDeliveryDate.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })} – ${maxDeliveryDate.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}`;

  // 1. Try Template Dispatch first
  try {
    const templatePayload = {
      messaging_product: 'whatsapp',
      to: formattedPhone,
      type: 'template',
      template: {
        name: 'sharna_order_dispatch',
        language: { code: 'en' }
      }
    };

    const response = await axios.post(url, templatePayload, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    console.log(`✅ WhatsApp Order Dispatched template sent to ${formattedPhone} (Message ID: ${response.data.messages?.[0]?.id})`);
    return { success: true, messageId: response.data.messages?.[0]?.id };
  } catch (tmplErr) {
    console.warn('⚠️ Custom dispatch template not active on Meta yet, sending rich direct WhatsApp notification:', tmplErr.response?.data?.error?.message || tmplErr.message);
  }

  // 2. Simple, clean dispatch message requested by client
  const dispatchMessageText = 
`Your order is dispatched from SHARNA.

⏱️ *Estimated Delivery Time:* 7 to 10 Days (Expected: ${deliveryWindowStr})

📞 *For any questions or delivery support, connect with us:*
• WhatsApp / Call: +91 62682 18135 (https://wa.me/916268218135)
• Email: sharnaapparels@gmail.com

Thank you for shopping with SHARNA.`;

  try {
    const directPayload = {
      messaging_product: 'whatsapp',
      to: formattedPhone,
      type: 'text',
      text: {
        preview_url: true,
        body: dispatchMessageText
      }
    };

    const response = await axios.post(url, directPayload, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    console.log(`✅ Direct WhatsApp Dispatch Notification sent to ${formattedPhone} (Message ID: ${response.data.messages?.[0]?.id})`);
    return { success: true, messageId: response.data.messages?.[0]?.id };
  } catch (error) {
    const errData = error.response?.data;
    console.error('❌ WhatsApp Order Dispatched Message Error (Non-blocking):', errData || error.message);
    return { success: false, error: errData?.error?.message || error.message };
  }
};

// Aliases for backwards compatibility
const sendWhatsAppInvoice = sendWhatsAppOrderInvoicePDF;
const sendWhatsAppOTPText = sendWhatsAppOTP;

module.exports = { 
  sendWhatsAppOTP, 
  sendWhatsAppOTPText, 
  sendWhatsAppOrderConfirmation,
  sendWhatsAppOrderInvoicePDF,
  sendWhatsAppInvoice, 
  sendWhatsAppOrderDispatched,
  sendWhatsAppWishlistReminder 
};
