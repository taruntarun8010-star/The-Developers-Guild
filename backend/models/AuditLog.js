const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  action: { type: String, required: true },
  details: { type: mongoose.Schema.Types.Mixed, required: true }, // flexible object
  adminEmail: { type: String, required: true },
  adminRole: { type: String, required: true },
  ip: { type: String, default: null },
}, { timestamps: { createdAt: 'createdAt', updatedAt: false } });

module.exports = mongoose.model('AuditLog', auditLogSchema);
