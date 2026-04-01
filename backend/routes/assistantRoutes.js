const express = require('express');
const rateLimit = require('express-rate-limit');

const router = express.Router();

const chatLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 20,
  message: { message: "Too many chat requests, please try again later." }
});

const localAssistantReply = ({ message, language, contextPath }) => {
  const normalized = message.toLowerCase();
  let reply = "I'm sorry, I couldn't understand that. I'm a simple mock assistant until the real one is connected!";
  if (normalized.includes('hello') || normalized.includes('hi')) reply = 'Hello! How can I help you today?';
  if (normalized.includes('event')) reply = 'We have many exciting events! Check out the events page.';
  if (normalized.includes('project')) reply = 'Members work on various tech projects. Look at our projects showcase.';
  
  if (language === 'hi') reply += ' (Hindi response not available in mock)';
  
  return { reply, suggestedActions: [] };
};

const localSkillAnalysis = (payload) => {
  return {
    analysis: `Mock Analysis for ${payload.name}: Great skills! Keep it up.`,
    recommendedRoles: ['Developer', 'Engineer'],
    learningPath: ['Learn React', 'Learn Node.js'],
    source: 'local-fallback'
  }
};

router.post('/chat', chatLimiter, (req, res) => {
  const message = String(req.body?.message || '').trim();
  const language = String(req.body?.language || 'en').trim().toLowerCase();
  const contextPath = String(req.body?.contextPath || '/').slice(0, 120);

  if (!message) {
    return res.status(400).json({ message: 'message is required.' });
  }

  if (message.length > 600) {
    return res.status(400).json({ message: 'message is too long. Keep it under 600 characters.' });
  }

  try {
    const response = localAssistantReply({ message, language, contextPath });
    return res.json({
      ...response,
      source: 'backend-assistant',
      timestamp: new Date().toISOString(),
    });
  } catch {
    return res.status(500).json({ message: 'Assistant is temporarily unavailable.' });
  }
});

router.post('/analyze-skills', async (req, res) => {
  const payload = {
    name: req.body?.name,
    skills: Array.isArray(req.body?.skills) ? req.body.skills : [],
  };

  if (!payload.name || payload.skills.length === 0) {
    return res.status(400).json({ message: 'name and at least one skill are required.' });
  }

  try {
    const response = await fetch('http://localhost:8000/analyze-skills', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const fallback = localSkillAnalysis(payload);
      return res.status(200).json(fallback);
    }

    const data = await response.json();
    const normalizedData = {
      ...data,
      source: 'python-service',
    };
    return res.json(normalizedData);
  } catch (err) {
    const fallback = localSkillAnalysis(payload);
    return res.status(200).json(fallback);
  }
});

module.exports = router;