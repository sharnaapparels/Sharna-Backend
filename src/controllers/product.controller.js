const Product = require('../models/product.model');
const slugify = require('slugify');

exports.getProducts = async (req, res) => {
  const { category, search, size, color, sort, page = 1, limit = 12 } = req.query;
  const queryObj = {};

  if (category) {
    queryObj.category = category;
  }

  if (search) {
    queryObj.$text = { $search: search };
  }

  if (size) {
    queryObj.sizes = size;
  }

  if (color) {
    queryObj['colors.name'] = color;
  }

  let query = Product.find(queryObj);

  // Sorting
  if (sort === 'price-asc') {
    query = query.sort('price');
  } else if (sort === 'price-desc') {
    query = query.sort('-price');
  } else {
    query = query.sort('-createdAt');
  }

  // Pagination
  const skip = (Number(page) - 1) * Number(limit);
  query = query.skip(skip).limit(Number(limit));

  const products = await query;
  const total = await Product.countDocuments(queryObj);

  res.json({
    success: true,
    total,
    page: Number(page),
    pages: Math.ceil(total / Number(limit)),
    products
  });
};

exports.getProductById = async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) {
    return res.status(404).json({ success: false, message: 'Product not found' });
  }
  res.json({ success: true, product });
};

exports.createProduct = async (req, res) => {
  const { title, description, price, originalPrice, category, sizes, colors, images, fit, inStock } = req.body;
  
  const slug = slugify(title, { lower: true });
  
  let saving = 0;
  if (originalPrice && originalPrice > price) {
    saving = originalPrice - price;
  }

  const product = await Product.create({
    title, slug, description, price, originalPrice, saving, category, sizes, colors, images, fit, inStock
  });

  res.status(201).json({ success: true, product });
};

exports.updateProduct = async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) {
    return res.status(404).json({ success: false, message: 'Product not found' });
  }

  if (req.body.title) {
    req.body.slug = slugify(req.body.title, { lower: true });
  }

  if (req.body.price && req.body.originalPrice) {
    req.body.saving = req.body.originalPrice - req.body.price;
  }

  const updatedProduct = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true });
  res.json({ success: true, product: updatedProduct });
};

exports.deleteProduct = async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) {
    return res.status(404).json({ success: false, message: 'Product not found' });
  }
  await product.deleteOne();
  res.json({ success: true, message: 'Product removed' });
};
