const prisma = require('../config/database');

// POST /api/contact - Submit support ticket / contact form
exports.submitContact = async (req, res) => {
  try {
    const { name, email, phone, subject, message } = req.body;
    if (!name || !message) {
      return res.status(400).json({ success: false, message: 'Name and message are required.' });
    }

    const contact = await prisma.contact.create({
      data: {
        name,
        email: email || '',
        phone: phone || '',
        subject: subject || 'General Query',
        message,
        userId: req.user?.id || null
      }
    });

    console.log(`📩 [NEW SUPPORT TICKET]: From ${name} (${phone || email}) - Subject: ${subject}`);
    return res.status(201).json({ success: true, message: 'Support ticket received successfully.', contact });
  } catch (error) {
    console.error('❌ Error submitting contact ticket:', error.message);
    return res.status(500).json({ success: false, message: 'Failed to submit contact ticket.' });
  }
};

// GET /api/contact - Get all support tickets (admin only)
exports.getAllContacts = async (req, res) => {
  try {
    const contacts = await prisma.contact.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: { id: true, name: true, email: true, phone: true }
        }
      }
    });
    return res.json({ success: true, count: contacts.length, contacts });
  } catch (error) {
    console.error('❌ Error fetching contact tickets:', error.message);
    return res.status(500).json({ success: false, message: 'Failed to fetch tickets.' });
  }
};

// PATCH /api/contact/:id/status - Toggle read / resolve status (admin only)
exports.updateContactStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { isRead } = req.body;

    const contact = await prisma.contact.update({
      where: { id },
      data: { isRead: isRead !== undefined ? isRead : true }
    });

    return res.json({ success: true, contact });
  } catch (error) {
    console.error('❌ Error updating ticket status:', error.message);
    return res.status(500).json({ success: false, message: 'Failed to update ticket status.' });
  }
};

// DELETE /api/contact/:id - Delete a ticket (admin only)
exports.deleteContact = async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.contact.delete({ where: { id } });
    return res.json({ success: true, message: 'Ticket deleted successfully.' });
  } catch (error) {
    console.error('❌ Error deleting ticket:', error.message);
    return res.status(500).json({ success: false, message: 'Failed to delete ticket.' });
  }
};
