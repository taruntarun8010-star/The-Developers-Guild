const mongoose = require('mongoose');

const memberDirectorySchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  email: { type: String, required: true },
  designation: { type: String, required: true },
}, { timestamps: true });

module.exports = mongoose.model('MemberDirectory', memberDirectorySchema);
