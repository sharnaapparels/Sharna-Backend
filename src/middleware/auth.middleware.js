const jwt = require('jsonwebtoken');
const prisma = require('../config/database');

const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];

      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      req.user = await prisma.user.findUnique({
        where: { id: decoded.id },
        select: { id: true, name: true, email: true, phone: true, role: true, isBlocked: true }
      });

      if (!req.user || req.user.isBlocked) {
        return res.status(401).json({ success: false, message: 'Not authorized or account blocked' });
      }

      next();
    } catch (error) {
      return res.status(401).json({ success: false, message: 'Invalid or expired authentication token' });
    }
  } else {
    return res.status(401).json({ success: false, message: 'No authorization token provided' });
  }
};

const adminOnly = (req, res, next) => {
  const adminEmails = ['sharnaapparels@gmail.com', 'chetna@sharna.com', 'swati@sharna.com', 'priyanshulokhande72@gmail.com', 'anshlokhande405@gmail.com'];
  const adminPhones = ['+917999715256', '917999715256', '+919876543210', '+919039241765'];

  if (
    req.user &&
    (
      req.user.role === 'ADMIN' ||
      adminEmails.includes(req.user.email?.toLowerCase()) ||
      adminPhones.includes(req.user.phone)
    )
  ) {
    next();
  } else {
    res.status(403).json({ success: false, message: 'Admin access required' });
  }
};

const optionalAuth = async (req, res, next) => {
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      const token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
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
