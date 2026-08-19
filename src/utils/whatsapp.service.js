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
 * Send Order Confirmation with Attached PDF Invoice via Meta WhatsApp Cloud API
 * Uses 'sharna_order_invoice' (with PDF Document header) or falls back to 'sharna_order_confirmation'
 */
const sendWhatsAppOrderInvoicePDF = async (phone, orderDetails, pdfUrl) => {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID || '1286005934592878';
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;

  let formattedPhone = String(phone).replace(/\D/g, '');
  if (formattedPhone.length === 10) formattedPhone = '91' + formattedPhone;

  const url = `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`;

  const customerName = String(orderDetails.shippingName || orderDetails.userName || 'Valued Patron').split(' ')[0];
  const orderId = String(orderDetails.orderId || orderDetails.id || 'SHARNA').slice(-8).toUpperCase();
  const totalAmt = String(Math.round(Number(orderDetails.totalAmount || 0)));
  const documentUrl = pdfUrl || orderDetails.pdfUrl;

  // If a PDF document URL is available, send with Document Header
  if (documentUrl) {
    const docPayload = {
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
                document: {
                  link: documentUrl,
                  filename: `SHARNA-Tax-Invoice-${orderId}.pdf`
                }
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

    try {
      const response = await axios.post(url, docPayload, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });
      console.log(`✅ WhatsApp Order Invoice PDF sent to ${formattedPhone}`);
      return { success: true, messageId: response.data.messages?.[0]?.id };
    } catch (error) {
      console.warn('⚠️ Document template fallback to standard confirmation:', error.response?.data?.error?.message || error.message);
    }
  }

  // Fallback to text order confirmation template
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

  const customerName = String(orderDetails.shippingName || orderDetails.userName || 'Valued Patron').split(' ')[0];
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
            { type: 'text', text: customerName }, // {{1}} Name
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

// Aliases for backwards compatibility
const sendWhatsAppInvoice = sendWhatsAppOrderInvoicePDF;
const sendWhatsAppOTPText = sendWhatsAppOTP;

module.exports = { 
  sendWhatsAppOTP, 
  sendWhatsAppOTPText, 
  sendWhatsAppOrderConfirmation,
  sendWhatsAppOrderInvoicePDF,
  sendWhatsAppInvoice, 
  sendWhatsAppWishlistReminder 
};
