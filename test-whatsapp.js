require('dotenv').config();
const { sendWhatsAppOTPText } = require('./src/utils/whatsapp.service');

const targetPhone = process.argv[2] || '917999715256';

console.log(`🚀 Sending Live WhatsApp Test Message to: ${targetPhone}...`);

sendWhatsAppOTPText(targetPhone, '482910')
  .then(res => {
    console.log('🎉 Live WhatsApp Test Result:', res);
  })
  .catch(err => {
    console.error('❌ Live WhatsApp Test Error:', err);
  });
