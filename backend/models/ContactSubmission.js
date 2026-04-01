const mongoose = require('mongoose');

const contactSubmissionSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  email: { type: String, required: true },
  message: { type: String, required: true },
  status: { type: String, enum: ['new', 'in-progress', 'resolved'], default: 'new' },
  priority: { type: String, enum: ['low', 'normal', 'high', 'urgent'], default: 'normal' },
  assignee: { type: String, default: null },
  note: { type: String, default: '' },
  readAt: { type: Date, default: null },
}, { timestamps: true });

module.exports = mongoose.model('ContactSubmission', contactSubmissionSchema);
