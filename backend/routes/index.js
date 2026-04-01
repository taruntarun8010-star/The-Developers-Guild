const express = require('express');

const authRoutes = require('./authRoutes');
const authAdvancedRoutes = require('./authAdvancedRoutes');
const eventRoutes = require('./eventRoutes');
const userRoutes = require('./userRoutes');
const projectRoutes = require('./projectRoutes');
const contactRoutes = require('./contactRoutes');

// Admin Routes
const adminAuthRoutes = require('./adminAuthRoutes');
const adminAnalyticsRoutes = require('./adminAnalyticsRoutes');
const adminContactRoutes = require('./adminContactRoutes');
const adminEventRoutes = require('./adminEventRoutes');
const adminManagementRoutes = require('./adminManagementRoutes');
const adminMemberRoutes = require('./adminMemberRoutes');
const adminProjectRoutes = require('./adminProjectRoutes');
const adminUserRoutes = require('./adminUserRoutes');

const router = express.Router();

router.get('/health', (req, res) => {
  res.json({ status: 'OK', service: "The Developers' Guild API", timestamp: new Date().toISOString() });
});

// Mount Public Routes
router.use('/auth', authRoutes);
router.use('/auth', authAdvancedRoutes);
router.use('/events', eventRoutes);
router.use('/user', userRoutes);
router.use('/projects', projectRoutes);
router.use('/contact', contactRoutes);

// Mount Admin Routes

// Temporary placeholder admin middleware
const requireAdminAuth = (req, res, next) => next();

router.use('/admin', adminAuthRoutes);
router.use('/admin/analytics', requireAdminAuth, adminAnalyticsRoutes);
router.use('/admin/contact-submissions', requireAdminAuth, adminContactRoutes);
router.use('/admin/events', requireAdminAuth, adminEventRoutes);
router.use('/admin/admin-users', requireAdminAuth, adminManagementRoutes);
router.use('/admin/members', requireAdminAuth, adminMemberRoutes);
router.use('/admin/projects', requireAdminAuth, adminProjectRoutes);
router.use('/admin/users', requireAdminAuth, adminUserRoutes);




const assistantRoutes = require('./assistantRoutes');
router.use('/assistant', assistantRoutes);




const adminSystemRoutes = require('./adminSystemRoutes');
router.use('/admin/system', requireAdminAuth, adminSystemRoutes);

module.exports = router;

