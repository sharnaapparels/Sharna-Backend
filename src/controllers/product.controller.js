const prisma = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const { getCache, setCache, clearProductCache } = require('../utils/productCache');

// GET /api/products
exports.getAllProducts = async (req, res) => {
  res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=600');

  const { category, collection, search, minPrice, maxPrice, page = 1, limit = 50 } = req.query;

  const isGenericFetch = !category && !collection && !search && !minPrice && !maxPrice;
  const cacheKey = isGenericFetch ? 'all_products_catalog' : (req.originalUrl || '/api/products');

  const cachedData = getCache(cacheKey);
  if (cachedData) {
    return res.json(cachedData);
  }

  const where = { isPublished: true };
  if (category) where.category = category;
  if (collection) where.collection = collection;
  if (search) where.title = { contains: search, mode: 'insensitive' };
  if (minPrice || maxPrice) {
    where.price = {};
    if (minPrice) where.price.gte = parseFloat(minPrice);
    if (maxPrice) where.price.lte = parseFloat(maxPrice);
  }

  try {
    const products = await prisma.product.findMany({
      where,
      select: {
        id: true,
        title: true,
        slug: true,
        price: true,
        salePrice: true,
        category: true,
        collection: true,
        isPublished: true,
        isFeatured: true,
        createdAt: true,
        images: { select: { id: true, url: true, isPrimary: true } },
        variants: { select: { id: true, size: true, color: true, stock: true } }
      },
      take: parseInt(limit),
      orderBy: { createdAt: 'desc' }
    });

    const sanitizedProducts = products.map(p => ({
      ...p,
      images: (p.images || []).map(img => ({
        ...img,
        url: typeof img.url === 'string' && img.url.startsWith('data:image')
          ? 'https://res.cloudinary.com/dph921x1w/image/upload/v1724500000/sharna-fallback.jpg'
          : img.url
      }))
    }));

    const result = { success: true, products: sanitizedProducts, total: sanitizedProducts.length, page: 1, pages: 1 };
    setCache(cacheKey, result);
    if (isGenericFetch) setCache('all_products_catalog', result);

    res.json(result);
  } catch (err) {
    console.error("Fetch products error:", err.message);
    const staleCache = getCache('all_products_catalog') || getCache('/api/products');
    if (staleCache) {
      return res.json(staleCache);
    }
    res.status(500).json({ success: false, message: 'Failed to retrieve products' });
  }
};

// GET /api/products/:slug (matches slug or id)
exports.getProductBySlug = async (req, res) => {
  const { slug: identifier } = req.params;
  const cacheKey = `/api/products/${identifier}`;
  const cachedData = getCache(cacheKey);
  if (cachedData) {
    return res.json(cachedData);
  }

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
    const result = { success: true, product };
    setCache(cacheKey, result);
    res.json(result);
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

  clearProductCache();
  res.status(201).json({ success: true, product });
};

// PUT /api/products/:id (admin)
exports.updateProduct = async (req, res) => {
  const product = await prisma.product.update({
    where: { id: req.params.id },
    data: req.body,
    include: { images: true, variants: true }
  });
  clearProductCache();
  res.json({ success: true, product });
};

// DELETE /api/products/:id (admin)
exports.deleteProduct = async (req, res) => {
  await prisma.product.delete({ where: { id: req.params.id } });
  clearProductCache();
  res.json({ success: true, message: 'Product deleted' });
};
