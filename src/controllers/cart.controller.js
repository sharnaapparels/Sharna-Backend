const Cart = require('../models/cart.model');

exports.getCart = async (req, res) => {
  let cart = await Cart.findOne({ user: req.user._id }).populate('items.product');
  if (!cart) {
    cart = await Cart.create({ user: req.user._id, items: [] });
  }
  res.json({ success: true, cart });
};

exports.addToCart = async (req, res) => {
  const { productId, size, color, quantity = 1 } = req.body;

  let cart = await Cart.findOne({ user: req.user._id });
  if (!cart) {
    cart = await Cart.create({ user: req.user._id, items: [] });
  }

  // Check if item exists in cart with same size and color
  const existingItemIndex = cart.items.findIndex(
    item => item.product.toString() === productId && item.size === size && item.color === color
  );

  if (existingItemIndex > -1) {
    cart.items[existingItemIndex].quantity += Number(quantity);
  } else {
    cart.items.push({ product: productId, size, color, quantity: Number(quantity) });
  }

  await cart.save();
  await cart.populate('items.product');

  res.json({ success: true, cart });
};

exports.updateCartItem = async (req, res) => {
  const { productId, size, color, quantity } = req.body;

  const cart = await Cart.findOne({ user: req.user._id });
  if (!cart) {
    return res.status(404).json({ success: false, message: 'Cart not found' });
  }

  const itemIndex = cart.items.findIndex(
    item => item.product.toString() === productId && item.size === size && item.color === color
  );

  if (itemIndex > -1) {
    if (Number(quantity) <= 0) {
      cart.items.splice(itemIndex, 1);
    } else {
      cart.items[itemIndex].quantity = Number(quantity);
    }
    await cart.save();
    await cart.populate('items.product');
    res.json({ success: true, cart });
  } else {
    res.status(404).json({ success: false, message: 'Item not found in cart' });
  }
};

exports.removeFromCart = async (req, res) => {
  const { productId } = req.params;
  const { size, color } = req.query;

  const cart = await Cart.findOne({ user: req.user._id });
  if (!cart) {
    return res.status(404).json({ success: false, message: 'Cart not found' });
  }

  cart.items = cart.items.filter(
    item => !(item.product.toString() === productId && item.size === size && item.color === color)
  );

  await cart.save();
  await cart.populate('items.product');
  res.json({ success: true, cart });
};

exports.clearCart = async (req, res) => {
  const cart = await Cart.findOne({ user: req.user._id });
  if (cart) {
    cart.items = [];
    await cart.save();
  }
  res.json({ success: true, message: 'Cart cleared' });
};
