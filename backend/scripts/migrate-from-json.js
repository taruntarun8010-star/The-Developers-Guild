require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

const connectDB = require('../db');
const User = require('../models/User');
const Event = require('../models/Event');
const Registration = require('../models/Registration');
const Project = require('../models/Project');
const ContactSubmission = require('../models/ContactSubmission');
const AuditLog = require('../models/AuditLog');
const Notification = require('../models/Notification');
const AdminUser = require('../models/AdminUser');
const MemberDirectory = require('../models/MemberDirectory');
const ContentSettings = require('../models/ContentSettings');

const DB_PATH = path.join(__dirname, '../db.json');

const migrate = async () => {
  try {
    await connectDB();
    console.log('MongoDB connected for migration.');

    if (!fs.existsSync(DB_PATH)) {
      console.log('No db.json found. Nothing to migrate.');
      process.exit(0);
    }

    const { 
      users = [], 
      events = [], 
      registrations = [], 
      projects = [], 
      contactSubmissions = [], 
      auditLogs = [], 
      notifications = [], 
      adminUsers = [], 
      memberDirectory = [], 
      contentSettings 
    } = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));

    // Clear existing collections
    await Promise.all([
      User.deleteMany(),
      Event.deleteMany(),
      Registration.deleteMany(),
      Project.deleteMany(),
      ContactSubmission.deleteMany(),
      AuditLog.deleteMany(),
      Notification.deleteMany(),
      AdminUser.deleteMany(),
      MemberDirectory.deleteMany(),
      ContentSettings.deleteMany(),
    ]);

    console.log('Cleared existing MongoDB data.');

    // Migration function with mapping
    if (users.length) await User.insertMany(users);
    
    // Process events to enforce correct date parsing
    if (events.length) {
      await Event.insertMany(events.map(event => ({
        ...event,
        date: new Date(event.date),
        capacity: Number(event.capacity) || 60,
        registrationDeadline: event.registrationDeadline ? new Date(event.registrationDeadline) : new Date(event.date)
      })));
    }

    // Process registrations to resolve existing dupes and missing timestamps
    if (registrations.length) {
      const validRegistrations = [];
      const seen = new Set();
      for (const reg of registrations) {
        const key = `${reg.userId}-${reg.eventId}`;
        if (!seen.has(key)) {
          seen.add(key);
          validRegistrations.push({
            ...reg,
            timestamp: reg.timestamp ? new Date(reg.timestamp) : new Date(),
          });
        }
      }
      await Registration.insertMany(validRegistrations);
    }

    if (projects.length) await Project.insertMany(projects);
    if (contactSubmissions.length) await ContactSubmission.insertMany(contactSubmissions);
    if (auditLogs.length) await AuditLog.insertMany(auditLogs);
    if (notifications.length) await Notification.insertMany(notifications);
    if (adminUsers.length) await AdminUser.insertMany(adminUsers);
    if (memberDirectory.length) await MemberDirectory.insertMany(memberDirectory);
    
    if (contentSettings) {
      await ContentSettings.create(contentSettings);
    } else {
      await ContentSettings.create({ announcement: 'Welcome to Developers Guild', heroBadge: 'Build. Learn. Lead.' });
    }

    console.log('Migration completed successfully.');
    process.exit(0);

  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
};

migrate();
