const express = require('express');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const AdminUser = require('../models/AdminUser');
const AuditLog = require('../models/AuditLog');
const crypto = require('crypto');
// const { requireAdminAuth } = require('../middlewares/auth');
require('dotenv').config();

const router = express.Router();

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'Jontycreation@gmail.com').toLowerCase();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Jonty@790';
const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET || 'dev-admin-secret-change-me';

const isValidEnvSuperAdminAttempt = (req) => {
  const body = req?.body || {};
  const email = String(body.email || '').toLowerCase();
  const password = String(body.password || '');
  return email === ADMIN_EMAIL && password === ADMIN_PASSWORD;
};

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  skipSuccessfulRequests: true,
  skip: (req) => isValidEnvSuperAdminAttempt(req),
  message: { message: "Too many attempts, please try again after 15 minutes." }
});

const ROLE_PERMISSIONS = {
  super_admin: ['*'],
  sub_admin: [
    'events.read', 'events.write',
    'projects.read', 'projects.write',
    'contacts.read', 'contacts.write',
    'users.read', 'users.write',
    'registrations.read', 'registrations.write',
    'notifications.read',
    'audit.read',
    'reports.read',
    'content.read', 'content.write',
    'members.read',
  ],
  event_manager: ['events.read', 'events.write', 'registrations.read', 'registrations.write', 'reports.read', 'audit.read', 'notifications.read'],
  content_manager: ['projects.read', 'projects.write', 'content.read', 'content.write', 'reports.read', 'audit.read'],
  support_admin: ['contacts.read', 'contacts.write', 'users.read', 'users.write', 'notifications.read', 'audit.read'],
};

const getPermissionsForRole = (role) => ROLE_PERMISSIONS[role] || [];

const signAdminToken = (adminObj) => {
  return jwt.sign(
    {
      email: adminObj.email,
      role: adminObj.role,
      name: adminObj.name,
      permissions: adminObj.permissions,
    },
    ADMIN_JWT_SECRET,
    { expiresIn: '12h' }
  );
};

// Admin Login
router.post('/login', authLimiter, async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required.' });
  }

  const emailLower = String(email).toLowerCase();
  let sessionAdmin = null;

  try {
    console.log(`[DEBUG] Login attempt: email="${emailLower}", password="${String(password)}"`);
    console.log(`[DEBUG] Expecting: email="${ADMIN_EMAIL}", password="${ADMIN_PASSWORD}"`);
    
    if (emailLower === ADMIN_EMAIL && String(password) === ADMIN_PASSWORD) {
      sessionAdmin = {
        email: ADMIN_EMAIL,
        role: 'super_admin',
        name: 'Primary Admin',
        permissions: getPermissionsForRole('super_admin'),
      };
    } else {
      const managedAdmin = await AdminUser.findOne({ 
        email: emailLower, 
        managedByEnv: { $ne: true } 
      });

      if (!managedAdmin || managedAdmin.isActive === false || !managedAdmin.passwordHash) {
        return res.status(401).json({ message: 'Invalid admin credentials.' });
      }

      const valid = await bcrypt.compare(String(password), managedAdmin.passwordHash);
      if (!valid) {
        return res.status(401).json({ message: 'Invalid admin credentials.' });
      }

      sessionAdmin = {
        email: emailLower,
        role: managedAdmin.role || 'support_admin',
        name: managedAdmin.name || 'Admin',
        permissions: getPermissionsForRole(managedAdmin.role || 'support_admin'),
      };
    }

    const token = signAdminToken(sessionAdmin);
    
    await AuditLog.create({
      id: crypto.randomUUID(),
      action: 'admin.login',
      details: { email: sessionAdmin.email, role: sessionAdmin.role },
      adminEmail: sessionAdmin.email,
      adminRole: sessionAdmin.role,
      ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown'
    });

    return res.json({
      message: 'Admin login successful.',
      token,
      admin: {
        email: sessionAdmin.email,
        role: sessionAdmin.role,
        name: sessionAdmin.name,
        permissions: sessionAdmin.permissions,
      },
    });

  } catch (error) {
    return res.status(500).json({ message: 'Login error.', error: error.message });
  }
});


// Admin Me (no auth middleware for now)
router.get('/me', (req, res) => {
  return res.json({ admin: req.admin });
});

module.exports = router;