const express = require('express');
const Event = require('../models/Event');
const Registration = require('../models/Registration');
const User = require('../models/User');

const router = express.Router();

// Helper to determine if an event is still open for registration
const isEventOpen = (event) => {
  const deadline = new Date(event.registrationDeadline);
  return deadline > new Date();
};

// GET all events
router.get('/', async (req, res) => {
  try {
    const events = await Event.find().lean();
    
    // Attach registration counts (confirmed/waitlisted) to each event
    const decoratedEvents = await Promise.all(events.map(async (event) => {
      const confirmedCount = await Registration.countDocuments({ eventId: event.id, status: 'confirmed' });
      const waitlistedCount = await Registration.countDocuments({ eventId: event.id, status: 'waitlisted' });
      
      const isFull = confirmedCount >= (event.capacity || 60);
      const isPastDeadline = !isEventOpen(event);

      let status = 'open';
      if (isPastDeadline) status = 'closed';
      else if (isFull) status = 'waitlist';

      return {
        ...event,
        confirmedCount,
        waitlistedCount,
        status,
        isFull,
        isPastDeadline
      };
    }));

    res.json(decoratedEvents);
  } catch (err) {
    res.status(500).json({ message: "Error fetching events", error: err.message });
  }
});

// POST register for an event
router.post('/register', async (req, res) => {
  const { userId, eventId } = req.body;
  if (!userId || !eventId) {
    return res.status(400).json({ message: "userId and eventId are required." });
  }

  try {
    const user = await User.findOne({ id: userId });
    if (!user) return res.status(404).json({ message: 'User not found.' });
    if (user.status === 'suspended') return res.status(403).json({ message: 'Your account is suspended. Please contact support.' });

    const event = await Event.findOne({ id: eventId });
    if (!event) return res.status(404).json({ message: "Event not found." });
    if (!isEventOpen(event)) return res.status(400).json({ message: 'Registration deadline has passed for this event.' });

    const existingRegistration = await Registration.findOne({ userId, eventId });
    if (existingRegistration) {
      return res.status(400).json({ message: `You are already ${existingRegistration.status} for this event.` });
    }

    const confirmedCount = await Registration.countDocuments({ eventId, status: 'confirmed' });
    const capacity = Number(event.capacity) || 60;
    
    const registrationStatus = confirmedCount >= capacity ? 'waitlisted' : 'confirmed';

    const newRegistration = new Registration({
      userId,
      eventId,
      status: registrationStatus
    });

    await newRegistration.save();

    let waitlistPosition = null;
    if (registrationStatus === 'waitlisted') {
      waitlistPosition = await Registration.countDocuments({ eventId, status: 'waitlisted' });
    }

    res.status(201).json({ 
      message: `Successfully ${registrationStatus}.`, 
      status: registrationStatus,
      waitlistPosition 
    });

  } catch (err) {
    res.status(500).json({ message: "Error registering for event", error: err.message });
  }
});

// POST cancel registration
router.post('/cancel-registration', async (req, res) => {
  const { userId, eventId } = req.body;
  try {
    const deleted = await Registration.findOneAndDelete({ userId, eventId });
    if (!deleted) {
      return res.status(404).json({ message: "Registration not found." });
    }
    
    // Auto-promote next person on waitlist logic could go here if required

    res.json({ message: "Registration cancelled successfully." });
  } catch (err) {
    res.status(500).json({ message: "Error cancelling registration", error: err.message });
  }
});

module.exports = router;
