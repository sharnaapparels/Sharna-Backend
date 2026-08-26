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

  const tCacheStart = Date.now();
  const cachedData = getCache(cacheKey);
  const tCacheDur = Date.now() - tCacheStart;
  console.log(`[DB-DIAG] /api/products | cache lookup: ${tCacheDur}ms`);

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
    // 1. Measure base Product findMany query (scalar fields only)
    const tProdStart = Date.now();
    const baseProducts = await prisma.product.findMany({
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
        createdAt: true
      },
      take: parseInt(limit),
      orderBy: { createdAt: 'desc' }
    });
    const tProdDur = Date.now() - tProdStart;
    console.log(`[DB-DIAG] /api/products | product.findMany (base): ${tProdDur}ms (${baseProducts.length} rows)`);

    const productIds = baseProducts.map(p => p.id);

    // 2. Measure images relation query
    const tImgStart = Date.now();
    const images = productIds.length > 0 ? await prisma.productImage.findMany({
      where: { productId: { in: productIds } },
      select: { id: true, url: true, isPrimary: true, productId: true }
    }) : [];
    const tImgDur = Date.now() - tImgStart;
    console.log(`[DB-DIAG] /api/products | productImage.findMany (relation): ${tImgDur}ms (${images.length} rows)`);

    // 3. Measure variants relation query
    const tVarStart = Date.now();
    const variants = productIds.length > 0 ? await prisma.productVariant.findMany({
      where: { productId: { in: productIds } },
      select: { id: true, size: true, color: true, stock: true, productId: true }
    }) : [];
    const tVarDur = Date.now() - tVarStart;
    console.log(`[DB-DIAG] /api/products | productVariant.findMany (relation): ${tVarDur}ms (${variants.length} rows)`);

    // Assemble relations
    const imageMap = {};
    images.forEach(img => {
      if (!imageMap[img.productId]) imageMap[img.productId] = [];
      imageMap[img.productId].push({ id: img.id, url: img.url, isPrimary: img.isPrimary });
    });

    const variantMap = {};
    variants.forEach(v => {
      if (!variantMap[v.productId]) variantMap[v.productId] = [];
      variantMap[v.productId].push({ id: v.id, size: v.size, color: v.color, stock: v.stock });
    });

    const products = baseProducts.map(p => ({
      ...p,
      images: imageMap[p.id] || [],
      variants: variantMap[p.id] || []
    }));

    const sanitizedProducts = products.map(p => ({
      ...p,
      images: (p.images || []).map(img => ({
        ...img,
        url: typeof img.url === 'string' && img.url.startsWith('data:image')
          ? ''
          : img.url
      }))
    }));

    const totalDbMs = tProdDur + tImgDur + tVarDur;
    const result = { success: true, products: sanitizedProducts, total: sanitizedProducts.length, page: 1, pages: 1 };
    setCache(cacheKey, result);
    if (isGenericFetch) setCache('all_products_catalog', result);

    console.log(`[DB-DIAG] /api/products | total DB sum: ${totalDbMs}ms | total request: ${Date.now() - t0}ms`);
    console.log(`[PERF] /api/products | DB query: ${totalDbMs}ms | total: ${Date.now() - t0}ms`);
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

// GET /api/products/:slug (matches slug or id using optimized direct unique indexes)
exports.getProductBySlug = async (req, res) => {
  const t0 = Date.now();
  const rawParam = String(req.params.slug || '').trim();
  const lowerParam = rawParam.toLowerCase();

  // 1. Check in-memory cache for fast hit (supports both slug and ID keys)
  const tCacheStart = Date.now();
  const cachedData = getCache(`/api/products/${lowerParam}`) || getCache(`/api/products/${rawParam}`);
  const tCacheDur = Date.now() - tCacheStart;
  console.log(`[DB-DIAG] /api/products/:slug | cache lookup: ${tCacheDur}ms`);

  if (cachedData) {
    console.log(`[PERF] /api/products/:slug | cache: HIT | total: ${Date.now() - t0}ms`);
    return res.json(cachedData);
  }

  const baseSelect = {
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
    updatedAt: true
  };

  try {
    let product = null;
    const isCuidLike = /^c[a-z0-9]{20,}$/i.test(rawParam);

    // 2. Measure single-index base product lookup
    const tProdStart = Date.now();
    if (isCuidLike) {
      product = await prisma.product.findUnique({
        where: { id: rawParam },
        select: baseSelect
      });
    }

    if (!product) {
      product = await prisma.product.findUnique({
        where: { slug: lowerParam },
        select: baseSelect
      });
    }

    if (!product && !isCuidLike) {
      product = await prisma.product.findUnique({
        where: { id: rawParam },
        select: baseSelect
      }).catch(() => null);
    }
    const tProdDur = Date.now() - tProdStart;
    console.log(`[DB-DIAG] /api/products/:slug | product.findUnique (base lookup): ${tProdDur}ms`);

    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    // 3. Concurrently fetch independent relations (images, variants, reviews)
    const tRelStart = Date.now();
    const [images, variants, reviews] = await Promise.all([
      prisma.productImage.findMany({
        where: { productId: product.id },
        select: { id: true, url: true, isPrimary: true }
      }),
      prisma.productVariant.findMany({
        where: { productId: product.id },
        select: { id: true, size: true, color: true, colorHex: true, stock: true, sku: true }
      }),
      prisma.review.findMany({
        where: { productId: product.id, isVisible: true },
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
      })
    ]);
    const tRelDur = Date.now() - tRelStart;
    console.log(`[DB-DIAG] /api/products/:slug | concurrent relations (images/variants/reviews): ${tRelDur}ms (images: ${images.length}, variants: ${variants.length}, reviews: ${reviews.length})`);

    const fullProduct = {
      ...product,
      images,
      variants,
      reviews
    };

    const tSer = Date.now();
    const result = { success: true, product: fullProduct };

    // 4. Bidirectional caching
    setCache(`/api/products/${lowerParam}`, result);
    if (rawParam !== lowerParam) {
      setCache(`/api/products/${rawParam}`, result);
    }
    if (fullProduct.id) {
      setCache(`/api/products/${fullProduct.id}`, result);
      setCache(`/api/products/${fullProduct.id.toLowerCase()}`, result);
    }
    if (fullProduct.slug) {
      setCache(`/api/products/${fullProduct.slug.toLowerCase()}`, result);
    }

    const tSerEnd = Date.now();
    const totalDbMs = tProdDur + tRelDur;
    console.log(`[DB-DIAG] /api/products/:slug | total DB time: ${totalDbMs}ms | serialization: ${tSerEnd - tSer}ms | total request: ${Date.now() - t0}ms`);
    console.log(`[PERF] /api/products/:slug | DB query: ${totalDbMs}ms | serialization: ${tSerEnd - tSer}ms | total: ${Date.now() - t0}ms`);

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
