const prisma = require('../config/database');
const { v4: uuidv4 } = require('uuid');

// GET /api/products
exports.getAllProducts = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  const { category, collection, search, minPrice, maxPrice, page = 1, limit = 50 } = req.query;

  const where = { isPublished: true };
  if (category) where.category = category;
  if (collection) where.collection = collection;
  if (search) where.title = { contains: search, mode: 'insensitive' };
  if (minPrice || maxPrice) {
    where.price = {};
    if (minPrice) where.price.gte = parseFloat(minPrice);
    if (maxPrice) where.price.lte = parseFloat(maxPrice);
  }

  const [products, total] = await prisma.$transaction([
    prisma.product.findMany({
      where,
      include: { images: true, variants: true, reviews: { select: { rating: true } } },
      skip: (page - 1) * limit,
      take: parseInt(limit),
      orderBy: { createdAt: 'desc' }
    }),
    prisma.product.count({ where })
  ]);

  res.json({ success: true, products, total, page: parseInt(page), pages: Math.ceil(total / limit) });
};

// GET /api/products/:slug (matches slug or id)
exports.getProductBySlug = async (req, res) => {
  const { slug: identifier } = req.params;

  try {
    const product = await prisma.product.findFirst({
      where: {
        OR: [
          { id: identifier },
          { slug: identifier }
        ]
      },
      include: {
        images: true,
        variants: true,
        reviews: { include: { user: { select: { name: true } } } }
      }
    });

    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
    res.json({ success: true, product });
  } catch (err) {
    console.error("Fetch product failed:", err.message);
    res.status(500).json({ success: false, message: 'Failed to retrieve product' });
  }
};

// POST /api/products (admin)
exports.createProduct = async (req, res) => {
  const { title, description, price, salePrice, category, collection, fabric, care, variants, images } = req.body;

  const slug = title.toLowerCase().replace(/\s+/g, '-') + '-' + uuidv4().slice(0, 6);

  const product = await prisma.product.create({
    data: {
      title, slug, description, price: parseFloat(price),
      salePrice: salePrice ? parseFloat(salePrice) : null,
      category, collection, fabric, care,
      images: images ? { create: images } : undefined,
      variants: variants ? { create: variants } : undefined
    },
    include: { images: true, variants: true }
  });

  res.status(201).json({ success: true, product });
};

// PUT /api/products/:id (admin)
exports.updateProduct = async (req, res) => {
  const product = await prisma.product.update({
    where: { id: req.params.id },
    data: req.body,
    include: { images: true, variants: true }
  });
  res.json({ success: true, product });
};

// DELETE /api/products/:id (admin)
exports.deleteProduct = async (req, res) => {
  await prisma.product.delete({ where: { id: req.params.id } });
  res.json({ success: true, message: 'Product deleted' });
};
