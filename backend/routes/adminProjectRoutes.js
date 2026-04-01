const express = require('express');
const Project = require('../models/Project');
const AuditLog = require('../models/AuditLog');
const requireRole = require('../middlewares/requireRole');
const crypto = require('crypto');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const projects = await Project.find().sort({ createdAt: -1 }).lean();
    res.json(projects);
  } catch (error) {
    res.status(500).json({ message: "Error fetching projects", error: error.message });
  }
});

router.post('/', requireRole('sub_admin'), async (req, res) => {
  const { title, summary, techStack, githubUrl, demoUrl, status, image } = req.body;

  if (!title || !summary || !techStack) {
    return res.status(400).json({ message: 'title, summary and techStack are required.' });
  }

  try {
    const project = await Project.create({
      id: crypto.randomUUID(),
      title: title.trim(),
      summary: summary.trim(),
      techStack: techStack.trim(),
      githubUrl: githubUrl ? githubUrl.trim() : undefined,
      demoUrl: demoUrl ? demoUrl.trim() : undefined,
      status: status ? status.trim() : 'In Progress',
      image: image ? image.trim() : undefined
    });

    const adminEmail = req.admin?.email || 'system';
    await AuditLog.create({
      id: crypto.randomUUID(),
      action: 'project.create',
      details: { projectId: project.id, title: project.title },
      adminEmail,
      adminRole: req.admin?.role || 'system',
      ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown'
    });

    res.status(201).json({ message: 'Project created successfully.', project });
  } catch (error) {
    res.status(500).json({ message: "Error creating project", error: error.message });
  }
});

router.put('/:id', requireRole('sub_admin'), async (req, res) => {
  try {
    const project = await Project.findOne({ id: req.params.id });
    if (!project) return res.status(404).json({ message: 'Project not found.' });

    const editableFields = ['title', 'summary', 'techStack', 'githubUrl', 'demoUrl', 'status', 'image'];
    let fieldsUpdated = {};
    
    for (const field of editableFields) {
      if (req.body[field] !== undefined) {
        project[field] = req.body[field] ? String(req.body[field]).trim() : undefined;
        fieldsUpdated[field] = project[field];
      }
    }

    await project.save();

    const adminEmail = req.admin?.email || 'system';
    await AuditLog.create({
      id: crypto.randomUUID(),
      action: 'project.update',
      details: { projectId: project.id, fields: Object.keys(fieldsUpdated) },
      adminEmail,
      adminRole: req.admin?.role || 'system',
      ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown'
    });

    res.json({ message: 'Project updated successfully.', project });
  } catch (error) {
    res.status(500).json({ message: "Error updating project", error: error.message });
  }
});

router.delete('/:id', requireRole('sub_admin'), async (req, res) => {
  try {
    const project = await Project.findOneAndDelete({ id: req.params.id });
    if (!project) return res.status(404).json({ message: 'Project not found.' });

    const adminEmail = req.admin?.email || 'system';
    await AuditLog.create({
      id: crypto.randomUUID(),
      action: 'project.delete',
      details: { projectId: project.id, title: project.title },
      adminEmail,
      adminRole: req.admin?.role || 'system',
      ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown'
    });

    res.json({ message: 'Project deleted successfully.' });
  } catch (error) {
    res.status(500).json({ message: "Error deleting project", error: error.message });
  }
});

module.exports = router;