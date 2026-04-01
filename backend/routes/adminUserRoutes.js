const requireRole = require('../middlewares/requireRole');
const express = require('express');
const User = require('../models/User');
const Registration = require('../models/Registration');
const AuditLog = require('../models/AuditLog');
const Notification = require('../models/Notification');
const crypto = require('crypto');

const router = express.Router();

// GET all users
router.get('/', async (req, res) => {
  try {
    const users = await User.find().lean();
    
    const usersWithRegistrations = await Promise.all(
      users.map(async (u) => {
        const registrations = await Registration.countDocuments({ userId: u.id });
        return {
          id: u.id,
          name: u.name,
          email: u.email,
          collegeId: u.collegeId,
          joinedAt: u.joinedAt,
          lastLoginAt: u.lastLoginAt || null,
          isVerified: Boolean(u.isVerified),
          status: u.status || 'active',
          registrations
        };
      })
    );

    res.json(usersWithRegistrations);
  } catch (error) {
    res.status(500).json({ message: "Error fetching users", error: error.message });
  }
});

// PUT update user status (super_admin or sub_admin)
router.put('/:id/status', requireRole('sub_admin'), async (req, res) => {
  const { status } = req.body;
  if (!['active', 'suspended', 'banned'].includes(status)) {
    return res.status(400).json({ message: 'status must be active, suspended, or banned.' });
  }

  try {
    const user = await User.findOne({ id: req.params.id });
    if (!user) return res.status(404).json({ message: 'User not found.' });

    user.status = status;
    await user.save();

    const adminEmail = req.admin?.email || 'system';
    
    await AuditLog.create({
      id: crypto.randomUUID(),
      action: 'user.status.update',
      details: { userId: user.id, status },
      adminEmail,
      adminRole: req.admin?.role || 'system',
      ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown'
    });

    await Notification.create({
      id: crypto.randomUUID(),
      type: 'user',
      title: `User ${status}`,
      message: `${user.email} was set to ${status} by ${adminEmail}.`,
      priority: status !== 'active' ? 'high' : 'normal'
    });

    res.json({ message: `User marked ${status}.`, user });
  } catch (error) {
    res.status(500).json({ message: "Error updating user status", error: error.message });
  }
});

// POST bulk user action
router.post('/bulk-action', async (req, res) => {
  const { userIds, action } = req.body;
  
  if (!Array.isArray(userIds) || userIds.length === 0 || !action) {
    return res.status(400).json({ message: 'userIds array and action are required.' });
  }

  const allowedActions = ['activate', 'suspend', 'verify', 'unverify'];
  if (!allowedActions.includes(action)) {
    return res.status(400).json({ message: 'Invalid action.' });
  }

  try {
    const updateDef = {};
    if (action === 'activate') updateDef.status = 'active';
    if (action === 'suspend') updateDef.status = 'suspended';
    if (action === 'verify') updateDef.isVerified = true;
    if (action === 'unverify') updateDef.isVerified = false;

    const result = await User.updateMany({ id: { $in: userIds } }, { $set: updateDef });

    const adminEmail = req.admin?.email || 'system';
    await AuditLog.create({
      id: crypto.randomUUID(),
      action: `bulk.user.${action}`,
      details: { targetCount: result.modifiedCount },
      adminEmail,
      adminRole: req.admin?.role || 'system',
      ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown'
    });

    res.json({ message: `Bulk action ${action} completed on ${result.modifiedCount} users.` });
  } catch (error) {
    res.status(500).json({ message: "Error performing bulk action", error: error.message });
  }
});

module.exports = router;