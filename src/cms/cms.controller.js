const fs = require('fs');
const path = require('path');
const prisma = require('../config/database');

const CMS_FILE_PATH = path.join(__dirname, '../../data/homepage-cms.json');

const DEFAULT_HOMEPAGE_CONFIG = {
  heroSlides: [],
  newArrivalsProductIds: [],
  celebrityClosetProductIds: [],
  bestSellersProductIds: [],
  readyToShipProductIds: [],
  testimonials: [
    {
      id: 't-1',
      quote: "The handwoven silk co-ord set I ordered exceeded every expectation. The texture, drape, and gold embroidery are pure perfection.",
      name: "ANANYA S.",
      location: "MUMBAI",
      rating: 5,
      isVerified: true,
      placement: "both"
    },
    {
      id: 't-2',
      quote: "SHARNA's ready to ship delivery got my cocktail dress delivered in less than 24 hours. Phenomenal luxury craftsmanship!",
      name: "PRIYA K.",
      location: "DELHI",
      rating: 5,
      isVerified: true,
      placement: "both"
    },
    {
      id: 't-3',
      quote: "Absolute luxury. The fit and subtle elegance of the festive suit collection made me feel like royalty.",
      name: "RITU M.",
      location: "BANGALORE",
      rating: 5,
      isVerified: true,
      placement: "both"
    }
  ],
  ethnicCategories: [
    { id: 'cat-1', name: 'SUIT SETS', tag: 'Anarkalis & Salwars', image: '/src/assets/reception-2.png', link: '/shop?category=suit-sets' },
    { id: 'cat-2', name: 'CO-ORD SETS', tag: 'Indo-Western Edits', image: '/src/assets/ready-to-ship-2.png', link: '/shop?category=coord-sets' },
    { id: 'cat-3', name: 'DRESSES & GOWNS', tag: 'Festive Luxe', image: '/src/assets/festive-1.png', link: '/shop?category=dresses' },
    { id: 'cat-4', name: 'SHORT KURTIS', tag: 'Everyday Ethnic', image: '/src/assets/reception-1.png', link: '/shop?category=short-kurtis' },
    { id: 'cat-5', name: 'ETHNIC SHIRTS', tag: 'Handcrafted Blouses', image: '/src/assets/celebrity-1.png', link: '/shop?category=shirts' },
    { id: 'cat-6', name: 'FESTIVE COLLECTION', tag: 'Heritage Weaves', image: '/src/assets/festive-2.png', link: '/shop?collection=festive-collection' }
  ]
};

// Helper: Read CMS Config
const getCMSConfig = async () => {
  try {
    let config = null;

    // 1. Fetch from persistent PostgreSQL database
    try {
      const dbEntry = await prisma.cmsConfig.findUnique({
        where: { key: 'homepage' }
      });
      if (dbEntry && dbEntry.data) {
        config = dbEntry.data;
      }
    } catch (dbErr) {
      console.warn("PostgreSQL CMS read warning:", dbErr.message);
    }

    // 2. Secondary fallback: read from local JSON file
    if (!config) {
      if (fs.existsSync(CMS_FILE_PATH)) {
        try {
          const raw = fs.readFileSync(CMS_FILE_PATH, 'utf8');
          config = JSON.parse(raw);
        } catch (_) {}
      }
    }

    if (!config) {
      config = DEFAULT_HOMEPAGE_CONFIG;
    }

    // Ensure all required arrays exist
    if (!Array.isArray(config.heroSlides)) config.heroSlides = [];
    if (!Array.isArray(config.newArrivalsProductIds)) config.newArrivalsProductIds = [];
    if (!Array.isArray(config.celebrityClosetProductIds)) config.celebrityClosetProductIds = [];
    if (!Array.isArray(config.bestSellersProductIds)) config.bestSellersProductIds = [];
    if (!Array.isArray(config.readyToShipProductIds)) config.readyToShipProductIds = [];
    if (!Array.isArray(config.testimonials)) config.testimonials = DEFAULT_HOMEPAGE_CONFIG.testimonials;
    if (!Array.isArray(config.ethnicCategories) || config.ethnicCategories.length === 0) {
      config.ethnicCategories = DEFAULT_HOMEPAGE_CONFIG.ethnicCategories;
    }

    return config;
  } catch (err) {
    console.error("CMS Config read error:", err);
    return DEFAULT_HOMEPAGE_CONFIG;
  }
};

let cmsResponseCache = null;
let cmsCacheTime = 0;
const CMS_CACHE_TTL_MS = 60 * 1000; // 60 seconds (cleared immediately upon admin edit)

const clearCMSCache = () => {
  cmsResponseCache = null;
  cmsCacheTime = 0;
};

// Lightweight in-memory testimonials cache
let testimonialsCache = null;
let testimonialsCacheTime = 0;

// GET /api/cms/homepage
exports.getHomepageCMS = async (req, res) => {
  // Serve from in-memory cache if fresh (cleared on admin updates)
  if (cmsResponseCache && (Date.now() - cmsCacheTime < CMS_CACHE_TTL_MS)) {
    return res.json(cmsResponseCache);
  }

  try {
    const config = await getCMSConfig();

    // Populate products from DB for any numeric/UUID IDs
    let populatedProducts = { newArrivals: [], celebrityCloset: [], bestSellers: [], readyToShip: [] };

    const allProductIds = [
      ...(config.newArrivalsProductIds || []),
      ...(config.celebrityClosetProductIds || []),
      ...(config.bestSellersProductIds || []),
      ...(config.readyToShipProductIds || [])
    ].filter(Boolean);

    // Only query DB for IDs that look like DB IDs (numeric or UUID, not static like 'na1')
    const dbLikeIds = allProductIds.filter(id => {
      const s = String(id);
      return /^\d+$/.test(s) || s.length > 10;
    });

    const prodMap = {};
    if (dbLikeIds.length > 0) {
      try {
        const dbProducts = await prisma.product.findMany({
          where: { id: { in: dbLikeIds } },
          select: {
            id: true,
            title: true,
            price: true,
            salePrice: true,
            category: true,
            collection: true,
            isPublished: true,
            isFeatured: true,
            images: { select: { id: true, url: true, isPrimary: true } },
            variants: { select: { id: true, size: true, color: true, stock: true } }
          }
        });
        dbProducts.forEach(p => {
          prodMap[String(p.id)] = {
            id: p.id,
            title: p.title,
            price: p.price,
            originalPrice: p.salePrice || p.price,
            salePrice: p.salePrice,
            category: p.category,
            collection: p.collection,
            image: p.images?.[0]?.url || '',
            images: p.images || [],
            color: p.variants?.[0]?.color || 'beige',
            colors: [...new Set((p.variants || []).map(v => v.color).filter(Boolean))],
            sizes: [...new Set((p.variants || []).map(v => v.size).filter(Boolean))],
            inStock: p.isPublished !== false,
            isNewArrival: p.collection === 'new-arrivals',
            isReadyToShip: p.collection === 'ready-to-ship',
            isFeatured: p.isFeatured
          };
        });
      } catch (dbErr) {
        console.warn('DB product lookup warning:', dbErr.message);
      }
    }

    // Build populatedProducts — DB-found items only (static IDs are resolved client-side)
    populatedProducts = {
      newArrivals: (config.newArrivalsProductIds || []).map(id => prodMap[String(id)]).filter(Boolean),
      celebrityCloset: (config.celebrityClosetProductIds || []).map(id => prodMap[String(id)]).filter(Boolean),
      bestSellers: (config.bestSellersProductIds || []).map(id => prodMap[String(id)]).filter(Boolean),
      readyToShip: (config.readyToShipProductIds || []).map(id => prodMap[String(id)]).filter(Boolean)
    };

    // Sanitize any residual Base64 strings from config
    const sanitizeUrl = (url) => (typeof url === 'string' && url.startsWith('data:image')) ? '' : url;

    const sanitizedConfig = {
      ...config,
      heroSlides: (config.heroSlides || []).map(s => ({
        ...s,
        imageUrl: sanitizeUrl(s.imageUrl || s.desktopImageUrl),
        desktopImageUrl: sanitizeUrl(s.desktopImageUrl || s.imageUrl),
        mobileImageUrl: sanitizeUrl(s.mobileImageUrl)
      })),
      testimonials: (config.testimonials || []).map(t => ({
        ...t,
        image: sanitizeUrl(t.image)
      }))
    };

    const responseData = {
      success: true,
      cms: sanitizedConfig,
      populatedProducts
    };

    cmsResponseCache = responseData;
    cmsCacheTime = Date.now();

    res.json(responseData);
  } catch (err) {
    console.error("Fetch Homepage CMS error:", err);
    res.status(500).json({ success: false, message: "Failed to retrieve homepage CMS settings" });
  }
};

// GET /api/cms/testimonials?placement=product
exports.getTestimonials = async (req, res) => {
  const placement = req.query.placement || null;
  const cacheKey = `testimonials_${placement || 'all'}`;

  // Serve from 60s in-memory cache
  if (testimonialsCache && testimonialsCache[cacheKey] && (Date.now() - testimonialsCacheTime < 60000)) {
    return res.json(testimonialsCache[cacheKey]);
  }

  try {
    const config = await getCMSConfig();
    let testimonials = config.testimonials || [];

    if (placement) {
      testimonials = testimonials.filter(t => t.placement === placement || t.placement === 'both');
    }

    // Return only the fields PDP uses — no hero slides, no product IDs, no banner config
    const slim = testimonials.map(t => ({
      id: t.id,
      quote: t.quote,
      name: t.name,
      location: t.location,
      rating: t.rating || 5,
      isVerified: t.isVerified !== false,
      image: t.image || null,
      placement: t.placement
    }));

    const result = { success: true, testimonials: slim };

    if (!testimonialsCache) testimonialsCache = {};
    testimonialsCache[cacheKey] = result;
    testimonialsCacheTime = Date.now();

    res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300');
    res.json(result);
  } catch (err) {
    console.error('Fetch testimonials error:', err.message);
    res.status(500).json({ success: false, message: 'Failed to retrieve testimonials' });
  }
};

// PUT /api/cms/homepage
exports.updateHomepageCMS = async (req, res) => {
  try {
    clearCMSCache();
    const { heroSlides, newArrivalsProductIds, celebrityClosetProductIds, bestSellersProductIds, readyToShipProductIds, testimonials, ethnicCategories } = req.body;

    const currentConfig = await getCMSConfig();

    const updatedConfig = {
      ...currentConfig,
      heroSlides: Array.isArray(heroSlides) ? heroSlides : currentConfig.heroSlides,
      newArrivalsProductIds: newArrivalsProductIds !== undefined ? newArrivalsProductIds : currentConfig.newArrivalsProductIds,
      celebrityClosetProductIds: celebrityClosetProductIds !== undefined ? celebrityClosetProductIds : currentConfig.celebrityClosetProductIds,
      bestSellersProductIds: bestSellersProductIds !== undefined ? bestSellersProductIds : currentConfig.bestSellersProductIds,
      readyToShipProductIds: readyToShipProductIds !== undefined ? readyToShipProductIds : currentConfig.readyToShipProductIds,
      testimonials: Array.isArray(testimonials) ? testimonials : currentConfig.testimonials,
      ethnicCategories: Array.isArray(ethnicCategories) ? ethnicCategories : currentConfig.ethnicCategories,
      updatedAt: new Date().toISOString()
    };

    // 1. Persist to PostgreSQL (Supabase) Database - Permanent & survives Railway restarts
    try {
      await prisma.cmsConfig.upsert({
        where: { key: 'homepage' },
        update: { data: updatedConfig },
        create: { key: 'homepage', data: updatedConfig }
      });
    } catch (dbErr) {
      console.error("DB CMS save error:", dbErr.message);
    }

    // 2. Also write to local file as secondary cache
    try {
      const dir = path.dirname(CMS_FILE_PATH);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(CMS_FILE_PATH, JSON.stringify(updatedConfig, null, 2), 'utf8');
    } catch (_) {}

    res.json({
      success: true,
      message: "Homepage CMS configuration updated successfully!",
      cms: updatedConfig
    });
  } catch (err) {
    console.error("Update Homepage CMS error:", err);
    res.status(500).json({ success: false, message: "Failed to save homepage CMS settings" });
  }
};

// ─── COLLECTIONS PAGE CMS ───────────────────────────────────────────────────
const COLLECTIONS_CMS_FILE_PATH = path.join(__dirname, '../../data/collections-cms.json');

const DEFAULT_COLLECTIONS_CONFIG = [
  { id: 'col-1', name: 'Suit Sets', title: 'Suit Sets', subtitle: 'Anarkalis & Salwars', image: '/src/assets/reception-2.png', route: '/shop?category=suit-sets', path: '/shop?category=suit-sets', isActive: true, sortOrder: 1 },
  { id: 'col-2', name: 'Festive Collection', title: 'Festive Collection', subtitle: 'Heritage Weaves', image: '/src/assets/festive-1.png', route: '/shop?collection=festive-collection', path: '/shop?collection=festive-collection', isActive: true, sortOrder: 2 },
  { id: 'col-3', name: 'Short Kurtis & Kurtas', title: 'Short Kurtis & Kurtas', subtitle: 'Everyday Ethnic', image: '/src/assets/reception-1.png', route: '/shop?category=short-kurtis', path: '/shop?category=short-kurtis', isActive: true, sortOrder: 3 },
  { id: 'col-4', name: 'Co-Ord Sets', title: 'Co-Ord Sets', subtitle: 'Indo-Western Edits', image: '/src/assets/co-ord-blush.png', route: '/shop?category=coord-sets', path: '/shop?category=coord-sets', isActive: true, sortOrder: 4 },
  { id: 'col-5', name: 'Dresses & Shirts', title: 'Dresses & Shirts', subtitle: 'Festive Luxe & Handcrafted', image: '/src/assets/festive-2.png', route: '/shop?category=dresses', path: '/shop?category=dresses', isActive: true, sortOrder: 5 },
  { id: 'col-6', name: 'Ready To Ship', title: 'Ready To Ship', subtitle: '24-48 Hour Dispatch', image: '/src/assets/ready-1.png', route: '/ready-to-ship', path: '/ready-to-ship', isActive: true, sortOrder: 6 }
];

let collectionsResponseCache = null;
let collectionsCacheTime = 0;
const COLLECTIONS_CACHE_TTL_MS = 60 * 1000; // 60 seconds

const clearCollectionsCache = () => {
  collectionsResponseCache = null;
  collectionsCacheTime = 0;
};

const getCollectionsConfig = async () => {
  try {
    // 1. Fetch from persistent PostgreSQL database
    try {
      const dbEntry = await prisma.cmsConfig.findUnique({
        where: { key: 'collections' }
      });
      if (dbEntry && dbEntry.data && Array.isArray(dbEntry.data) && dbEntry.data.length > 0) {
        return dbEntry.data;
      }
    } catch (dbErr) {
      console.warn("PostgreSQL Collections CMS read warning:", dbErr.message);
    }

    // 2. Secondary fallback: read from local file
    if (fs.existsSync(COLLECTIONS_CMS_FILE_PATH)) {
      try {
        const raw = fs.readFileSync(COLLECTIONS_CMS_FILE_PATH, 'utf8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      } catch (_) {}
    }

    return DEFAULT_COLLECTIONS_CONFIG;
  } catch (err) {
    console.error("Collections Config read error:", err);
    return DEFAULT_COLLECTIONS_CONFIG;
  }
};

// GET /api/cms/collections (Public customer endpoint)
exports.getCollectionsCMS = async (req, res) => {
  if (collectionsResponseCache && (Date.now() - collectionsCacheTime < COLLECTIONS_CACHE_TTL_MS)) {
    return res.json(collectionsResponseCache);
  }

  try {
    const rawCollections = await getCollectionsConfig();

    // Sanitize any residual base64 data URLs
    const sanitized = rawCollections.map((col, idx) => ({
      id: col.id || `col-${idx + 1}`,
      title: col.title || col.name || 'Collection',
      subtitle: col.subtitle || '',
      image: (typeof col.image === 'string' && col.image.startsWith('data:image'))
        ? ''
        : (col.image || col.img || '/src/assets/reception-2.png'),
      route: col.route || col.path || '/collections',
      isActive: col.isActive !== false,
      sortOrder: typeof col.sortOrder === 'number' ? col.sortOrder : idx + 1
    }));

    const responseData = {
      success: true,
      collections: sanitized
    };

    collectionsResponseCache = responseData;
    collectionsCacheTime = Date.now();

    res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300');
    res.json(responseData);
  } catch (err) {
    console.error("Fetch Collections CMS error:", err);
    res.status(500).json({ success: false, message: "Failed to retrieve collections CMS settings" });
  }
};

// PUT /api/cms/collections (Admin protected endpoint)
exports.updateCollectionsCMS = async (req, res) => {
  try {
    clearCollectionsCache();
    const payload = Array.isArray(req.body) ? req.body : (req.body?.collections || null);

    if (!Array.isArray(payload) || payload.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid payload. An array of collection items is required."
      });
    }

    // Validate each collection card
    const validated = [];
    for (let i = 0; i < payload.length; i++) {
      const item = payload[i];
      const title = (item.title || item.name || '').trim();
      const image = (item.image || item.img || '').trim();
      const route = (item.route || item.path || '').trim();

      if (!title) {
        return res.status(400).json({
          success: false,
          message: `Collection card at index ${i} is missing a required title.`
        });
      }

      if (!image) {
        return res.status(400).json({
          success: false,
          message: `Collection card "${title}" is missing an image URL.`
        });
      }

      if (image.startsWith('data:image')) {
        return res.status(400).json({
          success: false,
          message: `Base64 images are not permitted in card "${title}". Please upload to Cloudinary.`
        });
      }

      if (!route || !route.startsWith('/')) {
        return res.status(400).json({
          success: false,
          message: `Collection card "${title}" has an invalid route: "${route}". Routes must start with "/".`
        });
      }

      validated.push({
        id: item.id || `col-${i + 1}`,
        name: title,
        title: title,
        subtitle: (item.subtitle || '').trim(),
        image: image,
        route: route,
        path: route,
        isActive: item.isActive !== false,
        sortOrder: typeof item.sortOrder === 'number' ? item.sortOrder : i + 1
      });
    }

    // 1. Persist to PostgreSQL (Supabase)
    try {
      await prisma.cmsConfig.upsert({
        where: { key: 'collections' },
        update: { data: validated },
        create: { key: 'collections', data: validated }
      });
    } catch (dbErr) {
      console.error("DB Collections CMS save error:", dbErr.message);
    }

    // 2. Also write to local file as secondary backup
    try {
      const dir = path.dirname(COLLECTIONS_CMS_FILE_PATH);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(COLLECTIONS_CMS_FILE_PATH, JSON.stringify(validated, null, 2), 'utf8');
    } catch (_) {}

    res.json({
      success: true,
      message: "Collection CMS configuration updated successfully!",
      collections: validated
    });
  } catch (err) {
    console.error("Update Collections CMS error:", err);
    res.status(500).json({ success: false, message: "Failed to save collections CMS settings" });
  }
};

module.exports = {
  getHomepageCMS: exports.getHomepageCMS,
  getTestimonials: exports.getTestimonials,
  updateHomepageCMS: exports.updateHomepageCMS,
  getCollectionsCMS: exports.getCollectionsCMS,
  updateCollectionsCMS: exports.updateCollectionsCMS,
  clearCMSCache,
  clearCollectionsCache
};
