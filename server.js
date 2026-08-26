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

// Trust reverse proxy (Railway / Vercel load balancers)
app.set('trust proxy', 1);

app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

const allowedOrigins = [
  'https://sharna.in',
  'https://www.sharna.in',
  'http://localhost:5173',
  'http://localhost:3000',
  process.env.CLIENT_URL
].filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin) || origin.endsWith('.vercel.app') || origin.endsWith('.sharna.in')) {
      return callback(null, true);
    }
    try {
      const url = new URL(origin);
      const hostname = url.hostname;
      if (
        hostname === 'localhost' || 
        hostname === '127.0.0.1' ||
        hostname.endsWith('.local') ||
        /^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
        /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
        /^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/.test(hostname)
      ) {
        return callback(null, true);
      }
    } catch (e) {}

    // Allow in non-production environments
    if (process.env.NODE_ENV !== 'production') {
      return callback(null, true);
    }

    return callback(new Error('CORS Security Block: Access from unauthorized external origin denied.'));
  },
  credentials: true
}));

// Rate limiting with JSON response and local/review exemptions
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5000,
  skip: (req) => {
    return (
      process.env.NODE_ENV !== 'production' ||
      req.ip === '127.0.0.1' ||
      req.ip === '::1' ||
      req.ip === '::ffff:127.0.0.1' ||
      req.originalUrl.includes('/reviews')
    );
  },
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      message: 'Too many requests from this IP, please try again after 15 minutes.'
    });
  }
});
app.use(limiter);

const cookieParser = require('cookie-parser');

// Body parsing — 50mb limit to support high-resolution customer review photos & admin assets
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(cookieParser());

const path = require('path');
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

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

// Logging (completely mutes GET request logging in development terminal)
if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev', {
    skip: (req) => req.method === 'GET'
  }));
}

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

const { exec } = require('child_process');

const startServer = async () => {
  try {
    // Test the DB connection
    await prisma.$connect();
    console.log('[DB] Prisma connected');

    // One-time startup warm-up: pre-heats the pgBouncer pool slot so the first
    // real user request does not pay the full cold connection-acquisition cost.
    // This runs exactly once on startup and is intentionally non-fatal.
    const tWarmup = Date.now();
    try {
      await prisma.$queryRaw`SELECT 1`;
      console.log(`[DB] Connection warm-up completed in ${Date.now() - tWarmup}ms`);
    } catch (warmupErr) {
      console.error('[DB] Connection warm-up failed (non-fatal):', warmupErr.message);
    }

    const server = app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Server running on port ${PORT}`);
      // Initialize abandoned wishlist reminder background job
      initWishlistReminderJob();
    });

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.log(`⚡ Port ${PORT} busy. Auto-recovering port...`);
        exec(`netstat -ano | findstr :${PORT}`, (netErr, stdout) => {
          if (stdout) {
            const lines = stdout.trim().split('\n');
            lines.forEach((line) => {
              const parts = line.trim().split(/\s+/);
              const pid = parts[parts.length - 1];
              if (pid && pid !== process.pid.toString() && pid !== '0') {
                try {
                  process.kill(parseInt(pid, 10));
                } catch (_) {
                  exec(`taskkill /F /PID ${pid}`);
                }
              }
            });
          }
          setTimeout(() => {
            try {
              server.close();
            } catch (_) {}
            server.listen(PORT, '0.0.0.0');
          }, 300);
        });
      } else {
        console.error('Server error:', err);
      }
    });

    // Nodemon instant socket release
    process.once('SIGUSR2', () => {
      server.close(() => {
        process.kill(process.pid, 'SIGUSR2');
      });
    });

    process.once('SIGINT', () => {
      server.close(() => {
        process.exit(0);
      });
    });
  } catch (error) {
    console.error('❌ Failed to connect to the database:', error);
    process.exit(1);
  }
};

startServer();

// ── KEEP-ALIVE SELF-PING ─────────────────────────────────────────────────────
// Ping server health once every 3 to 4 days (3.5 days)
const SELF_PING_INTERVAL_MS = 3.5 * 24 * 60 * 60 * 1000; // every 3-4 days

const keepAlive = () => {
  const selfUrl = process.env.RAILWAY_PUBLIC_DOMAIN
    ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}/health`
    : process.env.SELF_URL
    ? `${process.env.SELF_URL}/health`
    : null;

  if (!selfUrl) return; // skip in local dev

  setInterval(() => {
    try {
      const protocol = selfUrl.startsWith('https') ? require('https') : require('http');
      const req = protocol.get(selfUrl, (res) => {
        console.log(`🔄 Keep-alive ping → ${selfUrl} [${res.statusCode}]`);
      });
      req.on('error', () => {});
      req.end();
    } catch (_) {}
  }, SELF_PING_INTERVAL_MS);

  console.log('⏰ Keep-alive pinger started → pinging every 3 to 4 days');
};

setTimeout(keepAlive, 15000);
