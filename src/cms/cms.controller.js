const fs = require('fs');
const path = require('path');
const prisma = require('../config/database');

const CMS_FILE_PATH = path.join(__dirname, '../../data/homepage-cms.json');

const DEFAULT_HOMEPAGE_CONFIG = {
  heroSlides: [
    {
      id: 'slide-1',
      title: 'WHERE TRADITION MEETS MODERN LUXURY',
      subtitle: 'HANDWOVEN & HANDSPUN COTTON ATTIRE · CRAFTED FOR THE DISCERNING MUSE',
      linkPath: '/collections',
      buttonText: 'DISCOVER COLLECTION',
      imageUrl: '/src/assets/hero-slide-1.png'
    },
    {
      id: 'slide-2',
      title: 'ARTISANAL EMBROIDERY & QUIET ELEGANCE',
      subtitle: 'SEASONAL CO-ORD SETS, TUNIC DRESSES & LUXURY SUITS',
      linkPath: '/ready-to-ship',
      buttonText: 'SHOP READY TO SHIP',
      imageUrl: '/src/assets/hero-slide-2.png'
    },
    {
      id: 'slide-3',
      title: 'CELEBRITY CURATION · AS SEEN ON MUSES',
      subtitle: 'EXPLORE STATEMENT PIECES DESIGNED FOR EVERY OCCASION',
      linkPath: '/collections',
      buttonText: 'EXPLORE CELEBRITY LOOKS',
      imageUrl: '/src/assets/hero-slide-3.png'
    }
  ],
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
      isVerified: true
    },
    {
      id: 't-2',
      quote: "SHARNA's ready to ship delivery got my cocktail dress delivered in less than 24 hours. Phenomenal luxury craftsmanship!",
      name: "PRIYA K.",
      location: "DELHI",
      rating: 5,
      isVerified: true
    },
    {
      id: 't-3',
      quote: "Absolute luxury. The fit and subtle elegance of the festive suit collection made me feel like royalty.",
      name: "RITU M.",
      location: "BANGALORE",
      rating: 5,
      isVerified: true
    }
  ]
};

// Helper: Read CMS Config
const getCMSConfig = async () => {
  try {
    const dir = path.dirname(CMS_FILE_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    let config = DEFAULT_HOMEPAGE_CONFIG;
    if (fs.existsSync(CMS_FILE_PATH)) {
      const raw = fs.readFileSync(CMS_FILE_PATH, 'utf8');
      config = JSON.parse(raw);
    }

    // Auto-seed product IDs if any array is empty
    let needsSave = false;
    let dbProducts = [];
    try {
      dbProducts = await prisma.product.findMany({
        select: { id: true, category: true, collection: true, isFeatured: true }
      });
    } catch (e) {
      console.warn("CMS DB Query Warning:", e.message);
    }

    if (!config.newArrivalsProductIds || config.newArrivalsProductIds.length === 0) {
      const ids = dbProducts.filter(p => p.collection === 'new-arrivals' || p.category === 'new-arrivals').map(p => p.id);
      config.newArrivalsProductIds = ids.length > 0 ? ids.slice(0, 6) : ['na1', 'na2', 'na3', 'na4'];
      needsSave = true;
    }

    if (!config.celebrityClosetProductIds || config.celebrityClosetProductIds.length === 0) {
      const ids = dbProducts.filter(p => p.collection === 'celebrity-closet' || p.category === 'Celebrity Closet').map(p => p.id);
      config.celebrityClosetProductIds = ids.length > 0 ? ids.slice(0, 6) : ['c1', 'c2', 'c3', 'c4'];
      needsSave = true;
    }

    if (!config.bestSellersProductIds || config.bestSellersProductIds.length === 0) {
      const ids = dbProducts.filter(p => p.isFeatured || p.category === 'Best Sellers').map(p => p.id);
      config.bestSellersProductIds = ids.length > 0 ? ids.slice(0, 6) : ['bs1', 'bs2', 'bs3', 'bs4'];
      needsSave = true;
    }

    if (!config.readyToShipProductIds || config.readyToShipProductIds.length === 0) {
      const ids = dbProducts.filter(p => p.collection === 'ready-to-ship' || p.category === 'ready-to-ship').map(p => p.id);
      config.readyToShipProductIds = ids.length > 0 ? ids.slice(0, 6) : ['s1', 's2', 's3', 's4'];
      needsSave = true;
    }

    if (needsSave || !fs.existsSync(CMS_FILE_PATH)) {
      fs.writeFileSync(CMS_FILE_PATH, JSON.stringify(config, null, 2), 'utf8');
    }

    return config;
  } catch (err) {
    console.error("CMS Config read error:", err);
    return DEFAULT_HOMEPAGE_CONFIG;
  }
};

// GET /api/cms/homepage
exports.getHomepageCMS = async (req, res) => {
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
          include: { images: true, variants: true }
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
            isNewArrival: p.isNewArrival,
            isReadyToShip: p.isReadyToShip,
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

    res.json({
      success: true,
      cms: config,
      populatedProducts
    });
  } catch (err) {
    console.error("Fetch Homepage CMS error:", err);
    res.status(500).json({ success: false, message: "Failed to retrieve homepage CMS settings" });
  }
};

// PUT /api/cms/homepage
exports.updateHomepageCMS = async (req, res) => {
  try {
    const { heroSlides, newArrivalsProductIds, celebrityClosetProductIds, bestSellersProductIds, readyToShipProductIds, testimonials } = req.body;

    const currentConfig = await getCMSConfig();

    const updatedConfig = {
      ...currentConfig,
      heroSlides: heroSlides || currentConfig.heroSlides,
      newArrivalsProductIds: newArrivalsProductIds !== undefined ? newArrivalsProductIds : currentConfig.newArrivalsProductIds,
      celebrityClosetProductIds: celebrityClosetProductIds !== undefined ? celebrityClosetProductIds : currentConfig.celebrityClosetProductIds,
      bestSellersProductIds: bestSellersProductIds !== undefined ? bestSellersProductIds : currentConfig.bestSellersProductIds,
      readyToShipProductIds: readyToShipProductIds !== undefined ? readyToShipProductIds : currentConfig.readyToShipProductIds,
      testimonials: testimonials || currentConfig.testimonials,
      updatedAt: new Date().toISOString()
    };

    const dir = path.dirname(CMS_FILE_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    fs.writeFileSync(CMS_FILE_PATH, JSON.stringify(updatedConfig, null, 2), 'utf8');

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
