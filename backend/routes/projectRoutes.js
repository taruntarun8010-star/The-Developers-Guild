const express = require('express');
const Project = require('../models/Project');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const projects = await Project.find({ status: { $ne: 'Draft' } }).sort({ createdAt: -1 }).lean();
    res.json(projects);
  } catch (error) {
    res.status(500).json({ message: "Error fetching projects", error: error.message });
  }
});

module.exports = router;