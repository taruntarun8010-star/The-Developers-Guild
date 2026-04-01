const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  title: { type: String, required: true },
  summary: { type: String, required: true },
  techStack: [{ type: String }],
  githubUrl: { type: String },
  demoUrl: { type: String },
  status: { type: String, enum: ['active', 'completed', 'archived'], default: 'active' },
}, { timestamps: true });

module.exports = mongoose.model('Project', projectSchema);
