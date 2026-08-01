require('dotenv').config({ override: true });
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const prisma = require('./src/config/database');

// Routes
const authRoutes = require('./src/routes/auth.routes');
const productRoutes = require('./src/routes/product.routes');
const orderRoutes = require('./src/routes/order.routes');
const paymentRoutes = require('./src/routes/payment.routes');
const cartRoutes = require('./src/routes/cart.routes');
const wishlistRoutes = require('./src/routes/wishlist.routes');
const reviewRoutes = require('./src/routes/review.routes');
const contactRoutes = require('./src/routes/contact.routes');
const adminRoutes = require('./src/routes/admin.routes');
const uploadRoutes = require('./src/routes/upload.routes');
const cmsRoutes = require('./src/cms/cms.routes');

const { notFound, errorHandler } = require('./src/middleware/errorHandler');

const app = express();

const allowedOrigins = [
  'https://sharna.in',
  'https://www.sharna.in',
  'http://localhost:5173',
  'http://localhost:3000',
  process.env.CLIENT_URL
].filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin) || origin.endsWith('.vercel.app')) {
      callback(null, true);
    } else {
      callback(null, true); // Allow during production transition
    }
  },
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 200 });
app.use(limiter);

// Body parsing
app.use(express.json({ limit: '50mb' }));

// Disable ETag globally — prevents 304 "Not Modified" on all API routes
app.set('etag', false);

// Force no-cache headers on all dynamic API routes (admin + cms + products)
const noCacheMiddleware = (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
  next();
};
app.use('/api/admin', noCacheMiddleware);
app.use('/api/cms', noCacheMiddleware);
app.use('/api/products', noCacheMiddleware);
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Logging
if (process.env.NODE_ENV !== 'production') app.use(morgan('dev'));

const { seedCatalogIfNeeded } = require('./src/config/seedCatalog');

// Health check
app.get('/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    seedCatalogIfNeeded();
    res.json({ status: 'OK', database: 'PostgreSQL Connected', timestamp: new Date() });
  } catch (error) {
    res.status(500).json({ status: 'ERROR', database: 'Disconnected' });
  }
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/wishlist', wishlistRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/cms', cmsRoutes);

// Error handling
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

const { initWishlistReminderJob } = require('./src/jobs/wishlistReminder.job');

const startServer = async () => {
  try {
    // Test the DB connection
    await prisma.$connect();
    console.log('✅ PostgreSQL Connected via Prisma');

    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      // Initialize abandoned wishlist reminder background job
      initWishlistReminderJob();
    });
  } catch (error) {
    console.error('❌ Failed to connect to the database:', error);
    process.exit(1);
  }
};

startServer();
// Cache-enabled fast server
