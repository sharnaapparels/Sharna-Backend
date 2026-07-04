const Contact = require('../models/contact.model');

exports.submitContactForm = async (req, res) => {
  const { name, email, phone, message } = req.body;

  if (!name || !email || !message) {
    return res.status(400).json({ success: false, message: 'Please provide name, email, and message' });
  }

  const contact = await Contact.create({ name, email, phone, message });
  res.status(201).json({ success: true, message: 'Your support request has been submitted successfully', contact });
};
