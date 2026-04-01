const mongoose = require('mongoose');

const adminUserSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  role: { type: String, required: true },
  isActive: { type: Boolean, default: true },
  passwordHash: { type: String, required: true },
  managedByEnv: { type: Boolean, default: false },
  permissions: [{ type: String }],
}, { timestamps: true });

module.exports = mongoose.model('AdminUser', adminUserSchema);
