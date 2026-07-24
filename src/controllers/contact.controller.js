const prisma = require('../config/database');

// POST /api/contact
exports.submitContact = async (req, res) => {
  const { name, email, phone, subject, message } = req.body;
  const contact = await prisma.contact.create({
    data: { name, email, phone, subject, message, userId: req.user?.id || null }
  });
  res.status(201).json({ success: true, contact });
};

// GET /api/contact (admin only)
exports.getAllContacts = async (req, res) => {
  const contacts = await prisma.contact.findMany({ orderBy: { createdAt: 'desc' } });
  res.json({ success: true, contacts });
};
