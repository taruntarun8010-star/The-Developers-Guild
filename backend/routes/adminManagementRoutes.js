const express = require('express');
const AdminUser = require('../models/AdminUser');
const AuditLog = require('../models/AuditLog');
const Notification = require('../models/Notification');
const requireRole = require('../middlewares/requireRole');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const router = express.Router();

const isProtectedAdminAccount = (adminUser) => {
  return adminUser.managedByEnv === true || adminUser.role === 'super_admin';
};

// GET all admin users
router.get('/', requireRole('super_admin'), async (req, res) => {
  try {
    const adminUsers = await AdminUser.find().sort({ createdAt: 1 }).lean();
    const mappedUsers = adminUsers.map(a => ({
      id: a.id,
      name: a.name,
      email: a.email,
      role: a.role || 'support_admin',
      isActive: a.isActive !== false,
      managedByEnv: Boolean(a.managedByEnv),
      createdAt: a.createdAt || null,
      updatedAt: a.updatedAt || null,
    }));
    res.json(mappedUsers);
  } catch (error) {
    res.status(500).json({ message: "Error fetching admin users", error: error.message });
  }
});

// POST check/create admin user
router.post('/', requireRole('super_admin'), async (req, res) => {
  const { name, email, password, role } = req.body || {};

  if (!name || !email || !password || !role) {
    return res.status(400).json({ message: 'name, email, password and role are required.' });
  }

  const allowedRoles = ['sub_admin', 'event_manager', 'content_manager', 'support_admin'];
  if (!allowedRoles.includes(String(role))) {
    return res.status(400).json({ message: 'Invalid role.' });
  }

  if (String(password).length < 8) {
    return res.status(400).json({ message: 'Password must be at least 8 characters long.' });
  }

  const emailLower = String(email).trim().toLowerCase();

  try {
    const exists = await AdminUser.findOne({ email: emailLower });
    if (exists) {
      return res.status(400).json({ message: 'Admin account with this email already exists.' });
    }

    const passwordHash = await bcrypt.hash(String(password), 10);
    const adminUser = await AdminUser.create({
      id: crypto.randomUUID(),
      name: String(name).trim(),
      email: emailLower,
      role: String(role),
      isActive: true,
      passwordHash,
      managedByEnv: false,
    });

    const adminEmail = req.admin?.email || 'system';
    
    await AuditLog.create({
      id: crypto.randomUUID(),
      action: 'admin.account.create',
      details: { email: adminUser.email, role: adminUser.role },
      adminEmail: adminEmail,
      adminRole: req.admin?.role || 'system',
      ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown'
    });

    await Notification.create({
      id: crypto.randomUUID(),
      type: 'admin',
      title: 'Sub-admin created',
      message: `${adminUser.email} added as ${adminUser.role}.`
    });

    return res.status(201).json({
      message: 'Sub-admin created successfully.',
      adminUser: {
        id: adminUser.id,
        name: adminUser.name,
        email: adminUser.email,
        role: adminUser.role,
        isActive: adminUser.isActive,
      }
    });

  } catch (error) {
    res.status(500).json({ message: "Error creating admin account", error: error.message });
  }
});

// PUT update admin user
router.put('/:id', requireRole('super_admin'), async (req, res) => {
  const { role, isActive, password } = req.body || {};

  try {
    const adminUser = await AdminUser.findOne({ id: req.params.id });
    
    if (!adminUser) {
      return res.status(404).json({ message: 'Admin account not found.' });
    }

    if (isProtectedAdminAccount(adminUser)) {
      if (role !== undefined || isActive !== undefined || password !== undefined) {
        return res.status(403).json({ message: 'Primary super admin cannot be modified.' });
      }
    }

    if (role !== undefined) {
      const allowedRoles = ['sub_admin', 'event_manager', 'content_manager', 'support_admin'];
      if (!allowedRoles.includes(String(role))) {
        return res.status(400).json({ message: 'Invalid role.' });
      }
      adminUser.role = String(role);
    }

    if (isActive !== undefined) {
      adminUser.isActive = Boolean(isActive);
    }

    await adminUser.save();

    const adminEmail = req.admin?.email || 'system';
    await AuditLog.create({
      id: crypto.randomUUID(),
      action: 'admin.account.update',
      details: { email: adminUser.email, fields: Object.keys(req.body || {}) },
      adminEmail: adminEmail,
      adminRole: req.admin?.role || 'system',
      ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown'
    });

    return res.json({
      message: 'Admin account updated successfully.',
      adminUser: {
        id: adminUser.id,
        name: adminUser.name,
        email: adminUser.email,
        role: adminUser.role,
        isActive: adminUser.isActive,
      }
    });
  } catch (error) {
    res.status(500).json({ message: "Error updating admin account", error: error.message });
  }
});

// PUT reset admin user password
router.put('/:id/reset-password', requireRole('super_admin'), async (req, res) => {
  const { password } = req.body || {};
  if (!password || String(password).length < 8) {
    return res.status(400).json({ message: 'password is required and must be at least 8 characters.' });
  }

  try {
    const adminUser = await AdminUser.findOne({ id: req.params.id });
    if (!adminUser) return res.status(404).json({ message: 'Admin account not found.' });

    if (isProtectedAdminAccount(adminUser)) {
      return res.status(403).json({ message: 'Primary super admin password cannot be reset from this panel.' });
    }

    adminUser.passwordHash = await bcrypt.hash(String(password), 10);
    await adminUser.save();

    const adminEmail = req.admin?.email || 'system';
    
    await AuditLog.create({
      id: crypto.randomUUID(),
      action: 'admin.account.reset_password',
      details: { adminId: adminUser.id, email: adminUser.email },
      adminEmail,
      adminRole: req.admin?.role || 'system',
      ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown'
    });

    return res.json({ message: 'Sub-admin password reset successfully.' });
  } catch (error) {
     res.status(500).json({ message: "Error resetting password", error: error.message });
  }
});

// DELETE admin user
router.delete('/:id', requireRole('super_admin'), async (req, res) => {
  try {
    const adminUser = await AdminUser.findOne({ id: req.params.id });

    if (!adminUser) {
      return res.status(404).json({ message: 'Admin account not found.' });
    }

    if (isProtectedAdminAccount(adminUser)) {
      return res.status(403).json({ message: 'Primary super admin cannot be removed.' });
    }

    await AdminUser.findOneAndDelete({ id: req.params.id });

    const adminEmailReq = req.admin?.email || 'system';

    await AuditLog.create({
      id: crypto.randomUUID(),
      action: 'admin.account.delete',
      details: { email: adminUser.email, role: adminUser.role },
      adminEmail: adminEmailReq,
      adminRole: req.admin?.role || 'system',
      ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown'
    });

    await Notification.create({
      id: crypto.randomUUID(),
      type: 'admin',
      title: 'Sub-admin removed',
      message: `${adminUser.email} was removed from admin accounts.`,
      priority: 'high'
    });

    return res.json({ message: 'Admin account removed successfully.' });
  } catch (error) {
     res.status(500).json({ message: "Error deleting admin account", error: error.message });
  }
});

module.exports = router;