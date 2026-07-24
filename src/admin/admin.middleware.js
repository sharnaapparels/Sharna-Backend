const { protect, adminOnly } = require('../middleware/auth.middleware');

// Protect routes & require Role.ADMIN
const adminProtect = [protect, adminOnly];

module.exports = { adminProtect };
