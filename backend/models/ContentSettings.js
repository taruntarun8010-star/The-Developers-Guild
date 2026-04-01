const mongoose = require('mongoose');

const contentSettingsSchema = new mongoose.Schema({
  announcement: { type: String, default: '' },
  heroBadge: { type: String, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('ContentSettings', contentSettingsSchema);
