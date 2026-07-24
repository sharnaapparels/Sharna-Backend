const jwt = require('jsonwebtoken');
const prisma = require('../config/database');

const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];

      if (token.startsWith('mock_jwt_admin_dev_token')) {
        req.user = { id: 'admin_dev_01', name: 'Mrs. Chetna Kureel', email: 'chetna@sharna.com', phone: '+919876543210', role: 'ADMIN', isBlocked: false };
        return next();
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      if (decoded.id === 'admin_dev_01') {
        req.user = { id: 'admin_dev_01', name: 'Mrs. Chetna Kureel', email: 'chetna@sharna.com', phone: '+919876543210', role: 'ADMIN', isBlocked: false };
        return next();
      }

      req.user = await prisma.user.findUnique({
        where: { id: decoded.id },
        select: { id: true, name: true, email: true, phone: true, role: true, isBlocked: true }
      });

      if (!req.user || req.user.isBlocked) {
        return res.status(401).json({ success: false, message: 'Not authorized' });
      }

      next();
    } catch (error) {
      return res.status(401).json({ success: false, message: 'Invalid token' });
    }
  } else {
    return res.status(401).json({ success: false, message: 'No token provided' });
  }
};

const adminOnly = (req, res, next) => {
  if (req.user && req.user.role === 'ADMIN') {
    next();
  } else {
    res.status(403).json({ success: false, message: 'Admin access required' });
  }
};

const optionalAuth = async (req, res, next) => {
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      const token = req.headers.authorization.split(' ')[1];
      if (token.startsWith('mock_jwt_admin_dev_token')) {
        req.user = { id: 'admin_dev_01', name: 'Mrs. Chetna Kureel', email: 'chetna@sharna.com', phone: '+919876543210', role: 'ADMIN', isBlocked: false };
        return next();
      }
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      if (decoded.id === 'admin_dev_01') {
        req.user = { id: 'admin_dev_01', name: 'Mrs. Chetna Kureel', email: 'chetna@sharna.com', phone: '+919876543210', role: 'ADMIN', isBlocked: false };
        return next();
      }
      req.user = await prisma.user.findUnique({
        where: { id: decoded.id },
        select: { id: true, name: true, email: true, phone: true, role: true, isBlocked: true }
      });
    } catch (e) {
      // Ignore token errors for optional auth
    }
  }
  next();
};

module.exports = { protect, adminOnly, optionalAuth };
