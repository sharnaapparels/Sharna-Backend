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

const { notFound, errorHandler } = require('./src/middleware/errorHandler');

const app = express();

// Security
app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173', credentials: true }));

// Rate limiting
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 200 });
app.use(limiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Logging
if (process.env.NODE_ENV !== 'production') app.use(morgan('dev'));

// Health check
app.get('/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
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
