const prisma = require('../config/database');

// GET /api/policy/:type
exports.getPolicy = async (req, res) => {
  const policy = await prisma.policy.findUnique({
    where: { type: req.params.type.toUpperCase() }
  });
  if (!policy) return res.status(404).json({ success: false, message: 'Policy not found' });
  res.json({ success: true, policy });
};

// PUT /api/policy/:type (admin)
exports.updatePolicy = async (req, res) => {
  const { content } = req.body;
  const policy = await prisma.policy.upsert({
    where: { type: req.params.type.toUpperCase() },
    update: { content },
    create: { type: req.params.type.toUpperCase(), content }
  });
  res.json({ success: true, policy });
};
