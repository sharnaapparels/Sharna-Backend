const Wishlist = require('../models/wishlist.model');

exports.getWishlist = async (req, res) => {
  let wishlist = await Wishlist.findOne({ user: req.user._id }).populate('products');
  if (!wishlist) {
    wishlist = await Wishlist.create({ user: req.user._id, products: [] });
  }
  res.json({ success: true, wishlist });
};

exports.toggleWishlist = async (req, res) => {
  const { productId } = req.body;

  let wishlist = await Wishlist.findOne({ user: req.user._id });
  if (!wishlist) {
    wishlist = await Wishlist.create({ user: req.user._id, products: [] });
  }

  const index = wishlist.products.indexOf(productId);
  if (index > -1) {
    wishlist.products.splice(index, 1);
  } else {
    wishlist.products.push(productId);
  }

  await wishlist.save();
  await wishlist.populate('products');

  res.json({ success: true, wishlist });
};
