const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const validate = require('../middlewares/validate');
const { registerSchema, loginSchema, forgotPasswordSchema } = require('../validations/schemas');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key';
const VERIFICATION_TTL_MS = 15 * 60 * 1000;
const LOGIN_OTP_TTL_MS = 10 * 60 * 1000;
const RESET_TTL_MS = 15 * 60 * 1000;

// Need to mock email sending for now, or import from server.js. Let's assume you'll configure SMTP correctly.
const generateVerificationCode = () => Math.floor(100000 + Math.random() * 900000).toString();

// Register Route
router.post('/register', validate(registerSchema), async (req, res) => {
  const { name, email, collegeId, password } = req.body;
  const emailLower = email.toLowerCase();

  try {
    if (!emailLower.endsWith('@accurate.in') && !emailLower.endsWith('@gmail.com')) {
      return res.status(400).json({ message: "Registration requires an @accurate.in or @gmail.com email." });
    }

    const existingUser = await User.findOne({ email: emailLower });
    const verificationCode = generateVerificationCode();
    const verificationExpiresAt = new Date(Date.now() + VERIFICATION_TTL_MS);
    const passwordHash = await bcrypt.hash(password, 10);

    if (existingUser) {
      if (existingUser.isVerified) {
        return res.status(400).json({ message: "An account with this email already exists." });
      }

      // Update existing unverified user
      existingUser.name = name;
      existingUser.collegeId = collegeId;
      existingUser.passwordHash = passwordHash;
      existingUser.verificationCode = verificationCode;
      existingUser.verificationExpiresAt = verificationExpiresAt;
      await existingUser.save();

      // In real-world, send email here
      return res.status(200).json({ message: "Account exists but not verified. A new verification code has been sent. Code: " + verificationCode, email: existingUser.email });
    }

    const newUser = new User({
      id: crypto.randomUUID(), // keep string id for compatibility
      name,
      email: emailLower,
      collegeId,
      passwordHash,
      verificationCode,
      verificationExpiresAt
    });

    await newUser.save();
    
    // In real world, send email here
    return res.status(201).json({ message: "Registration successful. Please verify your email. Code: " + verificationCode, email: newUser.email });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error during registration", error: error.message });
  }
});

// Login Route
router.post('/login', validate(loginSchema), async (req, res) => {
  const { email, password } = req.body;
  
  try {
    const user = await User.findOne({ email: email.toLowerCase() });
    
    if (!user) {
      return res.status(400).json({ message: "Invalid credentials." });
    }

    if (!user.isVerified) {
      return res.status(403).json({ requiresVerification: true, email: user.email, message: "Email not verified." });
    }

    if (user.status === 'suspended' || user.status === 'banned') {
      return res.status(403).json({ message: `Your account has been ${user.status}. Contact support.` });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials." });
    }

    // OTP logic could be inserted here if needed...

    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
    user.lastLoginAt = new Date();
    await user.save();

    res.status(200).json({
      token,
      id: user.id,
      name: user.name,
      email: user.email,
      collegeId: user.collegeId,
      profilePhoto: user.profilePhoto,
      status: user.status
    });

  } catch (error) {
    res.status(500).json({ message: "Server error during login", error: error.message });
  }
});

// Middleware to verify user token
const authenticateUser = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Authentication required.' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired token.' });
  }
};

// GET current user profile
router.get('/me', authenticateUser, async (req, res) => {
  try {
    const user = await User.findOne({ id: req.user.id });
    if (!user) return res.status(404).json({ message: 'User not found.' });
    
    res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      collegeId: user.collegeId,
      profilePhoto: user.profilePhoto,
      status: user.status,
      joinedAt: user.joinedAt,
      bio: user.bio,
      githubUrl: user.githubUrl,
      linkedinUrl: user.linkedinUrl
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching profile.', error: error.message });
  }
});

module.exports = router;

