const prisma = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const { getCache, setCache, clearProductCache } = require('../utils/productCache');

// GET /api/products
exports.getAllProducts = async (req, res) => {
  const t0 = Date.now();
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
    const tDb = Date.now();
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
    const tDbEnd = Date.now();

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

    console.log(`[PERF] /api/products | DB query: ${tDbEnd - tDb}ms | total: ${Date.now() - t0}ms`);
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

// Lean PDP Projection — only retrieves required columns to minimize Supabase egress
const PDP_PRODUCT_SELECT = {
  id: true,
  title: true,
  slug: true,
  description: true,
  price: true,
  salePrice: true,
  category: true,
  collection: true,
  fabric: true,
  care: true,
  isPublished: true,
  isFeatured: true,
  createdAt: true,
  updatedAt: true,
  images: {
    select: { id: true, url: true, isPrimary: true }
  },
  variants: {
    select: { id: true, size: true, color: true, colorHex: true, stock: true, sku: true }
  },
  reviews: {
    where: { isVisible: true },
    select: {
      id: true,
      rating: true,
      title: true,
      body: true,
      imageUrl: true,
      createdAt: true,
      user: { select: { name: true } }
    },
    orderBy: { createdAt: 'desc' }
  }
};

// GET /api/products/:slug (matches slug or id using optimized direct unique indexes)
exports.getProductBySlug = async (req, res) => {
  const t0 = Date.now();
  const rawParam = String(req.params.slug || '').trim();
  const lowerParam = rawParam.toLowerCase();

  // 1. Check in-memory cache for fast hit (supports both slug and ID keys)
  const cachedData = getCache(`/api/products/${lowerParam}`) || getCache(`/api/products/${rawParam}`);
  if (cachedData) {
    console.log(`[PERF] /api/products/:slug | cache: HIT | total: ${Date.now() - t0}ms`);
    return res.json(cachedData);
  }

  const tDb = Date.now();
  try {
    let product = null;
    const isCuidLike = /^c[a-z0-9]{20,}$/i.test(rawParam);

    // 2. Optimized single-index lookup: use primary key index for CUID IDs, unique index for slugs
    if (isCuidLike) {
      product = await prisma.product.findUnique({
        where: { id: rawParam },
        select: PDP_PRODUCT_SELECT
      });
    }

    if (!product) {
      // Direct indexed seek on Product.slug unique constraint
      product = await prisma.product.findUnique({
        where: { slug: lowerParam },
        select: PDP_PRODUCT_SELECT
      });
    }

    if (!product && !isCuidLike) {
      // Fallback: check Product.id in case identifier was a non-CUID formatted ID
      product = await prisma.product.findUnique({
        where: { id: rawParam },
        select: PDP_PRODUCT_SELECT
      }).catch(() => null);
    }

    const tDbEnd = Date.now();

    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    const tSer = Date.now();
    const result = { success: true, product };

    // 3. Bidirectional caching: store by both slug and ID so either route hits memory
    setCache(`/api/products/${lowerParam}`, result);
    if (rawParam !== lowerParam) {
      setCache(`/api/products/${rawParam}`, result);
    }
    if (product.id) {
      setCache(`/api/products/${product.id}`, result);
      setCache(`/api/products/${product.id.toLowerCase()}`, result);
    }
    if (product.slug) {
      setCache(`/api/products/${product.slug.toLowerCase()}`, result);
    }

    const tSerEnd = Date.now();
    console.log(`[PERF] /api/products/:slug | DB query: ${tDbEnd - tDb}ms | serialization: ${tSerEnd - tSer}ms | total: ${Date.now() - t0}ms`);

    res.json(result);
  } catch (err) {
    console.error(`[PERF] /api/products/:slug ERROR (${Date.now() - t0}ms):`, err.message);
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
