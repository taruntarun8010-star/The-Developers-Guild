const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

const router = express.Router();

const VERIFICATION_TTL_MS = 15 * 60 * 1000;
const LOGIN_OTP_TTL_MS = 10 * 60 * 1000;
const RESET_TTL_MS = 15 * 60 * 1000;

const generateVerificationCode = () => Math.floor(100000 + Math.random() * 900000).toString();

// Verify Email
router.post('/verify-email', async (req, res) => {
  const { email, code } = req.body;

  if (!email || !code) {
    return res.status(400).json({ message: 'Email and verification code are required.' });
  }

  try {
    const user = await User.findOne({ email: email.toLowerCase() });
    
    if (!user) {
      return res.status(404).json({ message: 'No account found for this email.' });
    }

    if (user.isVerified) {
      return res.json({ message: 'Email is already verified.', user: { id: user.id, name: user.name, email: user.email } });
    }

    if (!user.verificationCode || String(user.verificationCode) !== String(code).trim()) {
      return res.status(400).json({ message: 'Invalid verification code.' });
    }

    if (!user.verificationExpiresAt || new Date(user.verificationExpiresAt).getTime() < Date.now()) {
      return res.status(400).json({ message: 'Verification code expired. Please request a new code.' });
    }

    user.isVerified = true;
    user.emailVerifiedAt = new Date();
    user.verificationCode = undefined;
    user.verificationExpiresAt = undefined;
    
    await user.save();

    return res.json({ message: 'Email verified successfully. You can now log in.', user: { id: user.id, name: user.name, email: user.email } });
  } catch (error) {
    res.status(500).json({ message: "Error verifying email", error: error.message });
  }
});

// Resend Verification
router.post('/resend-verification', async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ message: 'Email is required.' });
  }

  try {
    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      return res.status(404).json({ message: 'No account found for this email.' });
    }

    if (user.isVerified) {
      return res.status(400).json({ message: 'Email is already verified. You can log in.' });
    }

    user.verificationCode = generateVerificationCode();
    user.verificationExpiresAt = new Date(Date.now() + VERIFICATION_TTL_MS);
    await user.save();

    // Mock Email Snippet (replace or ignore)
    // await sendVerificationEmail({ email: user.email, name: user.name, code: user.verificationCode });

    return res.json({ message: 'A new verification code has been sent to your email.' });
  } catch (error) {
    return res.status(500).json({ message: 'Unable to send verification email right now.', error: error.message });
  }
});

// Verify Login OTP
router.post('/login/verify-otp', async (req, res) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    return res.status(400).json({ message: 'Email and OTP are required.' });
  }

  try {
    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      return res.status(404).json({ message: 'No account found. Please register first.' });
    }

    if (!user.isVerified) {
      return res.status(403).json({
        message: 'Please verify your email before logging in.',
        requiresVerification: true,
        email: user.email,
      });
    }

    if (!user.loginOtp || String(user.loginOtp) !== String(otp).trim()) {
      return res.status(400).json({ message: 'Invalid OTP.' });
    }

    if (!user.loginOtpExpiresAt || new Date(user.loginOtpExpiresAt).getTime() < Date.now()) {
      return res.status(400).json({ message: 'OTP expired. Please request a new OTP.' });
    }

    user.loginOtp = undefined;
    user.loginOtpExpiresAt = undefined;
    user.lastLoginAt = new Date();
    await user.save();

    // Ideally generate JWT here to send to frontend!
    return res.json({ message: 'Login successful!', user: { id: user.id, name: user.name, email: user.email }});
  } catch (error) {
    res.status(500).json({ message: "Error verifying OTP", error: error.message });
  }
});

router.post('/login/resend-otp', async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ message: 'Email is required.' });
  }

  try {
    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      return res.status(404).json({ message: 'No account found. Please register first.' });
    }

    if (!user.isVerified) {
      return res.status(403).json({
        message: 'Please verify your email before logging in.',
        requiresVerification: true,
        email: user.email,
      });
    }

    user.loginOtp = generateVerificationCode();
    user.loginOtpExpiresAt = new Date(Date.now() + LOGIN_OTP_TTL_MS);
    await user.save();

    // Mock Send Email here!
    return res.json({ message: 'A new login OTP has been sent to your email.' });
  } catch (error) {
    res.status(500).json({ message: "Error resending OTP", error: error.message });
  }
});

// Forgot Password
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ message: 'Email is required.' });
  }

  try {
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(404).json({ message: 'No account found for this email.' });
    }

    user.resetCode = generateVerificationCode();
    user.resetExpiresAt = new Date(Date.now() + RESET_TTL_MS);
    await user.save();

    // Mock Send Email here

    return res.json({ message: 'Password reset code has been sent to your email.' });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to process forgot password request.', error: error.message });
  }
});

// Reset Password
router.post('/reset-password', async (req, res) => {
  const { email, code, newPassword } = req.body;

  if (!email || !code || !newPassword) {
    return res.status(400).json({ message: 'email, code and newPassword are required.' });
  }

  if (String(newPassword).length < 6) {
    return res.status(400).json({ message: 'Password must be at least 6 characters long.' });
  }

  try {
    const user = await User.findOne({ email: email.toLowerCase() });
    
    if (!user) {
      return res.status(404).json({ message: 'No account found for this email.' });
    }

    if (!user.resetCode || String(user.resetCode) !== String(code).trim()) {
      return res.status(400).json({ message: 'Invalid reset code.' });
    }

    if (!user.resetExpiresAt || new Date(user.resetExpiresAt).getTime() < Date.now()) {
      return res.status(400).json({ message: 'Reset code expired. Request a new one.' });
    }

    user.passwordHash = await bcrypt.hash(String(newPassword), 10);
    user.resetCode = undefined;
    user.resetExpiresAt = undefined;
    await user.save();

    return res.json({ message: 'Password reset successful. You can now log in.' });
  } catch (error) {
    return res.status(500).json({ message: 'Error resetting password.', error: error.message });
  }
});

module.exports = router;