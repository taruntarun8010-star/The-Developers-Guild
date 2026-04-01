const express = require('express');
const Event = require('../models/Event');
const Registration = require('../models/Registration');
const AuditLog = require('../models/AuditLog');
const Notification = require('../models/Notification');
const validate = require('../middlewares/validate');
const { createEventSchema, updateEventSchema } = require('../validations/schemas');
const crypto = require('crypto');

const router = express.Router();

const requireRole = require('../middlewares/requireRole');

const isEventOpen = (event) => {
  const deadline = new Date(event.registrationDeadline);
  return deadline > new Date();
};

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

// GET all events (Admin view)
router.get('/', async (req, res) => {
  try {
    const events = await Event.find().lean();
    const decoratedEvents = await Promise.all(events.map(decorateEvent));
    res.json(decoratedEvents);
  } catch (error) {
    res.status(500).json({ message: "Error fetching events", error: error.message });
  }
});

// POST create event (super_admin or sub_admin)
router.post('/', requireRole('sub_admin'), validate(createEventSchema), async (req, res) => {
  try {
    const eventData = req.body;
    
    // Auto increment ID logic replicated, though ObjectId is preferred long term
    const latestEvent = await Event.findOne().sort({ createdAt: -1 });
    const nextId = latestEvent && !isNaN(Number(latestEvent.id)) ? Number(latestEvent.id) + 1 : Date.now().toString();

    const newEvent = new Event({
      id: nextId.toString(),
      name: eventData.name,
      date: eventData.date,
      time: eventData.time,
      description: eventData.description,
      category: eventData.category,
      location: eventData.location,
      capacity: eventData.capacity || 60,
      registrationDeadline: eventData.registrationDeadline || eventData.date
    });

    await newEvent.save();

    // Audit and Notification
    const adminEmail = req.admin?.email || 'system';
    await AuditLog.create({
      id: crypto.randomUUID(),
      action: 'event.create',
      details: { eventId: newEvent.id, name: newEvent.name },
      adminEmail,
      adminRole: req.admin?.role || 'system',
      ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown'
    });

    await Notification.create({
      id: crypto.randomUUID(),
      type: 'event',
      title: 'Event created',
      message: `${newEvent.name} was created by ${adminEmail}.`
    });

    res.status(201).json({ message: 'Event created successfully.', event: await decorateEvent(newEvent) });

  } catch (error) {
    res.status(500).json({ message: "Error creating event", error: error.message });
  }
});

// PUT update event (super_admin or sub_admin)
router.put('/:id', requireRole('sub_admin'), validate(updateEventSchema), async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const event = await Event.findOne({ id });
    if (!event) return res.status(404).json({ message: 'Event not found.' });

    Object.assign(event, updateData);
    await event.save();

    const adminEmail = req.admin?.email || 'system';
    await AuditLog.create({
      id: crypto.randomUUID(),
      action: 'event.update',
      details: { eventId: id, updates: Object.keys(updateData) },
      adminEmail,
      adminRole: req.admin?.role || 'system',
      ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown'
    });

    res.json({ message: 'Event updated successfully.', event: await decorateEvent(event) });
  } catch (error) {
    res.status(500).json({ message: "Error updating event", error: error.message });
  }
});
// DELETE remove event (super_admin or sub_admin)
router.delete('/:id', requireRole('sub_admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const event = await Event.findOneAndDelete({ id });
    if (!event) return res.status(404).json({ message: 'Event not found.' });

    // Remove registrations for this event
    await Registration.deleteMany({ eventId: id });

    const adminEmail = req.admin?.email || 'system';
    await AuditLog.create({
      id: crypto.randomUUID(),
      action: 'event.delete',
      details: { eventId: id, name: event.name },
      adminEmail,
      adminRole: req.admin?.role || 'system',
      ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown'
    });

    res.json({ message: 'Event and all its registrations have been removed successfully.' });
  } catch (error) {
    res.status(500).json({ message: "Error deleting event", error: error.message });
  }
});
// DELETE event (super_admin or sub_admin)
router.delete('/:id', requireRole('sub_admin'), async (req, res) => {
  try {
    const { id } = req.params;
    
    const event = await Event.findOne({ id });
    if (!event) return res.status(404).json({ message: 'Event not found.' });

    await Event.deleteOne({ id });
    const { deletedCount } = await Registration.deleteMany({ eventId: id });

    const adminEmail = req.admin?.email || 'system';
    await AuditLog.create({
      id: crypto.randomUUID(),
      action: 'event.delete',
      details: { eventId: id, name: event.name, cascadedRegistrations: deletedCount },
      adminEmail,
      adminRole: req.admin?.role || 'system',
      ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown'
    });

    await Notification.create({
      id: crypto.randomUUID(),
      type: 'event',
      title: 'Event deleted',
      message: `${event.name} was deleted by ${adminEmail}. ${deletedCount} registrations removed.`
    });

    res.json({ message: 'Event and associated registrations deleted successfully.' });
  } catch (error) {
    res.status(500).json({ message: "Error deleting event", error: error.message });
  }
});

module.exports = router;
