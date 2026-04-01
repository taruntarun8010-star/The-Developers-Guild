const express = require('express');
const User = require('../models/User');
const Event = require('../models/Event');
const Project = require('../models/Project');
const Registration = require('../models/Registration');
const AuditLog = require('../models/AuditLog');
const Notification = require('../models/Notification');
const crypto = require('crypto');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const [
      totalUsers,
      totalEvents,
      totalProjects,
      totalAuditLogs,
      totalNotifications,
      unreadNotifications,
      activeUsers,
      suspendedUsers,
      confirmedRegistrations,
      waitlistedRegistrations,
      attendedRegistrations,
      categoryStatsRes,
      registrationsStatsRes
    ] = await Promise.all([
      User.countDocuments(),
      Event.countDocuments(),
      Project.countDocuments(),
      AuditLog.countDocuments(),
      Notification.countDocuments(),
      Notification.countDocuments({ read: false }),
      User.countDocuments({ status: { $ne: 'suspended' } }),
      User.countDocuments({ status: 'suspended' }),
      Registration.countDocuments({ status: 'confirmed' }),
      Registration.countDocuments({ status: 'waitlisted' }),
      Registration.countDocuments({ attendedAt: { $exists: true } }),
      Event.aggregate([
        { $group: { _id: { $ifNull: ["$category", "Other"] }, count: { $sum: 1 } } }
      ]),
      Registration.aggregate([
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m", date: { $ifNull: ["$timestamp", new Date()] } } },
            value: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } },
        { $limit: 6 }
      ])
    ]);

    const categoryCounts = categoryStatsRes.reduce((acc, curr) => {
      acc[curr._id] = curr.count;
      return acc;
    }, {});

    const registrationSeries = registrationsStatsRes.map(item => ({
      month: item._id,
      value: item.value
    }));

    res.json({
      summary: {
        totalUsers,
        totalEvents,
        totalProjects,
        totalAuditLogs,
        totalNotifications,
        unreadNotifications,
        activeUsers,
        suspendedUsers,
        confirmedRegistrations,
        waitlistedRegistrations,
        attendedRegistrations,
      },
      categoryCounts,
      registrationSeries
    });
  } catch (error) {
    res.status(500).json({ message: "Error fetching analytics", error: error.message });
  }
});

module.exports = router;