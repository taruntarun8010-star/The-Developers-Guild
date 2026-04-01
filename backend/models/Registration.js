const mongoose = require('mongoose');

const registrationSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  eventId: { type: String, required: true },
  status: { type: String, enum: ['registered', 'waitlisted', 'cancelled'], default: 'registered' },
  timestamp: { type: Date, default: Date.now },
  attendedAt: { type: Date },
  promotedAt: { type: Date },
}, { timestamps: true });

// Create compound index for userId + eventId (should be unique to prevent double registrations)
registrationSchema.index({ userId: 1, eventId: 1 }, { unique: true });

module.exports = mongoose.model('Registration', registrationSchema);