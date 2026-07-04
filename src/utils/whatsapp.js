const axios = require('axios');

/**
 * Sends a Meta WhatsApp Cloud API template notification
 * @param {string} recipientPhone Phone number in E.164 format (e.g. 919876543210)
 * @param {string} templateName WhatsApp business manager approved template name
 * @param {Array<string>} bodyParameters Array of template variable values
 */
const sendWhatsAppNotification = async (recipientPhone, templateName, bodyParameters = []) => {
  const WHATSAPP_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
  const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!WHATSAPP_TOKEN || !PHONE_NUMBER_ID) {
    console.warn('⚠️ WhatsApp credentials missing. Skipping notification send.');
    return false;
  }

  // Clean phone number (strip whitespace, + signs, non-digits)
  const cleanPhone = recipientPhone.replace(/\D/g, '');

  try {
    const response = await axios.post(
      `https://graph.facebook.com/v18.0/${PHONE_NUMBER_ID}/messages`,
      {
        messaging_product: 'whatsapp',
        to: cleanPhone,
        type: 'template',
        template: {
          name: templateName,
          language: { code: 'en_US' },
          components: [
            {
              type: 'body',
              parameters: bodyParameters.map(text => ({
                type: 'text',
                text: String(text)
              }))
            }
          ]
        }
      },
      {
        headers: {
          Authorization: `Bearer ${WHATSAPP_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log(`✉️ WhatsApp template "${templateName}" sent successfully to ${cleanPhone}. Message ID:`, response.data?.messages?.[0]?.id);
    return true;
  } catch (error) {
    console.error('❌ Error sending Meta WhatsApp message:', error.response?.data || error.message);
    return false;
  }
};

module.exports = { sendWhatsAppNotification };
