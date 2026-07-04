const Razorpay = require('razorpay');
const crypto = require('crypto');
const Order = require('../models/order.model');

// Initialize Razorpay SDK instance
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || 'dummy_key',
  key_secret: process.env.RAZORPAY_KEY_SECRET || 'dummy_secret'
});

exports.createRazorpayOrder = async (req, res) => {
  const { amount } = req.body; // Expecting amount in INR

  try {
    const options = {
      amount: Math.round(Number(amount) * 100), // convert to paise
      currency: 'INR',
      receipt: `receipt_${Date.now()}`
    };

    const order = await razorpay.orders.create(options);
    res.json({ success: true, order });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Razorpay order creation failed', error: error.message });
  }
};

exports.verifyPaymentSignature = async (req, res) => {
  const { orderId, razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;

  const generatedSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || 'dummy_secret')
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest('hex');

  if (generatedSignature === razorpaySignature) {
    const order = await Order.findById(orderId);
    if (order) {
      order.paymentStatus = 'Paid';
      order.razorpayPaymentId = razorpayPaymentId;
      order.razorpayOrderId = razorpayOrderId;
      await order.save();
      res.json({ success: true, message: 'Payment verified and saved successfully', order });
    } else {
      res.status(404).json({ success: false, message: 'Order not found' });
    }
  } else {
    res.status(400).json({ success: false, message: 'Invalid payment signature verification failed' });
  }
};
