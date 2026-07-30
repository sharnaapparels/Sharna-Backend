require('dotenv').config();
const { sendEmailInvoice } = require('./src/utils/email.service');

const recipientEmail = process.argv[2] || 'priyanshulokhande72@gmail.com';

console.log(`🚀 Sending Live Verified Tax Invoice via Resend (orders@sharna.in) to: ${recipientEmail}...`);

const testOrder = {
  orderId: 'SHARNA-TEST-LIVE-INVOICE',
  totalAmount: 18500,
  shippingAmount: 0,
  user: { name: 'Valued Customer', email: recipientEmail, phone: '+91 9876543210' },
  shippingStreet: '123 Luxury Avenue, Sector 5',
  shippingCity: 'Mumbai',
  shippingState: 'Maharashtra',
  shippingPostalCode: '400001',
  shippingCountry: 'India',
  items: [
    {
      title: 'Blush Toga Co-ord Set (2 Pcs)',
      size: 'XS',
      color: 'Blush Pink',
      quantity: 1,
      price: 18500
    }
  ]
};

sendEmailInvoice(recipientEmail, testOrder)
  .then(res => {
    console.log('🎉 Resend Live Test Result:', res);
  })
  .catch(err => {
    console.error('❌ Resend Live Test Error:', err);
  });
