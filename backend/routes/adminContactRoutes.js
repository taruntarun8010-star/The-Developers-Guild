const express = require('express');
const ContactSubmission = require('../models/ContactSubmission');
const AuditLog = require('../models/AuditLog');
const crypto = require('crypto');

const router = express.Router();

// GET all contact submissions
router.get('/', async (req, res) => {
  try {
    const submissions = await ContactSubmission.find().sort({ createdAt: -1 }).lean();
    res.json(submissions);
  } catch (error) {
    res.status(500).json({ message: "Error fetching contact submissions", error: error.message });
  }
});

// POST mark as read
router.put('/:id/read', async (req, res) => {
  try {
    const submission = await ContactSubmission.findOne({ id: req.params.id });
    if (!submission) {
      return res.status(404).json({ message: 'Contact submission not found.' });
    }

    submission.status = 'read';
    submission.readAt = new Date();
    await submission.save();

    const adminEmail = req.admin?.email || 'system';
    await AuditLog.create({
      id: crypto.randomUUID(),
      action: 'contact.read',
      details: { contactId: submission.id },
      adminEmail,
      adminRole: req.admin?.role || 'system',
      ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown'
    });

    res.json({ message: 'Submission marked as read.', submission });
  } catch (error) {
    res.status(500).json({ message: "Error marking submission as read", error: error.message });
  }
});

// DELETE contact submission
router.delete('/:id', async (req, res) => {
  try {
    const submission = await ContactSubmission.findOneAndDelete({ id: req.params.id });
    if (!submission) {
      return res.status(404).json({ message: 'Contact submission not found.' });
    }

    const adminEmail = req.admin?.email || 'system';
    await AuditLog.create({
      id: crypto.randomUUID(),
      action: 'contact.delete',
      details: { contactId: req.params.id },
      adminEmail,
      adminRole: req.admin?.role || 'system',
      ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown'
    });

    res.json({ message: 'Submission deleted successfully.' });
  } catch (error) {
    res.status(500).json({ message: "Error deleting submission", error: error.message });
  }
});

module.exports = router;