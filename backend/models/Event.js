const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  date: { type: Date, required: true },
  time: { type: String, required: true },
  description: { type: String, required: true },
  category: { type: String, required: true },
  location: { type: String },
  capacity: { type: Number, required: true, default: 60 },
  registrationDeadline: { type: Date, required: true },
}, { timestamps: true });

module.exports = mongoose.model('Event', eventSchema);