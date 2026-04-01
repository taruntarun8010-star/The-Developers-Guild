const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  type: { type: String, required: true },
  title: { type: String, required: true },
  message: { type: String, required: true },
  priority: { type: String, enum: ['low', 'normal', 'high', 'urgent'], default: 'normal' },
  read: { type: Boolean, default: false },
  readAt: { type: Date, default: null },
}, { timestamps: { createdAt: 'createdAt', updatedAt: false } });

module.exports = mongoose.model('Notification', notificationSchema);
