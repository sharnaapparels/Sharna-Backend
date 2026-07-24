const axios = require('axios');

/**
 * Send an OTP via Meta WhatsApp Cloud API
 * Uses a template message (required for business-initiated messages)
 */
const sendWhatsAppOTP = async (phone, otp) => {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;

  // Format phone: ensure it starts with country code (India = 91)
  // Input can be: 9876543210 or +919876543210 or 919876543210
  let formattedPhone = phone.replace(/\D/g, ''); // strip non-digits
  if (formattedPhone.length === 10) {
    formattedPhone = '91' + formattedPhone; // default to India
  }
  if (formattedPhone.startsWith('+')) {
    formattedPhone = formattedPhone.slice(1);
  }

  const url = `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`;

  const payload = {
    messaging_product: 'whatsapp',
    to: formattedPhone,
    type: 'template',
    template: {
      name: 'sharna_otp', // Template name you create in Meta Business Manager
      language: { code: 'en' },
      components: [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: otp },           // {{1}} - OTP code
            { type: 'text', text: '10 minutes' }   // {{2}} - validity
          ]
        },
        {
          type: 'button',
          sub_type: 'url',
          index: '0',
          parameters: [{ type: 'text', text: otp }] // for "Copy Code" button
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
    console.log(`✅ WhatsApp OTP sent to ${formattedPhone}`);
    return { success: true, messageId: response.data.messages?.[0]?.id };
  } catch (error) {
    const errData = error.response?.data;
    console.error('❌ WhatsApp OTP Error (Non-blocking):', errData || error.message);
    return { success: false, error: errData?.error?.message || error.message };
  }
};

/**
 * Send OTP via plain text message (fallback, uses free_form text)
 * Only works for numbers in your Meta test/sandbox list during development
 */
const sendWhatsAppOTPText = async (phone, otp) => {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;

  let formattedPhone = phone.replace(/\D/g, '');
  if (formattedPhone.length === 10) formattedPhone = '91' + formattedPhone;

  const url = `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`;

  const payload = {
    messaging_product: 'whatsapp',
    to: formattedPhone,
    type: 'text',
    text: {
      body: `🌸 *Sharna* — Your OTP is: *${otp}*\n\nThis code is valid for 10 minutes. Do not share it with anyone.\n\n_Sustainable Fashion & Lasting Luxury_`
    }
  };

  try {
    const response = await axios.post(url, payload, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });
    console.log(`✅ WhatsApp OTP (text) sent to ${formattedPhone}`);
    return { success: true, messageId: response.data.messages?.[0]?.id };
  } catch (error) {
    const errData = error.response?.data;
    console.error('❌ WhatsApp text OTP Error (Non-blocking):', errData || error.message);
    return { success: false, error: errData?.error?.message || error.message };
  }
};

/**
 * Send invoice/receipt via WhatsApp text message (for development/testing)
 */
const sendWhatsAppInvoice = async (phone, orderDetails) => {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;

  let formattedPhone = phone.replace(/\D/g, '');
  if (formattedPhone.length === 10) formattedPhone = '91' + formattedPhone;

  const url = `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`;

  const itemsList = orderDetails.items.map(item => 
    `- *${item.title || 'Garment'}* (${item.size || 'S'}/${item.color || 'Default'}) x${item.quantity}: ₹${(item.price * item.quantity).toLocaleString('en-IN')}`
  ).join('\n');

  const trackingText = orderDetails.awbCode ? `\n🚚 *SHIPMENT DISPATCHED VIA SHIPROCKET:*\n*Courier:* ${orderDetails.courierName || 'Delhivery Express Air'}\n*AWB Tracking Code:* ${orderDetails.awbCode}\n*Track Live:* ${orderDetails.trackingUrl || `https://shiprocket.co/tracking/${orderDetails.awbCode}`}\n` : '';

  const messageBody = `🌸 *SHARNA* — Order Confirmed! 🎉\n\nThank you for shopping with us, *${orderDetails.shippingName || 'Valued Customer'}*! Your payment has been successfully verified.\n\n*TAX INVOICE BILL:*\n*Order Reference:* #${orderDetails.orderId}\n*Date:* ${new Date().toLocaleDateString('en-IN')}\n*Payment Status:* PAID ✓\n\n*PURCHASED GARMENTS:*\n${itemsList}\n\n*Subtotal:* ₹${(orderDetails.totalAmount - (orderDetails.shippingAmount || 0)).toLocaleString('en-IN')}\n*Express Shipping:* ${orderDetails.shippingAmount === 0 ? 'Complimentary' : `₹${orderDetails.shippingAmount.toLocaleString('en-IN')}`}\n*Total Paid:* ₹${orderDetails.totalAmount.toLocaleString('en-IN')}\n${trackingText}\n*DELIVERY DESTINATION:*\n${orderDetails.shippingName}\n${orderDetails.shippingStreet}, ${orderDetails.shippingCity}, ${orderDetails.shippingState} - ${orderDetails.shippingPostalCode}\n\n_Redefining Ethnic Fashion with Elegance • Jabalpur, M.P._`;

  const payload = {
    messaging_product: 'whatsapp',
    to: formattedPhone,
    type: 'text',
    text: {
      body: messageBody
    }
  };

  try {
    // Check if the credentials are dummy/placeholders
    if (!accessToken || accessToken === 'your_meta_permanent_system_user_token' || !phoneNumberId || phoneNumberId === 'your_whatsapp_phone_number_id') {
      console.log(`\n================= [SIMULATED WHATSAPP INVOICE] =================`);
      console.log(`To: ${formattedPhone}`);
      console.log(`Content:\n${messageBody}`);
      console.log(`================================================================\n`);
      return { success: true, simulated: true };
    }

    const response = await axios.post(url, payload, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });
    console.log(`✅ WhatsApp Invoice sent to ${formattedPhone}`);
    return { success: true, messageId: response.data.messages?.[0]?.id };
  } catch (error) {
    const errData = error.response?.data;
    console.error('❌ WhatsApp Invoice Error (Non-blocking):', errData || error.message);
    // Print fallback text log on error
    console.log(`\n================= [SIMULATED WHATSAPP INVOICE FALLBACK] =================`);
    console.log(`To: ${formattedPhone}`);
    console.log(`Content:\n${messageBody}`);
    console.log(`=========================================================================\n`);
    return { success: false, error: errData?.error?.message || error.message };
  }
};

/**
 * Send Wishlist Reminder via WhatsApp message
 */
const sendWhatsAppWishlistReminder = async (phone, { name, items = [] }) => {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;

  let formattedPhone = phone.replace(/\D/g, '');
  if (formattedPhone.length === 10) formattedPhone = '91' + formattedPhone;

  const url = `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`;

  const itemsList = items.map(item => 
    `- *${item.title || 'Luxury Garment'}*: ₹${(item.price || 0).toLocaleString('en-IN')}`
  ).join('\n');

  const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';

  const messageBody = `🌸 *SHARNA* — Your Wishlist Favorites Are Waiting! 🛍️\n\nHello *${name || 'Valued Customer'}*,\n\nYou left some gorgeous handcrafted designs in your wishlist! Stock is limited for these pieces.\n\n*YOUR SAVED WISHLIST ITEMS:*\n${itemsList}\n\n*Complete your order here:* ${clientUrl}\n\n_Redefining Ethnic Fashion with Elegance • Jabalpur, M.P._`;

  const payload = {
    messaging_product: 'whatsapp',
    to: formattedPhone,
    type: 'text',
    text: {
      body: messageBody
    }
  };

  try {
    if (!accessToken || accessToken === 'your_meta_permanent_system_user_token' || !phoneNumberId || phoneNumberId === 'your_whatsapp_phone_number_id') {
      console.log(`\n================= [SIMULATED WHATSAPP WISHLIST REMINDER] =================`);
      console.log(`To: ${formattedPhone}`);
      console.log(`Content:\n${messageBody}`);
      console.log(`=========================================================================\n`);
      return { success: true, simulated: true };
    }

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
    console.log(`\n================= [SIMULATED WHATSAPP WISHLIST REMINDER FALLBACK] =================`);
    console.log(`To: ${formattedPhone}`);
    console.log(`Content:\n${messageBody}`);
    console.log(`===================================================================================\n`);
    return { success: false, error: errData?.error?.message || error.message };
  }
};

module.exports = { 
  sendWhatsAppOTP, 
  sendWhatsAppOTPText, 
  sendWhatsAppInvoice, 
  sendWhatsAppWishlistReminder 
};

