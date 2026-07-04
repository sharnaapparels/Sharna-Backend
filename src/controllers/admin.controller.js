const User = require('../models/user.model');
const Order = require('../models/order.model');
const Product = require('../models/product.model');

exports.getDashboardStats = async (req, res) => {
  const totalRevenueData = await Order.aggregate([
    { $match: { paymentStatus: 'Paid' } },
    { $group: { _id: null, total: { $sum: '$totalAmount' } } }
  ]);

  const totalRevenue = totalRevenueData[0] ? totalRevenueData[0].total : 0;
  const totalOrders = await Order.countDocuments();
  const totalUsers = await User.countDocuments({ role: 'user' });
  const totalProducts = await Product.countDocuments();

  res.json({
    success: true,
    stats: {
      totalRevenue,
      totalOrders,
      totalUsers,
      totalProducts
    }
  });
};

exports.getAllUsers = async (req, res) => {
  const users = await User.find({ role: 'user' }).select('-password').sort('-createdAt');
  res.json({ success: true, users });
};

exports.toggleBlockUser = async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) {
    return res.status(404).json({ success: false, message: 'User not found' });
  }

  user.isBlocked = !user.isBlocked;
  await user.save();

  res.json({ success: true, message: `User status updated. Blocked: ${user.isBlocked}`, user });
};

exports.getAllOrders = async (req, res) => {
  const orders = await Order.find().populate('user', 'name email').sort('-createdAt');
  res.json({ success: true, orders });
};

exports.updateOrderStatus = async (req, res) => {
  const { orderStatus, trackingNumber } = req.body;

  const order = await Order.findById(req.params.id);
  if (!order) {
    return res.status(404).json({ success: false, message: 'Order not found' });
  }

  if (orderStatus) order.orderStatus = orderStatus;
  if (trackingNumber) order.trackingNumber = trackingNumber;

  await order.save();
  res.json({ success: true, message: 'Order status updated successfully', order });
};
