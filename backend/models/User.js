const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true }, // retaining string id for migration
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  collegeId: { type: String },
  joinedAt: { type: Date, default: Date.now },
  isVerified: { type: Boolean, default: false },
  passwordHash: { type: String, required: true },
  verificationCode: { type: String },
  verificationExpiresAt: { type: Date },
  loginOtp: { type: String },
  loginOtpExpiresAt: { type: Date },
  resetCode: { type: String },
  resetExpiresAt: { type: Date },
  profilePhoto: { type: String },
  bio: { type: String },
  githubUrl: { type: String },
  linkedinUrl: { type: String },
  portfolioUrl: { type: String },
  skills: [{ type: String }],
  status: { type: String, enum: ['active', 'suspended', 'banned'], default: 'active' },
  emailVerifiedAt: { type: Date },
  lastLoginAt: { type: Date },
  passwordUpdatedAt: { type: Date },
  // NAYA FIELD: role
  role: {
    type: String,
    enum: ['admin', 'subadmin', 'member'],
    default: 'member' // By default naya user member hoga
  },
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
