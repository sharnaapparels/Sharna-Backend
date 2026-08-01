const notFound = (req, res, next) => {
  res.status(404).json({
    success: false,
    message: `Resource not found: ${req.originalUrl}`
  });
};

const errorHandler = (err, req, res, next) => {
  // Always log full error details server-side for developer debugging
  console.error(`❌ [SERVER ERROR] ${req.method} ${req.originalUrl}:`, err);

  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;

  // Mask database / Prisma / internal error stack traces in production
  let userMessage = err.message || 'An internal server error occurred';

  if (process.env.NODE_ENV === 'production') {
    // Hide raw database/Prisma error messages from clients
    if (err.code && (err.code.startsWith('P') || err.name?.includes('Prisma'))) {
      userMessage = 'A database error occurred. Please try again later.';
    } else if (statusCode === 500) {
      userMessage = 'An unexpected internal server error occurred. Please try again later.';
    }
  }

  res.status(statusCode).json({
    success: false,
    message: userMessage,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  });
};

module.exports = { notFound, errorHandler };

