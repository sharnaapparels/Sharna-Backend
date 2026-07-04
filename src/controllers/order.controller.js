const Order = require('../models/order.model');
const Cart = require('../models/cart.model');
const { sendWhatsAppNotification } = require('../utils/whatsapp');

exports.createOrder = async (req, res) => {
  const { items, totalAmount, shippingAddress, paymentMethod, razorpayOrderId } = req.body;

  if (!items || items.length === 0) {
    return res.status(400).json({ success: false, message: 'No items in order' });
  }

  const order = await Order.create({
    user: req.user._id,
    items,
    totalAmount,
    shippingAddress,
    paymentMethod,
    razorpayOrderId
  });

  // Clear user's cart
  await Cart.findOneAndUpdate({ user: req.user._id }, { items: [] });

  // Send Meta WhatsApp notification
  if (req.user.phone) {
    await sendWhatsAppNotification(
      req.user.phone,
      'order_confirmation',
      [req.user.name, order._id.toString(), `RS. ${totalAmount}`]
    );
  }

  res.status(201).json({ success: true, order });
};

exports.getMyOrders = async (req, res) => {
  const orders = await Order.find({ user: req.user._id }).sort('-createdAt');
  res.json({ success: true, orders });
};

exports.getOrderById = async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) {
    return res.status(404).json({ success: false, message: 'Order not found' });
  }

  // Ensure authorized user
  if (order.user.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Not authorized to view this order' });
  }

  res.json({ success: true, order });
};
