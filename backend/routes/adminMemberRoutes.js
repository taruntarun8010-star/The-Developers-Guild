const express = require('express');
const Member = require('../models/Member');
const AuditLog = require('../models/AuditLog');
const crypto = require('crypto');
const requireRole = require('../middlewares/requireRole');

const router = express.Router();

// Get all members
router.get('/', async (req, res) => {
  try {
    const members = await Member.find().sort({ createdAt: 1 }).lean();
    res.json(members);
  } catch (error) {
    res.status(500).json({ message: "Error fetching members", error: error.message });
  }
});

// Create member (super_admin or sub_admin)
router.post('/', requireRole('sub_admin'), async (req, res) => {
  const { name, email, designation } = req.body || {};
  
  if (!name || !email || !designation) {
    return res.status(400).json({ message: 'name, email and designation are required.' });
  }

  try {
    const member = await Member.create({
      id: crypto.randomUUID(),
      name: String(name).trim(),
      email: String(email).trim().toLowerCase(),
      designation: String(designation).trim()
    });

    const adminEmail = req.admin?.email || 'system';
    await AuditLog.create({
      id: crypto.randomUUID(),
      action: 'member.create',
      details: { memberId: member.id, email: member.email },
      adminEmail,
      adminRole: req.admin?.role || 'system',
      ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown'
    });

    res.status(201).json({ message: 'Member added successfully.', member });
  } catch (error) {
    res.status(500).json({ message: "Error creating member", error: error.message });
  }
});

// Update member (super_admin or sub_admin)
router.put('/:id', requireRole('sub_admin'), async (req, res) => {
  const { name, email, designation } = req.body || {};

  try {
    const member = await Member.findOne({ id: req.params.id });
    if (!member) return res.status(404).json({ message: 'Member not found.' });

    let updatedFields = [];
    if (name !== undefined) {
      member.name = String(name).trim();
      updatedFields.push('name');
    }
    if (email !== undefined) {
      member.email = String(email).trim().toLowerCase();
      updatedFields.push('email');
    }
    if (designation !== undefined) {
      member.designation = String(designation).trim();
      updatedFields.push('designation');
    }

    await member.save();

    const adminEmail = req.admin?.email || 'system';
    await AuditLog.create({
      id: crypto.randomUUID(),
      action: 'member.update',
      details: { memberId: member.id, fields: updatedFields },
      adminEmail,
      adminRole: req.admin?.role || 'system',
      ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown'
    });

    res.json({ message: 'Member updated successfully.', member });
  } catch (error) {
    res.status(500).json({ message: "Error updating member", error: error.message });
  }
});

// Delete member (super_admin or sub_admin)
router.delete('/:id', requireRole('sub_admin'), async (req, res) => {
  try {
    const member = await Member.findOneAndDelete({ id: req.params.id });
    if (!member) return res.status(404).json({ message: 'Member not found.' });

    const adminEmail = req.admin?.email || 'system';
    await AuditLog.create({
      id: crypto.randomUUID(),
      action: 'member.delete',
      details: { memberId: member.id, email: member.email },
      adminEmail,
      adminRole: req.admin?.role || 'system',
      ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown'
    });

    res.json({ message: 'Member removed successfully.' });
  } catch (error) {
    res.status(500).json({ message: "Error deleting member", error: error.message });
  }
});

module.exports = router;