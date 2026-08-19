require('dotenv').config();
const { sendWhatsAppOTP } = require('./src/utils/whatsapp.service');

const testPhone = process.argv[2] || '919202709524';
const testOtp = '889900';

console.log(`📱 Initiating local test WhatsApp OTP dispatch to ${testPhone}...`);

sendWhatsAppOTP(testPhone, testOtp)
  .then(res => {
    console.log('Result:', JSON.stringify(res, null, 2));
    if (res.success) {
      console.log(`\n🎉 SUCCESS! WhatsApp message was dispatched by Meta! Check your phone ${testPhone} for code ${testOtp}!`);
    } else {
      console.log(`\n⚠️ Dispatch result:`, res.error);
    }
  })
  .catch(err => {
    console.error('Execution Error:', err.message);
  });
