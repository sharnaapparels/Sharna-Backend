const Policy = require('../models/policy.model');

exports.getPolicy = async (req, res) => {
  const { type } = req.params;
  
  let policy = await Policy.findOne({ type });
  if (!policy) {
    policy = await Policy.create({
      type,
      content: `Default content for Sharna ${type} policy. Update this in Admin Settings.`
    });
  }

  res.json({ success: true, policy });
};

exports.updatePolicy = async (req, res) => {
  const { type } = req.params;
  const { content } = req.body;

  let policy = await Policy.findOne({ type });
  if (policy) {
    policy.content = content;
    await policy.save();
  } else {
    policy = await Policy.create({ type, content });
  }

  res.json({ success: true, policy });
};
