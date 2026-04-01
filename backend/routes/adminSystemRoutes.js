const express = require('express');
const os = require('os');

const router = express.Router();

router.get('/info', (req, res) => {
  const uptimeSec = process.uptime();
  const memory = process.memoryUsage();
  return res.json({
    service: "The Developers' Guild API",
    version: '1.0.0',
    node: process.version,
    platform: `${os.platform()} ${os.release()}`,
    uptimeSec,
    memory,
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;
