const express = require('express');
const User = require('../models/User');
const Registration = require('../models/Registration');
const Event = require('../models/Event');
const validate = require('../middlewares/validate');
const { updateProfileSchema } = require('../validations/schemas');

const router = express.Router();

// Helper Event open status
const isEventOpen = (event) => {
  const deadline = new Date(event.registrationDeadline);
  return deadline > new Date();
};

// Replicate old DB `decorateEvent` behavior using Mongoose models
const decorateEvent = async (event) => {
  const confirmedCount = await Registration.countDocuments({ eventId: event.id, status: 'confirmed' });
  const waitlistedCount = await Registration.countDocuments({ eventId: event.id, status: 'waitlisted' });
  
  const isFull = confirmedCount >= (event.capacity || 60);
  const isPastDeadline = !isEventOpen(event);

  let status = 'open';
  if (isPastDeadline) status = 'closed';
  else if (isFull) status = 'waitlist';

  return { ...event.toObject(), confirmedCount, waitlistedCount, status, isFull, isPastDeadline };
};

// GET user registrations
router.get('/:userId/registrations', async (req, res) => {
  const { userId } = req.params;
  try {
    const registrations = await Registration.find({ userId }).lean();
    
    const populatedRegistrations = await Promise.all(
      registrations.map(async (reg) => {
        const event = await Event.findOne({ id: reg.eventId });
        if (!event) return null;
        
        const decorated = await decorateEvent(event);
        return {
          ...decorated,
          registrationStatus: reg.status || 'confirmed',
          registrationTimestamp: reg.timestamp || null,
          attendedAt: reg.attendedAt || null,
        };
      })
    );

    res.json(populatedRegistrations.filter(Boolean));
  } catch (error) {
    res.status(500).json({ message: "Error fetching user registrations", error: error.message });
  }
});

// PUT update user profile
router.put('/:userId/update-profile', validate(updateProfileSchema), async (req, res) => {
  const { userId } = req.params;
  const updateData = req.body;
  
  try {
    const user = await User.findOne({ id: userId });
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    if (updateData.profilePhoto && updateData.profilePhoto.length > 2_000_000) {
      return res.status(400).json({ message: 'Profile photo is too large. Must be under 2MB.' });
    }

    // Assign mapped updates safely
    ['name', 'collegeId', 'bio', 'githubUrl', 'linkedinUrl', 'portfolioUrl', 'profilePhoto'].forEach(key => {
      if (updateData[key] !== undefined) {
        user[key] = updateData[key].trim() || '';
      }
    });

    if (updateData.skills && Array.isArray(updateData.skills)) {
       user.skills = updateData.skills.map(s => String(s).trim()).filter(Boolean);
    }
    
    // Auto-update timestamp through Mongoose
    await user.save();

    // Replicate Audit Log
    const AuditLog = require('../models/AuditLog');
    await AuditLog.create({
        id: require('crypto').randomUUID(),
        action: 'user_profile_update',
        details: { targetUserId: user.id },
        adminEmail: 'system',
        adminRole: 'system',
        ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown'
    });

    res.json({
      message: 'Profile updated successfully.',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        collegeId: user.collegeId,
        bio: user.bio,
        githubUrl: user.githubUrl,
        linkedinUrl: user.linkedinUrl,
        portfolioUrl: user.portfolioUrl,
        skills: user.skills,
        profilePhoto: user.profilePhoto,
        status: user.status
      }
    });

  } catch (error) {
    res.status(500).json({ message: "Error updating profile", error: error.message });
  }
});

module.exports = router;
