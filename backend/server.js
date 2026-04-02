const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const fs = require('fs');
const path = require('path');
const os = require('os');
const QRCode = require('qrcode');
const PDFDocument = require('pdfkit');
const crypto = require('crypto');
require('dotenv').config();
const { getDb, writeDb } = require('./dbUtils');

const app = express();

const PORT = process.env.PORT || 5000;
const FRONTEND_BASE_URL = process.env.FRONTEND_BASE_URL || 'http://localhost:5173';
const USER_JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key';
const REFRESH_JWT_SECRET = process.env.REFRESH_JWT_SECRET || 'aimt-refresh-secret-2026-change';
const ACCESS_TOKEN_TTL = '15m';
const REFRESH_TOKEN_TTL = '30d';
const REFRESH_COOKIE_NAME = 'dg_refresh_token';

const allowedOrigins = [
  'https://thedevelopersguild.tech',
  FRONTEND_BASE_URL,
  'http://localhost:5173',
];

// Rate limiters
const chatLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 20,
  message: { message: "Too many chat requests, please try again later." }
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { message: "Too many attempts, please try again in 15 minutes." }
});

const contactLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 8,
  message: { message: 'Too many contact messages. Please wait a few minutes and try again.' }
});

app.use(cors({
  origin: allowedOrigins,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true,
}));
app.options('*', cors({
  origin: allowedOrigins,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true,
}));
app.use(bodyParser.json());

const parseCookies = (cookieHeader) => {
  const source = String(cookieHeader || '');
  if (!source) return {};
  const map = {};
  for (const part of source.split(';')) {
    const [k, ...rest] = part.trim().split('=');
    if (!k) continue;
    map[k] = decodeURIComponent(rest.join('='));
  }
  return map;
};

const setRefreshCookie = (res, token) => {
  const secure = process.env.NODE_ENV === 'production';
  const sameSite = secure ? 'None' : 'Lax';
  const maxAge = 30 * 24 * 60 * 60 * 1000;
  res.cookie(REFRESH_COOKIE_NAME, token, {
    httpOnly: true,
    secure,
    sameSite,
    maxAge,
    path: '/',
  });
};

const clearRefreshCookie = (res) => {
  const secure = process.env.NODE_ENV === 'production';
  const sameSite = secure ? 'None' : 'Lax';
  res.clearCookie(REFRESH_COOKIE_NAME, {
    httpOnly: true,
    secure,
    sameSite,
    path: '/',
  });
};

const signUserAccessToken = (user) => jwt.sign(
  { kind: 'user', id: user.id, email: user.email },
  USER_JWT_SECRET,
  { expiresIn: ACCESS_TOKEN_TTL }
);

const signAdminAccessToken = ({ email, role, permissions, name }) => jwt.sign({
  kind: 'admin',
  email,
  role,
  permissions,
  name,
}, ADMIN_JWT_SECRET, { expiresIn: ACCESS_TOKEN_TTL });

const signRefreshToken = (payload) => jwt.sign({
  kind: payload.kind,
  sub: payload.sub,
  email: payload.email,
  role: payload.role,
}, REFRESH_JWT_SECRET, { expiresIn: REFRESH_TOKEN_TTL });

const commonBreachedPasswords = new Set([
  '123456', '12345678', '123456789', 'password', 'qwerty', '111111',
  'abc123', 'iloveyou', 'admin123', 'letmein', 'welcome', 'passw0rd',
  '123123', '000000', '987654321', 'qwerty123', 'password123',
]);

const getPasswordStrength = (password, email = '') => {
  const pass = String(password || '');
  const emailLocal = String(email || '').split('@')[0].toLowerCase();
  let score = 0;
  const checks = {
    length12: pass.length >= 12,
    upper: /[A-Z]/.test(pass),
    lower: /[a-z]/.test(pass),
    digit: /\d/.test(pass),
    symbol: /[^A-Za-z0-9]/.test(pass),
    noEmailLocal: emailLocal ? !pass.toLowerCase().includes(emailLocal) : true,
  };

  score += checks.length12 ? 2 : pass.length >= 8 ? 1 : 0;
  score += checks.upper ? 1 : 0;
  score += checks.lower ? 1 : 0;
  score += checks.digit ? 1 : 0;
  score += checks.symbol ? 1 : 0;
  score += checks.noEmailLocal ? 1 : 0;

  const normalized = pass.toLowerCase();
    const breached = commonBreachedPasswords.has(normalized);
  const level = score >= 6 ? 'strong' : score >= 4 ? 'medium' : 'weak';
  return { score, level, breached, checks };
};

const validatePasswordPolicy = (password, email = '') => {
  const strength = getPasswordStrength(password, email);
  if (strength.breached) {
    return { ok: false, message: 'This password is found in breached/common password lists. Choose another password.' };
  }
  if (String(password || '').length < 8) {
    return { ok: false, message: 'Password must be at least 8 characters long.' };
  }
  if (strength.level === 'weak') {
    return { ok: false, message: 'Password is too weak. Use upper/lowercase letters, digits, and symbols.' };
  }
  return { ok: true, strength };
};

const requireUserAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization || '';
  const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  const cookies = parseCookies(req.headers.cookie || '');
  const token = bearer || cookies.user_access_token || '';
  if (!token) return res.status(401).json({ message: 'User token is required.' });

  try {
    const payload = jwt.verify(token, USER_JWT_SECRET);
    if (payload.kind !== 'user' || !payload.id) {
      return res.status(401).json({ message: 'Invalid user token.' });
    }
    req.userAuth = { id: String(payload.id), email: String(payload.email || '').toLowerCase() };
    next();
  } catch {
    return res.status(401).json({ message: 'User session expired. Please login again.' });
  }
};



const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET || 'aimt-admin-secret-2026-change';
const CHECKIN_JWT_SECRET = process.env.CHECKIN_JWT_SECRET || 'aimt-checkin-secret-2026-change';
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'Jontycreation@gmail.com').toLowerCase();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Jonty@790';

const BACKUP_DIR = path.join(__dirname, 'backups');
const ensureBackupDir = () => {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }
};

// --- Permissions Logic ---
const getPermissionsForRole = (role) => {
  const roles = {
    super_admin: ['*'],
    sub_admin: ['events.*', 'projects.*', 'members.read', 'members.write', 'users.read', 'contacts.read', 'notifications.read', 'reports.read', 'content.read', 'content.write'],
    member: ['events.*', 'projects.*'],
    event_manager: ['events.*', 'registrations.*', 'notifications.read'],
    content_manager: ['projects.*', 'content.write', 'content.read'],
    support_admin: ['contacts.*', 'users.read', 'members.read', 'notifications.read'],
  };
  return roles[role] || roles.support_admin;
};

const hasPermission = (admin, permission) => {
  if (!admin || !admin.permissions) return false;
  if (admin.permissions.includes('*')) return true;
  if (admin.permissions.includes(permission)) return true;
  const [category] = permission.split('.');
  if (admin.permissions.includes(`${category}.*`)) return true;
  return false;
};

// --- Audit and Notifications ---
const addAuditLog = (db, req, action, details = {}) => {
  if (!db.auditLogs) db.auditLogs = [];
  db.auditLogs.unshift({
    id: `audit-${Date.now()}`,
    action,
    details,
    adminEmail: req.admin?.email || 'system',
    adminRole: req.admin?.role || 'system',
    ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown',
    createdAt: new Date().toISOString(),
  });
  if (db.auditLogs.length > 500) db.auditLogs = db.auditLogs.slice(0, 500);
};

const addNotification = (db, { type, title, message, priority = 'normal' }) => {
  if (!db.notifications) db.notifications = [];
  db.notifications.unshift({
    id: `notif-${Date.now()}`,
    type,
    title,
    message,
    priority,
    read: false,
    createdAt: new Date().toISOString(),
  });
  if (db.notifications.length > 200) db.notifications = db.notifications.slice(0, 200);
};

// --- Export Helpers ---
const toCSV = (rows, headers) => {
  if (!Array.isArray(rows) || rows.length === 0) return headers.join(',');
  const lines = [headers.join(',')];
  for (const row of rows) {
    const values = headers.map(header => {
      const val = row[header] === null || row[header] === undefined ? '' : String(row[header]);
      return `"${val.replace(/"/g, '""')}"`;
    });
    lines.push(values.join(','));
  }
  return lines.join('\n');
};



// --- Auth Routes (Using db.json) ---
const VERIFICATION_TTL_MS = 15 * 60 * 1000;

app.post('/api/auth/register', authLimiter, async (req, res) => {
  const { name, email, collegeId, password } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ message: 'Name, email, and password are required.' });
  }

  const emailLower = email.toLowerCase();
  
  if (!emailLower.endsWith('@accurate.in') && !emailLower.endsWith('@gmail.com')) {
    return res.status(400).json({ message: "Registration requires an @accurate.in or @gmail.com email." });
  }

  const passwordPolicy = validatePasswordPolicy(password, emailLower);
  if (!passwordPolicy.ok) {
    return res.status(400).json({ message: passwordPolicy.message });
  }

  const db = await getDb();
  if (!db.users) db.users = [];

  const existingUser = db.users.find(u => u.email === emailLower);
  const verificationCode = generateVerificationCode();
  const verificationExpiresAt = new Date(Date.now() + VERIFICATION_TTL_MS).toISOString();
  
  let passwordHash;
  try {
     passwordHash = await bcrypt.hash(password, 10);
  } catch(e) {
     return res.status(500).json({ message: "Error hashing password." });
  }

  if (existingUser) {
    if (existingUser.isVerified) {
      return res.status(400).json({ message: "An account with this email already exists." });
    }
    // Update existing unverified user
    existingUser.name = name;
    existingUser.collegeId = collegeId || null;
    existingUser.passwordHash = passwordHash;
    existingUser.verificationCode = verificationCode;
    existingUser.verificationExpiresAt = verificationExpiresAt;
    await writeDb(db);
    try {
      if (emailTransporter) {
        await sendVerificationEmail({ email: existingUser.email, name: existingUser.name, code: verificationCode });
      } else {
        console.warn('SMTP NOT CONFIGURED: Verification code for', existingUser.email, 'is', verificationCode);
      }
    } catch (emailErr) {
      console.error('Failed to send verification email:', emailErr);
    }

  const responseObj = { 
    message: "Account exists but not verified. A new verification code has been sent.", 
    email: existingUser.email
  };
  res.status(200).json(responseObj);
  await writeDb(db);
  return;
  }

  const newUser = {
    id: crypto.randomUUID(),
    name,
    email: emailLower,
    collegeId: collegeId || null,
    passwordHash,
    verificationCode,
    verificationExpiresAt,
    isVerified: false,
    joinedAt: new Date().toISOString(),
    status: 'active'
  };

  db.users.push(newUser);

  try {
    if (emailTransporter) {
      await sendVerificationEmail({ email: newUser.email, name: newUser.name, code: verificationCode });
    } else {
      console.warn('SMTP NOT CONFIGURED: Verification code for', newUser.email, 'is', verificationCode);
    }
  } catch (emailErr) {
    console.error('Failed to send verification email:', emailErr);
  }

  res.status(201).json({ 
    message: "Registration successful. Please check your email to verify your account.", 
    email: newUser.email
  });
  await writeDb(db);
});

app.post('/api/auth/login', authLimiter, async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required.' });
  }

  const emailLower = email.toLowerCase();
  const db = await getDb();
  const user = db.users?.find(u => u.email === emailLower);

  if (!user) {
    return res.status(400).json({ message: "Invalid credentials." });
  }

  const isMatch = await bcrypt.compare(password, user.passwordHash);
  if (!isMatch) {
    return res.status(400).json({ message: "Invalid credentials." });
  }

  if (!user.isVerified) {
    return res.status(403).json({ requiresVerification: true, email: user.email, message: "Email not verified." });
  }

  if (user.status === 'suspended' || user.status === 'banned') {
    return res.status(403).json({ message: `Your account has been ${user.status}. Contact support.` });
  }

  const LOGIN_OTP_TTL_MS = 10 * 60 * 1000;
  user.loginOtp = generateVerificationCode();
  user.loginOtpExpiresAt = new Date(Date.now() + LOGIN_OTP_TTL_MS).toISOString();
  user.lastLoginAt = new Date().toISOString();

  try {
    if (emailTransporter) {
      await sendLoginOtpEmail({ email: user.email, name: user.name, code: user.loginOtp });
    } else {
      console.warn('SMTP NOT CONFIGURED: Login OTP for', user.email, 'is', user.loginOtp);
    }
  } catch (emailErr) {
    console.error('Failed to send login OTP email:', emailErr);
  }

  await writeDb(db);

  return res.status(200).json({
    requiresLoginOtp: true,
    email: user.email,
    message: "Login credentials valid. A 6-digit OTP has been sent to your email."
  });
});

app.post('/api/auth/login/verify-otp', async (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) return res.status(400).json({ message: 'Email and OTP are required.' });

  const db = await getDb();
  const user = db.users?.find(u => u.email === email.toLowerCase());

  if (!user) return res.status(404).json({ message: 'No account found for this email.' });
  if (!user.isVerified) return res.status(403).json({ requiresVerification: true, email: user.email, message: "Email not verified." });

  if (!user.loginOtp || String(user.loginOtp) !== String(otp).trim()) {
    return res.status(400).json({ message: 'Invalid Login OTP.' });
  }

  if (!user.loginOtpExpiresAt || new Date(user.loginOtpExpiresAt).getTime() < Date.now()) {
    return res.status(400).json({ message: 'Login OTP expired. Please request a new one.' });
  }

  // Clear OTP after success
  delete user.loginOtp;
  delete user.loginOtpExpiresAt;
  
  const token = signUserAccessToken(user);
  const refreshToken = signRefreshToken({ kind: 'user', sub: String(user.id), email: user.email });
  user.refreshTokens = Array.isArray(user.refreshTokens) ? user.refreshTokens : [];
  user.refreshTokens.unshift(refreshToken);
  user.refreshTokens = user.refreshTokens.slice(0, 8);
  setRefreshCookie(res, refreshToken);

  res.json({
    message: 'Login successful!',
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      collegeId: user.collegeId,
      profilePhoto: user.profilePhoto,
      status: user.status
    }
  });

  await writeDb(db);
});

app.post('/api/auth/login/resend-otp', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: 'Email is required.' });

  const db = await getDb();
  const user = db.users?.find(u => u.email === email.toLowerCase());

  if (!user) return res.status(404).json({ message: 'No account found for this email.' });
  if (!user.isVerified) return res.status(403).json({ requiresVerification: true, email: user.email, message: "Email not verified." });

  const LOGIN_OTP_TTL_MS = 10 * 60 * 1000;
  user.loginOtp = generateVerificationCode();
  user.loginOtpExpiresAt = new Date(Date.now() + LOGIN_OTP_TTL_MS).toISOString();

  try {
    if (emailTransporter) {
      await sendLoginOtpEmail({ email: user.email, name: user.name, code: user.loginOtp });
    } else {
      console.warn('SMTP NOT CONFIGURED: Resent Login OTP for', user.email, 'is', user.loginOtp);
    }
  } catch (error) {
    return res.status(500).json({ message: 'Unable to send login OTP right now.', error: error.message });
  }

  res.json({ message: 'A new login OTP has been sent to your email.' });
  await writeDb(db);
});

app.post('/api/auth/password-strength', async (req, res) => {
  const { password, email } = req.body || {};
  const strength = getPasswordStrength(password, email);
  return res.json({
    level: strength.level,
    score: strength.score,
    breached: strength.breached,
    checks: strength.checks,
  });
});

app.post('/api/auth/refresh', async (req, res) => {
  const cookies = parseCookies(req.headers.cookie || '');
  const refreshToken = cookies[REFRESH_COOKIE_NAME] || '';
  if (!refreshToken) return res.status(401).json({ message: 'Refresh token missing.' });

  let payload;
  try {
    payload = jwt.verify(refreshToken, REFRESH_JWT_SECRET);
  } catch {
    clearRefreshCookie(res);
    return res.status(401).json({ message: 'Invalid refresh token.' });
  }

  if (payload.kind !== 'user') {
    clearRefreshCookie(res);
    return res.status(401).json({ message: 'Invalid refresh token type.' });
  }

  const db = await getDb();
  const user = db.users.find(u => String(u.id) === String(payload.sub));
  if (!user) {
    clearRefreshCookie(res);
    return res.status(401).json({ message: 'User not found.' });
  }

  const currentTokens = Array.isArray(user.refreshTokens) ? user.refreshTokens : [];
  if (!currentTokens.includes(refreshToken)) {
    clearRefreshCookie(res);
    return res.status(401).json({ message: 'Refresh token revoked.' });
  }

  user.refreshTokens = currentTokens.filter(t => t !== refreshToken);
  const nextRefresh = signRefreshToken({ kind: 'user', sub: String(user.id), email: user.email });
  user.refreshTokens.unshift(nextRefresh);
  user.refreshTokens = user.refreshTokens.slice(0, 8);
  await writeDb(db);
  setRefreshCookie(res, nextRefresh);

  return res.json({
    token: signUserAccessToken(user),
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      collegeId: user.collegeId,
      profilePhoto: user.profilePhoto,
      status: user.status,
      profileSlug: getUserProfileSlug(user),
    },
  });
});

app.post('/api/auth/logout', async (req, res) => {
  const cookies = parseCookies(req.headers.cookie || '');
  const refreshToken = cookies[REFRESH_COOKIE_NAME] || '';
  clearRefreshCookie(res);
  if (!refreshToken) return res.json({ message: 'Logged out.' });

  try {
    const payload = jwt.verify(refreshToken, REFRESH_JWT_SECRET);
    if (payload.kind === 'user') {
      const db = await getDb();
      const user = db.users.find(u => String(u.id) === String(payload.sub));
      if (user) {
        user.refreshTokens = (Array.isArray(user.refreshTokens) ? user.refreshTokens : []).filter(t => t !== refreshToken);
        await writeDb(db);
      }
    }
  } catch {
    // ignore invalid token on logout
  }

  return res.json({ message: 'Logged out.' });
});

app.post('/api/auth/verify-email', async (req, res) => {
  const { email, code } = req.body;
  if (!email || !code) return res.status(400).json({ message: 'Email and verification code are required.' });

  const db = await getDb();
  const user = db.users?.find(u => u.email === email.toLowerCase());
  
  if (!user) return res.status(404).json({ message: 'No account found for this email.' });
  if (user.isVerified) return res.json({ message: 'Email is already verified.' });

  if (!user.verificationCode || String(user.verificationCode) !== String(code).trim()) {
    return res.status(400).json({ message: 'Invalid verification code.' });
  }

  if (!user.verificationExpiresAt || new Date(user.verificationExpiresAt).getTime() < Date.now()) {
    return res.status(400).json({ message: 'Verification code expired. Please request a new code.' });
  }

  user.isVerified = true;
  user.lastLoginAt = new Date().toISOString();
  delete user.verificationCode;
  delete user.verificationExpiresAt;
  
  const token = signUserAccessToken(user);
  const refreshToken = signRefreshToken({ kind: 'user', sub: String(user.id), email: user.email });
  user.refreshTokens = Array.isArray(user.refreshTokens) ? user.refreshTokens : [];
  user.refreshTokens.unshift(refreshToken);
  user.refreshTokens = user.refreshTokens.slice(0, 8);
  setRefreshCookie(res, refreshToken);

  res.json({ 
    message: 'Email verified successfully. Redirecting to dashboard...',
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      collegeId: user.collegeId,
      profilePhoto: user.profilePhoto,
      status: user.status
    }
  });
  await writeDb(db);
});

app.post('/api/auth/resend-verification', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: 'Email is required.' });

  const db = await getDb();
  const user = db.users?.find(u => u.email === email.toLowerCase());

  if (!user) return res.status(404).json({ message: 'No account found for this email.' });
  if (user.isVerified) return res.status(400).json({ message: 'Email is already verified. You can log in.' });

  user.verificationExpiresAt = new Date(Date.now() + VERIFICATION_TTL_MS).toISOString();

  try {
    if (emailTransporter) {
      await sendVerificationEmail({ email: user.email, name: user.name, code: user.verificationCode });
    } else {
      console.warn('SMTP NOT CONFIGURED: Verification code for', user.email, 'is', user.verificationCode);
    }
  } catch (error) {
    return res.status(500).json({ message: 'Unable to send verification email right now.', error: error.message });
  }

  res.json({ 
    message: 'A new verification code has been sent to your email.'
  });
  await writeDb(db);
});

const RESET_TTL_MS = 15 * 60 * 1000;
app.post('/api/auth/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: 'Email is required.' });

  const db = await getDb();
  const user = db.users?.find(u => u.email === email.toLowerCase());
  if (!user) return res.status(404).json({ message: 'No account found for this email.' });

  user.resetCode = generateVerificationCode();
  user.resetExpiresAt = new Date(Date.now() + RESET_TTL_MS).toISOString();
  await writeDb(db);

  try {
    if (emailTransporter) {
      await sendResetPasswordEmail({ email: user.email, name: user.name, code: user.resetCode });
    } else {
      console.warn('SMTP NOT CONFIGURED: Reset code for', user.email, 'is', user.resetCode);
    }
  } catch (error) {
    return res.status(500).json({ message: 'Failed to process forgot password request.', error: error.message });
  }

  res.json({ message: 'Password reset link sent to your email.' });
  await writeDb(db);
});

app.post('/api/auth/reset-password', async (req, res) => {
  const { email, code, newPassword } = req.body;
  if (!email || !code || !newPassword) return res.status(400).json({ message: 'Email, code and new password are required.' });

  const passwordPolicy = validatePasswordPolicy(newPassword, email);
  if (!passwordPolicy.ok) {
    return res.status(400).json({ message: passwordPolicy.message });
  }

  const db = await getDb();
  const user = db.users?.find(u => u.email === email.toLowerCase());
  
  if (!user) return res.status(404).json({ message: 'No account found for this email.' });

  if (!user.resetCode || String(user.resetCode) !== String(code).trim()) {
    return res.status(400).json({ message: 'Invalid reset code.' });
  }

  if (!user.resetExpiresAt || new Date(user.resetExpiresAt).getTime() < Date.now()) {
    return res.status(400).json({ message: 'Reset code expired. Request a new one.' });
  }

  user.passwordHash = await bcrypt.hash(newPassword, 10);
  delete user.resetCode;
  delete user.resetExpiresAt;
  user.status = 'active';
  
  res.json({ message: 'Password has been reset successfully. You can now log in.' });
  await writeDb(db);
});

// Fallback root route
app.get('/', async (req, res) => {
  res.send('The Developers\' Guild API (JSON Mode) is running.');
});

// Health check endpoint
app.get('/api/health', async (req, res) => {
  res.json({ status: 'OK', service: "The Developers' Guild API", timestamp: new Date().toISOString() });
});

app.get('/api/content-settings', async (req, res) => {
  const db = await getDb();
  const settings = db.contentSettings || {};
  return res.json({
    announcement: settings.announcement || '',
    heroBadge: settings.heroBadge || '',
    aboutTitle: settings.aboutTitle || "About The Developers' Guild",
    aboutIntro: settings.aboutIntro || 'We are the official coding club of Accurate Institute of Management and Technology (AIMT), Greater Noida. Founded to bridge the gap between classroom learning and industry-ready skills.',
    aboutMission: settings.aboutMission || 'To create a thriving ecosystem where students at AIMT can learn cutting-edge technologies, collaborate on meaningful projects, participate in competitive programming, and develop the skills needed to excel in the technology industry.',
    showSkillAnalyzer: settings.showSkillAnalyzer !== false,
  });
});

app.get('/api/members', async (req, res) => {
  const db = await getDb();
  const members = (db.memberDirectory || [])
    .filter((m) => m.isActive !== false)
    .map((m) => ({
      id: m.id,
      name: m.name,
      email: m.email,
      designation: m.designation,
      createdAt: m.createdAt || null,
      updatedAt: m.updatedAt || null,
    }))
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

  return res.json(members);
});

// Server listen will be at the bottom of the file

const getEventRegistrationCounts = (db, eventId) => {
  const eventRegs = db.registrations.filter(r => Number(r.eventId) === Number(eventId));
  const confirmedCount = eventRegs.filter(r => r.status === 'confirmed').length;
  const waitlistCount = eventRegs.filter(r => r.status === 'waitlisted').length;
  return { confirmedCount, waitlistCount };
};

const isEventOpen = (event) => {
  const deadline = new Date(event.registrationDeadline || event.date).getTime();
  return Number.isFinite(deadline) ? Date.now() <= deadline : true;
};

const decorateEvent = (db, event) => {
  const { confirmedCount, waitlistCount } = getEventRegistrationCounts(db, event.id);
  const capacity = Number(event.capacity ?? 60);
  const isFull = confirmedCount >= capacity;
  const availableSeats = Math.max(0, capacity - confirmedCount);
  const open = isEventOpen(event);

  return {
    ...event,
    capacity,
    confirmedCount,
    waitlistCount,
    isFull,
    isOpen: open,
    availableSeats,
  };
};

// ─── Email Helpers (SMTP Verification) ───────────────────────────────────────
const nodemailer = require('nodemailer');
const smtpHost = process.env.SMTP_HOST;
const smtpPort = Number(process.env.SMTP_PORT || 587);
const smtpUser = process.env.SMTP_USER;
const smtpPass = process.env.SMTP_PASS;
const smtpFrom = process.env.SMTP_FROM || smtpUser;
const smtpSecure = process.env.SMTP_SECURE === 'true';
const contactInbox = process.env.CONTACT_TO_EMAIL || smtpUser;

const smtpConfigured = Boolean(smtpHost && smtpUser && smtpPass && smtpFrom);
const emailTransporter = smtpConfigured
  ? nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpSecure,
      auth: { user: smtpUser, pass: smtpPass },
    })
  : null;

const generateVerificationCode = () => String(Math.floor(100000 + Math.random() * 900000));
const signAdminToken = ({ email, role, permissions, name }) => signAdminAccessToken({
  email,
  role,
  permissions,
  name,
});
const signCheckinToken = ({ eventId, userId }) => jwt.sign({ role: 'checkin', eventId, userId }, CHECKIN_JWT_SECRET, { expiresIn: '2h' });

const slugify = (value) => String(value || '')
  .toLowerCase()
  .replace(/[^a-z0-9\s-]/g, '')
  .trim()
  .replace(/\s+/g, '-')
  .replace(/-+/g, '-');

const getUserProfileSlug = (user) => {
  if (!user) return '';
  const explicit = String(user.profileSlug || '').trim().toLowerCase();
  if (explicit) return explicit;
  const base = slugify(user.name || 'student') || 'student';
  const suffix = String(user.id || '').replace(/[^a-z0-9]/gi, '').slice(-6).toLowerCase();
  return suffix ? `${base}-${suffix}` : base;
};

const toPublicProfile = (user) => {
  const visibility = {
    bio: true,
    skills: true,
    socials: true,
    projects: true,
    ...(typeof user.profileVisibility === 'object' && user.profileVisibility ? user.profileVisibility : {}),
  };

  return {
    id: user.id,
    name: user.name,
    collegeId: user.collegeId || '',
    profilePhoto: user.profilePhoto || null,
    joinedAt: user.joinedAt || null,
    profileSlug: getUserProfileSlug(user),
    profileTheme: user.profileTheme || 'default',
    profileBannerUrl: user.profileBannerUrl || '',
    visibility,
    bio: visibility.bio ? (user.bio || '') : '',
    skills: visibility.skills ? (Array.isArray(user.skills) ? user.skills : []) : [],
    githubUrl: visibility.socials ? (user.githubUrl || '') : '',
    linkedinUrl: visibility.socials ? (user.linkedinUrl || '') : '',
    portfolioUrl: visibility.socials ? (user.portfolioUrl || '') : '',
    studentProjects: visibility.projects ? (Array.isArray(user.studentProjects) ? user.studentProjects : []) : [],
  };
};

const escapeIcsText = (value) => String(value || '')
  .replace(/\\/g, '\\\\')
  .replace(/;/g, '\\;')
  .replace(/,/g, '\\,')
  .replace(/\r?\n/g, '\\n');

const getIcsDateTime = (dateStr, timeStr, fallbackHour = 10, fallbackMinute = 0) => {
  const datePart = String(dateStr || '').trim();
  if (!datePart) return null;
  const parsed = new Date(`${datePart}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;

  let hours = fallbackHour;
  let minutes = fallbackMinute;
  const tm = String(timeStr || '').trim();
  const m = tm.match(/(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?/i);
  if (m) {
    hours = Number(m[1]);
    minutes = Number(m[2] || 0);
    const meridian = String(m[3] || '').toUpperCase();
    if (meridian === 'PM' && hours < 12) hours += 12;
    if (meridian === 'AM' && hours === 12) hours = 0;
  }

  const dt = new Date(parsed.getTime());
  dt.setHours(hours, minutes, 0, 0);
  return dt;
};

const formatUtcStamp = (d) => {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  const h = String(d.getUTCHours()).padStart(2, '0');
  const min = String(d.getUTCMinutes()).padStart(2, '0');
  const s = String(d.getUTCSeconds()).padStart(2, '0');
  return `${y}${m}${day}T${h}${min}${s}Z`;
};

const generateCertificatePdfBuffer = ({ participantName, eventName, eventDate, attendedAt }) => new Promise((resolve, reject) => {
  const doc = new PDFDocument({ size: 'A4', margin: 48 });
  const chunks = [];
  doc.on('data', (chunk) => chunks.push(chunk));
  doc.on('end', () => resolve(Buffer.concat(chunks)));
  doc.on('error', reject);

  doc.rect(24, 24, 547, 795).lineWidth(2).strokeColor('#1d4ed8').stroke();
  doc.fontSize(14).fillColor('#334155').text("The Developers' Guild", { align: 'center' });
  doc.moveDown(1.2);
  doc.fontSize(34).fillColor('#0f172a').text('Certificate of Participation', { align: 'center' });
  doc.moveDown(1.8);
  doc.fontSize(14).fillColor('#334155').text('This certifies that', { align: 'center' });
  doc.moveDown(0.6);
  doc.fontSize(26).fillColor('#1e40af').text(participantName, { align: 'center' });
  doc.moveDown(0.8);
  doc.fontSize(13).fillColor('#334155').text(`has successfully participated in ${eventName}`, { align: 'center' });
  doc.moveDown(0.5);
  doc.fontSize(12).fillColor('#475569').text(`Event Date: ${eventDate}`, { align: 'center' });
  doc.text(`Attendance Marked: ${new Date(attendedAt).toLocaleString('en-IN')}`, { align: 'center' });
  doc.moveDown(3);
  doc.fontSize(11).fillColor('#64748b').text(`Issued on ${new Date().toLocaleDateString('en-IN')}`, 60, 670);
  doc.text('Authorized Signature', 420, 670, { width: 120, align: 'center' });
  doc.moveTo(420, 665).lineTo(540, 665).strokeColor('#64748b').stroke();
  doc.end();
});

const toPublicUser = (user) => {
  const {
    verificationCode,
    verificationExpiresAt,
    loginOtp,
    loginOtpExpiresAt,
    passwordHash,
    resetCode,
    resetExpiresAt,
    ...rest
  } = user;
  return {
    ...rest,
    studentProjects: Array.isArray(rest.studentProjects) ? rest.studentProjects : [],
    profileSlug: getUserProfileSlug(user),
  };
};

const toPublicManagedAccount = (account) => {
  if (!account) return null;
  const role = account.role || 'support_admin';
  return {
    id: account.id,
    name: account.name,
    email: account.email,
    role,
    permissions: Array.isArray(account.permissions) ? account.permissions : getPermissionsForRole(role),
    isVerified: account.isVerified !== false,
    isActive: account.isActive !== false,
  };
};

const getManagedAdminAccount = (db, emailLower) => {
  const normalized = String(emailLower || '').trim().toLowerCase();
  const adminUsers = Array.isArray(db.adminUsers) ? db.adminUsers : [];
  const memberDirectory = Array.isArray(db.memberDirectory) ? db.memberDirectory : [];

  const adminIndex = adminUsers.findIndex(a => String(a.email || '').toLowerCase() === normalized);
  if (adminIndex >= 0) {
    return { source: 'adminUsers', index: adminIndex, account: adminUsers[adminIndex] };
  }

  const memberIndex = memberDirectory.findIndex(m => String(m.email || '').toLowerCase() === normalized);
  if (memberIndex >= 0) {
    const member = memberDirectory[memberIndex];
    return {
      source: 'memberDirectory',
      index: memberIndex,
      account: {
        ...member,
        role: 'member',
      },
    };
  }

  return null;
};

const updateManagedAdminAccount = (db, located, nextAccount) => {
  if (!located) return;
  if (located.source === 'adminUsers') {
    if (!Array.isArray(db.adminUsers)) db.adminUsers = [];
    db.adminUsers[located.index] = nextAccount;
    return;
  }
  if (!Array.isArray(db.memberDirectory)) db.memberDirectory = [];
  db.memberDirectory[located.index] = {
    ...nextAccount,
    role: undefined,
  };
  delete db.memberDirectory[located.index].role;
};

const issueManagedAccountOtp = async (db, accountLocated, accountName, accountEmail) => {
  const account = { ...accountLocated.account };
  account.loginOtp = generateVerificationCode();
  account.loginOtpExpiresAt = new Date(Date.now() + (10 * 60 * 1000)).toISOString();
  account.updatedAt = new Date().toISOString();
  updateManagedAdminAccount(db, accountLocated, account);

  try {
    if (emailTransporter) {
      await sendLoginOtpEmail({ email: accountEmail, name: accountName, code: account.loginOtp });
    } else {
      console.warn('SMTP NOT CONFIGURED: Admin/member login OTP for', accountEmail, 'is', account.loginOtp);
    }
  } catch (emailErr) {
    throw new Error(emailErr?.message || 'Failed to send OTP email.');
  }
};

const sendVerificationEmail = async ({ email, name, code }) => {
  if (!emailTransporter) {
    throw new Error('SMTP is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS and SMTP_FROM in backend .env.');
  }

  await emailTransporter.sendMail({
    from: smtpFrom,
    to: email,
    subject: "Verify your email - The Developers' Guild",
    text: `Hi ${name},\n\nYour verification code is: ${code}\nThis code expires in 15 minutes.\n\n- The Developers' Guild`,
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827;max-width:520px;margin:auto;">
        <h2 style="margin-bottom:8px;">The Developers' Guild</h2>
        <p>Hi ${name},</p>
        <p>Use this code to verify your email address:</p>
        <div style="font-size:30px;font-weight:700;letter-spacing:5px;padding:12px 16px;background:#f3f4f6;border-radius:10px;display:inline-block;">
          ${code}
        </div>
        <p style="margin-top:16px;">This code expires in <strong>15 minutes</strong>.</p>
        <p style="margin-top:20px;color:#6b7280;font-size:13px;">If you did not request this, you can ignore this email.</p>
      </div>
    `,
  });
};

const sendLoginOtpEmail = async ({ email, name, code }) => {
  if (!emailTransporter) {
    throw new Error('SMTP is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS and SMTP_FROM in backend .env.');
  }

  await emailTransporter.sendMail({
    from: smtpFrom,
    to: email,
    subject: "Your login OTP - The Developers' Guild",
    text: `Hi ${name},\n\nYour login OTP is: ${code}\nThis OTP expires in 10 minutes.\n\n- The Developers' Guild`,
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827;max-width:520px;margin:auto;">
        <h2 style="margin-bottom:8px;">The Developers' Guild</h2>
        <p>Hi ${name},</p>
        <p>Use this OTP to complete your login:</p>
        <div style="font-size:30px;font-weight:700;letter-spacing:5px;padding:12px 16px;background:#eef2ff;border-radius:10px;display:inline-block;">
          ${code}
        </div>
        <p style="margin-top:16px;">This OTP expires in <strong>10 minutes</strong>.</p>
        <p style="margin-top:20px;color:#6b7280;font-size:13px;">If you did not request this login, ignore this email.</p>
      </div>
    `,
  });
};

const sendResetPasswordEmail = async ({ email, name, code }) => {
  if (!emailTransporter) {
    throw new Error('SMTP is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS and SMTP_FROM in backend .env.');
  }

  await emailTransporter.sendMail({
    from: smtpFrom,
    to: email,
    subject: "Reset password code - The Developers' Guild",
    text: `Hi ${name},\n\nYour password reset code is: ${code}\nThis code expires in 15 minutes.\n\n- The Developers' Guild`,
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827;max-width:520px;margin:auto;">
        <h2 style="margin-bottom:8px;">The Developers' Guild</h2>
        <p>Hi ${name},</p>
        <p>Use this code to reset your password:</p>
        <div style="font-size:30px;font-weight:700;letter-spacing:5px;padding:12px 16px;background:#ecfeff;border-radius:10px;display:inline-block;">
          ${code}
        </div>
        <p style="margin-top:16px;">This code expires in <strong>15 minutes</strong>.</p>
      </div>
    `,
  });
};

const sendEventRegistrationEmail = async ({ email, name, eventName, eventDate, eventTime, status }) => {
  if (!emailTransporter) {
    throw new Error('SMTP is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS and SMTP_FROM in backend .env.');
  }

  const statusLine = status === 'waitlisted'
    ? 'You are currently on the waitlist for this event.'
    : 'Your seat has been confirmed for this event.';

  await emailTransporter.sendMail({
    from: smtpFrom,
    to: email,
    subject: `Event registration successful - ${eventName}`,
    text: `Hi ${name},\n\nYour registration for "${eventName}" is successful.\nDate: ${eventDate}\nTime: ${eventTime}\nStatus: ${status}\n\n${statusLine}\n\n- The Developers' Guild`,
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827;max-width:560px;margin:auto;">
        <h2 style="margin-bottom:8px;">Registration Confirmed</h2>
        <p>Hi ${name},</p>
        <p>Your registration for <strong>${eventName}</strong> is successful.</p>
        <p><strong>Date:</strong> ${eventDate}<br/><strong>Time:</strong> ${eventTime}<br/><strong>Status:</strong> ${status}</p>
        <p>${statusLine}</p>
      </div>
    `,
  });
};

const sendCancellationOtpEmail = async ({ email, name, eventName, code }) => {
  if (!emailTransporter) {
    throw new Error('SMTP is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS and SMTP_FROM in backend .env.');
  }

  await emailTransporter.sendMail({
    from: smtpFrom,
    to: email,
    subject: `Cancellation OTP - ${eventName}`,
    text: `Hi ${name},\n\nUse this OTP to cancel your registration for "${eventName}": ${code}\nThis OTP expires in 10 minutes.\n\n- The Developers' Guild`,
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827;max-width:560px;margin:auto;">
        <h2 style="margin-bottom:8px;">Cancellation Verification OTP</h2>
        <p>Hi ${name},</p>
        <p>Use this OTP to cancel your registration for <strong>${eventName}</strong>:</p>
        <div style="font-size:30px;font-weight:700;letter-spacing:5px;padding:12px 16px;background:#fee2e2;border-radius:10px;display:inline-block;">
          ${code}
        </div>
        <p style="margin-top:12px;">This OTP expires in <strong>10 minutes</strong>.</p>
      </div>
    `,
  });
};

const sendTeamInviteEmail = async ({ email, inviteeName, inviterName, eventName, acceptUrl, rejectUrl }) => {
  if (!emailTransporter) {
    throw new Error('SMTP is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS and SMTP_FROM in backend .env.');
  }

  await emailTransporter.sendMail({
    from: smtpFrom,
    to: email,
    subject: `Team invite for ${eventName}`,
    text: `Hi ${inviteeName || 'there'},\n\n${inviterName} invited you to join their team for "${eventName}".\n\nAccept: ${acceptUrl}\nReject: ${rejectUrl}\n\n- The Developers' Guild`,
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827;max-width:560px;margin:auto;">
        <h2 style="margin-bottom:8px;">Event Team Invite</h2>
        <p>Hi ${inviteeName || 'there'},</p>
        <p><strong>${inviterName}</strong> invited you to join their team for <strong>${eventName}</strong>.</p>
        <p>
          <a href="${acceptUrl}" style="display:inline-block;padding:10px 16px;background:#16a34a;color:white;text-decoration:none;border-radius:8px;margin-right:8px;">Accept Invite</a>
          <a href="${rejectUrl}" style="display:inline-block;padding:10px 16px;background:#dc2626;color:white;text-decoration:none;border-radius:8px;">Reject Invite</a>
        </p>
      </div>
    `,
  });
};

const sendContactEmail = async ({ name, email, message }) => {
  if (!emailTransporter) {
    throw new Error('SMTP is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS and SMTP_FROM in backend .env.');
  }

  if (!contactInbox) {
    throw new Error('Contact inbox is not configured. Set CONTACT_TO_EMAIL or SMTP_USER in backend .env.');
  }

  const safeName = String(name).trim();
  const safeEmail = String(email).trim().toLowerCase();
  const safeMessage = String(message).trim();

  await emailTransporter.sendMail({
    from: smtpFrom,
    to: contactInbox,
    replyTo: safeEmail,
    subject: `New Contact Message from ${safeName}`,
    text: [
      'New message from contact form',
      '',
      `Name: ${safeName}`,
      `Email: ${safeEmail}`,
      '',
      'Message:',
      safeMessage,
    ].join('\n'),
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827;max-width:640px;margin:auto;">
        <h2 style="margin-bottom:8px;">New Contact Message</h2>
        <p><strong>Name:</strong> ${safeName}</p>
        <p><strong>Email:</strong> ${safeEmail}</p>
        <p style="margin-bottom:6px;"><strong>Message:</strong></p>
        <div style="white-space:pre-wrap;padding:12px 14px;border:1px solid #e5e7eb;border-radius:10px;background:#f9fafb;">${safeMessage}</div>
      </div>
    `,
  });
};

const promoteWaitlistForEvent = (db, eventId) => {
  const event = db.events.find(e => Number(e.id) === Number(eventId));
  if (!event) return [];

  const capacity = Number(event.capacity ?? 60);
  const eventRegs = db.registrations
    .filter(r => Number(r.eventId) === Number(eventId))
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  let confirmedCount = eventRegs.filter(r => r.status === 'confirmed').length;
  const promoted = [];

  for (const reg of eventRegs) {
    if (confirmedCount >= capacity) break;
    if (reg.status === 'waitlisted') {
      reg.status = 'confirmed';
      reg.promotedAt = new Date().toISOString();
      confirmedCount += 1;
      promoted.push(reg);
    }
  }

  return promoted;
};

const requireAdminAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

  if (!token) {
    return res.status(401).json({ message: 'Admin token is required.' });
  }

  try {
    const payload = jwt.verify(token, ADMIN_JWT_SECRET);
    if (payload.kind !== 'admin' || !payload.email) {
      return res.status(403).json({ message: 'Invalid admin token.' });
    }
    const resolvedRole = payload.role || 'support_admin';
    const resolvedEmail = String(payload.email).toLowerCase();

    const db = await getDb();
    const isEnvSuperAdmin = resolvedRole === 'super_admin' && resolvedEmail === ADMIN_EMAIL;

    if (!isEnvSuperAdmin) {
      const located = getManagedAdminAccount(db, resolvedEmail);
      if (!located || !located.account) {
        return res.status(401).json({ message: 'Admin account was removed. Please login again.' });
      }

      if (located.account.isActive === false) {
        return res.status(401).json({ message: 'Admin account is inactive. Please contact super admin.' });
      }
    }

    req.admin = {
      email: String(payload.email).toLowerCase(),
      role: resolvedRole,
      permissions: Array.isArray(payload.permissions) ? payload.permissions : getPermissionsForRole(resolvedRole),
      name: payload.name || 'Admin',
    };
    next();
  } catch {
    return res.status(401).json({ message: 'Admin session expired or invalid. Please login again.' });
  }
};

const requireAdminPermission = (permission) => (req, res, next) => {
  if (!hasPermission(req.admin, permission)) {
    return res.status(403).json({ message: 'You do not have permission to perform this action.' });
  }
  return next();
};

const requireSuperAdmin = (req, res, next) => {
  if (req.admin?.role !== 'super_admin') {
    return res.status(403).json({ message: 'Only highest authority admin can perform this action.' });
  }
  return next();
};

const PROTECTED_ADMIN_ROLES = new Set(['super_admin']);
const isProtectedAdminAccount = (adminAccount) => {
  if (!adminAccount) return false;
  if (adminAccount.managedByEnv === true) return true;
  if (String(adminAccount.email || '').toLowerCase() === ADMIN_EMAIL) return true;
  if (PROTECTED_ADMIN_ROLES.has(String(adminAccount.role || ''))) return true;
  return false;
};

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get('/api/health', async (req, res) => {
  res.json({ status: 'OK', service: "The Developers' Guild API", timestamp: new Date().toISOString() });
});


// --- Debug endpoint
app.get('/api/debug/env', (req, res) => {
  res.json({
    ADMIN_EMAIL: ADMIN_EMAIL,
    ADMIN_EMAIL_length: ADMIN_EMAIL.length,
    ADMIN_EMAIL_codes: Array.from(ADMIN_EMAIL).map(c => c.charCodeAt(0)),
    ADMIN_PASSWORD: ADMIN_PASSWORD,
    ADMIN_PASSWORD_length: ADMIN_PASSWORD.length,
    ADMIN_PASSWORD_codes: Array.from(ADMIN_PASSWORD).map(c => c.charCodeAt(0)),
  });
});

// --- Admin Authentication ---

app.post('/api/admin/login', authLimiter, async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required.' });
  }

  const emailLower = String(email).toLowerCase().trim();
  const passwordTrimmed = String(password).trim();
  const db = await getDb();

  // Check against environment admin credentials
  if (emailLower === ADMIN_EMAIL && passwordTrimmed === ADMIN_PASSWORD) {
    const token = signAdminToken({
      email: ADMIN_EMAIL,
      role: 'super_admin',
      permissions: getPermissionsForRole('super_admin'),
      name: 'Primary Admin',
    });
    const refreshToken = signRefreshToken({ kind: 'admin', sub: 'env-primary-admin', email: ADMIN_EMAIL, role: 'super_admin' });
    setRefreshCookie(res, refreshToken);

    return res.json({
      token,
      admin: {
        id: 'env-primary-admin',
        name: 'Primary Admin',
        email: ADMIN_EMAIL,
        role: 'super_admin',
        permissions: getPermissionsForRole('super_admin'),
      },
      message: 'Admin login successful.'
    });
  }

  const locatedAccount = getManagedAdminAccount(db, emailLower);
  if (!locatedAccount || !locatedAccount.account) {
    return res.status(401).json({ message: 'Invalid admin credentials.' });
  }

  const accountRecord = { ...locatedAccount.account };

  if (accountRecord.isActive === false) {
    return res.status(403).json({ message: 'Account is inactive. Contact super admin.' });
  }

  if (!accountRecord.passwordHash) {
    return res.status(401).json({ message: 'Password login is not configured for this account.' });
  }

  // For database admin users/member accounts with bcrypt hash
  if (accountRecord.passwordHash) {
    const valid = await bcrypt.compare(passwordTrimmed, accountRecord.passwordHash);
    if (!valid) {
      return res.status(401).json({ message: 'Invalid admin credentials.' });
    }
  }

  const effectiveRole = accountRecord.role || (locatedAccount.source === 'memberDirectory' ? 'member' : 'sub_admin');

  if (accountRecord.isVerified === false) {
    accountRecord.verificationCode = generateVerificationCode();
    accountRecord.verificationExpiresAt = new Date(Date.now() + VERIFICATION_TTL_MS).toISOString();
    accountRecord.updatedAt = new Date().toISOString();

    try {
      if (emailTransporter) {
        await sendVerificationEmail({ email: accountRecord.email, name: accountRecord.name, code: accountRecord.verificationCode });
      } else {
        console.warn('SMTP NOT CONFIGURED: Verification OTP for', accountRecord.email, 'is', accountRecord.verificationCode);
      }
    } catch (emailErr) {
      return res.status(500).json({ message: emailErr?.message || 'Unable to send verification OTP.' });
    }

    updateManagedAdminAccount(db, locatedAccount, accountRecord);
    await writeDb(db);

    return res.json({
      requiresLoginOtp: true,
      requiresVerificationOtp: true,
      email: accountRecord.email,
      role: effectiveRole,
      message: 'Password verified. Check your email for verification OTP, then complete login.',
    });
  }

  await issueManagedAccountOtp(db, locatedAccount, accountRecord.name, accountRecord.email);
  await writeDb(db);

  return res.json({
    requiresLoginOtp: true,
    requiresVerificationOtp: false,
    email: accountRecord.email,
    role: effectiveRole,
    message: 'Password verified. Check your email for login OTP.',
  });
});

app.post('/api/admin/login/verify-otp', async (req, res) => {
  const { email, otp } = req.body || {};

  if (!email || !otp) {
    return res.status(400).json({ message: 'Email and OTP are required.' });
  }

  const emailLower = String(email).trim().toLowerCase();
  const otpTrimmed = String(otp).trim();
  const db = await getDb();
  const locatedAccount = getManagedAdminAccount(db, emailLower);

  if (!locatedAccount || !locatedAccount.account) {
    return res.status(404).json({ message: 'Admin account not found.' });
  }

  const account = { ...locatedAccount.account };
  if (account.isActive === false) {
    return res.status(403).json({ message: 'Account is inactive. Contact super admin.' });
  }

  if (account.isVerified === false) {
    if (!account.verificationCode || String(account.verificationCode) !== otpTrimmed) {
      return res.status(400).json({ message: 'Invalid verification OTP.' });
    }
    if (!account.verificationExpiresAt || new Date(account.verificationExpiresAt).getTime() < Date.now()) {
      return res.status(400).json({ message: 'Verification OTP expired. Please login again.' });
    }

    account.isVerified = true;
    delete account.verificationCode;
    delete account.verificationExpiresAt;
    delete account.loginOtp;
    delete account.loginOtpExpiresAt;
    account.lastLoginAt = new Date().toISOString();
    account.updatedAt = new Date().toISOString();

    updateManagedAdminAccount(db, locatedAccount, account);
    await writeDb(db);

    const role = account.role || (locatedAccount.source === 'memberDirectory' ? 'member' : 'sub_admin');
    const token = signAdminToken({
      email: account.email,
      role,
      permissions: getPermissionsForRole(role),
      name: account.name,
    });
    const refreshToken = signRefreshToken({ kind: 'admin', sub: String(account.id), email: account.email, role });
    account.refreshTokens = Array.isArray(account.refreshTokens) ? account.refreshTokens : [];
    account.refreshTokens.unshift(refreshToken);
    account.refreshTokens = account.refreshTokens.slice(0, 8);
    updateManagedAdminAccount(db, locatedAccount, account);
    await writeDb(db);
    setRefreshCookie(res, refreshToken);

    return res.json({
      token,
      admin: toPublicManagedAccount(account),
      message: 'Admin login successful.',
    });
  }

  const refreshedLocated = getManagedAdminAccount(db, emailLower);
  const refreshed = { ...refreshedLocated.account };

  if (!refreshed.loginOtp || String(refreshed.loginOtp) !== otpTrimmed) {
    return res.status(400).json({ message: 'Invalid login OTP.' });
  }
  if (!refreshed.loginOtpExpiresAt || new Date(refreshed.loginOtpExpiresAt).getTime() < Date.now()) {
    return res.status(400).json({ message: 'Login OTP expired. Please login again.' });
  }

  delete refreshed.loginOtp;
  delete refreshed.loginOtpExpiresAt;
  refreshed.lastLoginAt = new Date().toISOString();
  refreshed.updatedAt = new Date().toISOString();

  updateManagedAdminAccount(db, refreshedLocated, refreshed);
  await writeDb(db);

  const token = signAdminToken({
    email: refreshed.email,
    role: refreshed.role || (refreshedLocated.source === 'memberDirectory' ? 'member' : 'sub_admin'),
    permissions: getPermissionsForRole(refreshed.role || (refreshedLocated.source === 'memberDirectory' ? 'member' : 'sub_admin')),
    name: refreshed.name,
  });
  const refreshRole = refreshed.role || (refreshedLocated.source === 'memberDirectory' ? 'member' : 'sub_admin');
  const refreshToken = signRefreshToken({ kind: 'admin', sub: String(refreshed.id), email: refreshed.email, role: refreshRole });
  refreshed.refreshTokens = Array.isArray(refreshed.refreshTokens) ? refreshed.refreshTokens : [];
  refreshed.refreshTokens.unshift(refreshToken);
  refreshed.refreshTokens = refreshed.refreshTokens.slice(0, 8);
  updateManagedAdminAccount(db, refreshedLocated, refreshed);
  await writeDb(db);
  setRefreshCookie(res, refreshToken);

  return res.json({
    token,
    admin: toPublicManagedAccount(refreshed),
    message: 'Admin login successful.',
  });
});

app.post('/api/admin/login/resend-otp', async (req, res) => {
  const { email } = req.body || {};
  if (!email) {
    return res.status(400).json({ message: 'Email is required.' });
  }

  const emailLower = String(email).trim().toLowerCase();
  const db = await getDb();
  const locatedAccount = getManagedAdminAccount(db, emailLower);
  if (!locatedAccount || !locatedAccount.account) {
    return res.status(404).json({ message: 'Admin account not found.' });
  }

  const account = { ...locatedAccount.account };
  if (account.isActive === false) {
    return res.status(403).json({ message: 'Account is inactive. Contact super admin.' });
  }

  if (account.isVerified === false) {
    account.verificationCode = generateVerificationCode();
    account.verificationExpiresAt = new Date(Date.now() + VERIFICATION_TTL_MS).toISOString();
    account.updatedAt = new Date().toISOString();

    try {
      if (emailTransporter) {
        await sendVerificationEmail({ email: account.email, name: account.name, code: account.verificationCode });
      } else {
        console.warn('SMTP NOT CONFIGURED: Resent verification OTP for', account.email, 'is', account.verificationCode);
      }
    } catch (emailErr) {
      return res.status(500).json({ message: emailErr?.message || 'Unable to resend verification OTP.' });
    }

    updateManagedAdminAccount(db, locatedAccount, account);
    await writeDb(db);
    return res.json({ message: 'Verification OTP resent to your email.' });
  }

  await issueManagedAccountOtp(db, locatedAccount, account.name, account.email);
  await writeDb(db);
  return res.json({ message: 'Login OTP resent to your email.' });
});

app.post('/api/admin/login-backup', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ message: 'Email and password are required.' });

  const emailLower = String(email).trim().toLowerCase();
  const db = await getDb();
  
  const logMsg = `[ADMIN LOGIN] Email: "${emailLower}" | Password: "${password}" | Expected Email: "${ADMIN_EMAIL}" | Expected Pass: "${ADMIN_PASSWORD}" | Match: ${emailLower === ADMIN_EMAIL.toLowerCase()} / ${String(password).trim() === ADMIN_PASSWORD}`;
  fs.appendFileSync(path.join(__dirname, 'login_debug.log'), logMsg + '\n');
  
  // Check in adminUsers list first, then fallback to .env master admin
  let adminRecord = db.adminUsers?.find(a => String(a.email).toLowerCase() === emailLower);
  
  if (!adminRecord && emailLower === ADMIN_EMAIL.toLowerCase()) {
    adminRecord = {
      id: 'env-primary-admin',
      name: 'Primary Admin',
      email: ADMIN_EMAIL,
      role: 'super_admin',
      managedByEnv: true
    };
  }

  if (!adminRecord) {
    return res.status(401).json({ message: 'Invalid admin credentials.' });
  }

  // If record is in DB, check its specific password if it exists, 
  // otherwise use the master ADMIN_PASSWORD from .env
  const isValidPassword = (String(password).trim() === ADMIN_PASSWORD);
  
  if (!isValidPassword) {
    return res.status(401).json({ message: 'Invalid admin credentials.' });
  }

  const token = jwt.sign({
    kind: 'admin',
    email: adminRecord.email,
    role: adminRecord.role,
    name: adminRecord.name,
  }, ADMIN_JWT_SECRET, { expiresIn: '12h' });

  // Update last active if it was a DB record
  if (db.adminUsers?.some(a => a.id === adminRecord.id)) {
      const idx = db.adminUsers.findIndex(a => a.id === adminRecord.id);
      db.adminUsers[idx].lastLoginAt = new Date().toISOString();
      await writeDb(db);
  }

  return res.json({
    token,
    admin: adminRecord,
    message: 'Admin login successful.'
  });
});

app.get('/api/admin/events', requireAdminAuth, requireAdminPermission('events.read'), async (req, res) => {
  const db = await getDb();
  const events = db.events.map(event => decorateEvent(db, event));
  return res.json(events);
});

app.post('/api/admin/events', requireAdminAuth, requireAdminPermission('events.write'), async (req, res) => {
  const { name, date, time, description, category, location, capacity, registrationDeadline } = req.body || {};
  
  if (!name || !date || !time || !description || !category || !location || !capacity) {
    return res.status(400).json({ message: 'All event fields are required.' });
  }
  
  const db = await getDb();
  const nextId = db.events.length ? Math.max(...db.events.map(e => Number(e.id) || 0)) + 1 : 1;
  const parsedCapacity = Number(capacity);
  if (!Number.isFinite(parsedCapacity) || parsedCapacity < 1) {
    return res.status(400).json({ message: 'Capacity must be a number greater than 0.' });
  }
  
  const newEvent = {
    id: nextId,
    name: String(name).trim(),
    date: String(date).trim(),
    time: String(time).trim(),
    description: String(description).trim(),
    category: String(category).trim(),
    location: String(location).trim(),
    capacity: parsedCapacity,
    registrationDeadline: registrationDeadline ? String(registrationDeadline).trim() : String(date).trim(),
  };
  
  db.events.push(newEvent);
  addAuditLog(db, req, 'event.create', { eventId: newEvent.id, name: newEvent.name });
  addNotification(db, { type: 'event', title: 'Event created', message: `${newEvent.name} was created by ${req.admin.email}.` });
  await writeDb(db);
  return res.status(201).json({ message: 'Event created successfully.', event: decorateEvent(db, newEvent) });
});

app.put('/api/admin/events/:id', requireAdminAuth, requireAdminPermission('events.write'), async (req, res) => {
  const eventId = Number(req.params.id);
  const db = await getDb();
  const event = db.events.find(e => Number(e.id) === eventId);
  
  if (!event) {
    return res.status(404).json({ message: 'Event not found.' });
  }
  
  const allowedFields = ['name', 'date', 'time', 'description', 'category', 'location', 'registrationDeadline'];
  for (const field of allowedFields) {
    if (req.body[field] !== undefined) {
      event[field] = String(req.body[field]).trim();
    }
  }
  
  let capacityChanged = false;
  if (req.body.capacity !== undefined) {
    const parsedCapacity = Number(req.body.capacity);
    if (!Number.isFinite(parsedCapacity) || parsedCapacity < 1) {
      return res.status(400).json({ message: 'Capacity must be a number greater than 0.' });
    }
    capacityChanged = Number(event.capacity) !== parsedCapacity;
    event.capacity = parsedCapacity;
  }
  
  if (capacityChanged) {
    promoteWaitlistForEvent(db, event.id);
  }
  
  addAuditLog(db, req, 'event.update', { eventId: event.id, fields: Object.keys(req.body || {}) });
  await writeDb(db);
  return res.json({ message: 'Event updated successfully.', event: decorateEvent(db, event) });
});

app.delete('/api/admin/events/:id', requireAdminAuth, requireAdminPermission('events.write'), async (req, res) => {
  const eventId = Number(req.params.id);
  const db = await getDb();
  const eventExists = db.events.some(e => Number(e.id) === eventId);

  if (!eventExists) {
    return res.status(404).json({ message: 'Event not found.' });
  }

  db.events = db.events.filter(e => Number(e.id) !== eventId);
  db.registrations = db.registrations.filter(r => Number(r.eventId) !== eventId);
  addAuditLog(db, req, 'event.delete', { eventId });
  addNotification(db, { type: 'event', title: 'Event deleted', message: `Event #${eventId} was deleted by ${req.admin.email}.`, priority: 'high' });
  await writeDb(db);
  return res.json({ message: 'Event deleted successfully.' });
});

app.get('/api/admin/projects', requireAdminAuth, requireAdminPermission('projects.read'), async (req, res) => {
  const db = await getDb();
  return res.json(db.projects);
});

app.post('/api/admin/projects', requireAdminAuth, requireAdminPermission('projects.write'), async (req, res) => {
  const { title, summary, techStack, githubUrl, demoUrl, status } = req.body;

  if (!title || !summary || !techStack) {
    return res.status(400).json({ message: 'title, summary and techStack are required.' });
  }

  const db = await getDb();
  const nextId = db.projects.length ? Math.max(...db.projects.map(p => Number(p.id) || 0)) + 1 : 1;

  const project = {
    id: nextId,
    title: String(title).trim(),
    summary: String(summary).trim(),
    techStack: String(techStack).trim(),
    githubUrl: githubUrl ? String(githubUrl).trim() : '',
    demoUrl: demoUrl ? String(demoUrl).trim() : '',
    status: status ? String(status).trim() : 'In Progress',
    createdAt: new Date().toISOString(),
  };

  db.projects.push(project);
  addAuditLog(db, req, 'project.create', { projectId: project.id, title: project.title });
  await writeDb(db);
  return res.status(201).json({ message: 'Project created successfully.', project });
});

app.put('/api/admin/projects/:id', requireAdminAuth, requireAdminPermission('projects.write'), async (req, res) => {
  const projectId = Number(req.params.id);
  const db = await getDb();
  const project = db.projects.find(p => Number(p.id) === projectId);

  if (!project) {
    return res.status(404).json({ message: 'Project not found.' });
  }

  const editableFields = ['title', 'summary', 'techStack', 'githubUrl', 'demoUrl', 'status'];
  for (const field of editableFields) {
    if (req.body[field] !== undefined) {
      project[field] = String(req.body[field]).trim();
    }
  }

  addAuditLog(db, req, 'project.update', { projectId, fields: Object.keys(req.body || {}) });
  await writeDb(db);
  return res.json({ message: 'Project updated successfully.', project });
});

app.delete('/api/admin/projects/:id', requireAdminAuth, requireAdminPermission('projects.write'), async (req, res) => {
  const projectId = Number(req.params.id);
  const db = await getDb();
  const exists = db.projects.some(p => Number(p.id) === projectId);

  if (!exists) {
    return res.status(404).json({ message: 'Project not found.' });
  }

  db.projects = db.projects.filter(p => Number(p.id) !== projectId);
  addAuditLog(db, req, 'project.delete', { projectId });
  await writeDb(db);
  return res.json({ message: 'Project deleted successfully.' });
});

app.get('/api/admin/analytics', requireAdminAuth, async (req, res) => {
  const db = await getDb();
  const totalUsers = db.users.length;
  const totalEvents = db.events.length;
  const totalProjects = db.projects.length;
  const totalAdminAccounts = db.adminUsers.length;
  const totalMembers = db.memberDirectory.length;
  const totalAuditLogs = db.auditLogs.length;
  const totalNotifications = db.notifications.length;
  const unreadNotifications = db.notifications.filter(n => !n.read).length;
  const activeUsers = db.users.filter(u => u.status !== 'suspended').length;
  const suspendedUsers = db.users.filter(u => u.status === 'suspended').length;
  const totalContactSubmissions = db.contactSubmissions.length;
  const unreadContactSubmissions = db.contactSubmissions.filter(s => s.status === 'new').length;
  const confirmedRegistrations = db.registrations.filter(r => r.status === 'confirmed').length;
  const waitlistedRegistrations = db.registrations.filter(r => r.status === 'waitlisted').length;
  const attendedRegistrations = db.registrations.filter(r => Boolean(r.attendedAt)).length;
  const categoryCounts = db.events.reduce((acc, event) => {
    const key = event.category || 'Other';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const monthlyRegistrations = {};
  for (const reg of db.registrations) {
    const date = new Date(reg.timestamp || Date.now());
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    monthlyRegistrations[monthKey] = (monthlyRegistrations[monthKey] || 0) + 1;
  }

  const registrationSeries = Object.entries(monthlyRegistrations)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-6)
    .map(([month, value]) => ({ month, value }));

  return res.json({
    totals: {
      totalUsers,
      totalEvents,
      totalProjects,
      totalContactSubmissions,
      unreadContactSubmissions,
      confirmedRegistrations,
      waitlistedRegistrations,
      attendedRegistrations,
      totalAuditLogs,
      totalNotifications,
      unreadNotifications,
      activeUsers,
      suspendedUsers,
      totalAdminAccounts,
      totalMembers,
    },
    categoryCounts,
    registrationSeries,
  });
});

app.get('/api/admin/contact-submissions', requireAdminAuth, requireAdminPermission('contacts.read'), async (req, res) => {
  const db = await getDb();
  const list = [...db.contactSubmissions].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return res.json(list);
});

app.put('/api/admin/contact-submissions/:id/read', requireAdminAuth, requireAdminPermission('contacts.write'), async (req, res) => {
  const db = await getDb();
  const item = db.contactSubmissions.find(s => s.id === String(req.params.id));
  if (!item) {
    return res.status(404).json({ message: 'Contact submission not found.' });
  }
  item.status = 'read';
  item.readAt = new Date().toISOString();
  addAuditLog(db, req, 'contact.read', { contactId: item.id });
  await writeDb(db);
  return res.json({ message: 'Submission marked as read.', submission: item });
});

app.delete('/api/admin/contact-submissions/:id', requireAdminAuth, requireAdminPermission('contacts.write'), async (req, res) => {
  const db = await getDb();
  const before = db.contactSubmissions.length;
  db.contactSubmissions = db.contactSubmissions.filter(s => s.id !== String(req.params.id));
  if (db.contactSubmissions.length === before) {
    return res.status(404).json({ message: 'Contact submission not found.' });
  }
  addAuditLog(db, req, 'contact.delete', { contactId: String(req.params.id) });
  await writeDb(db);
  return res.json({ message: 'Submission deleted successfully.' });
});

app.get('/api/admin/me', requireAdminAuth, async (req, res) => {
  return res.json({ admin: req.admin });
});

app.post('/api/admin/refresh', async (req, res) => {
  const cookies = parseCookies(req.headers.cookie || '');
  const refreshToken = cookies[REFRESH_COOKIE_NAME] || '';
  if (!refreshToken) return res.status(401).json({ message: 'Refresh token missing.' });

  let payload;
  try {
    payload = jwt.verify(refreshToken, REFRESH_JWT_SECRET);
  } catch {
    clearRefreshCookie(res);
    return res.status(401).json({ message: 'Invalid refresh token.' });
  }

  if (payload.kind !== 'admin') {
    clearRefreshCookie(res);
    return res.status(401).json({ message: 'Invalid refresh token type.' });
  }

  const emailLower = String(payload.email || '').toLowerCase();
  const role = String(payload.role || 'support_admin');

  if (emailLower === ADMIN_EMAIL && role === 'super_admin') {
    const nextRefresh = signRefreshToken({ kind: 'admin', sub: 'env-primary-admin', email: ADMIN_EMAIL, role: 'super_admin' });
    setRefreshCookie(res, nextRefresh);
    return res.json({
      token: signAdminToken({
        email: ADMIN_EMAIL,
        role: 'super_admin',
        permissions: getPermissionsForRole('super_admin'),
        name: 'Primary Admin',
      }),
      admin: {
        id: 'env-primary-admin',
        name: 'Primary Admin',
        email: ADMIN_EMAIL,
        role: 'super_admin',
        permissions: getPermissionsForRole('super_admin'),
      },
    });
  }

  const db = await getDb();
  const located = getManagedAdminAccount(db, emailLower);
  if (!located || !located.account || located.account.isActive === false) {
    clearRefreshCookie(res);
    return res.status(401).json({ message: 'Admin account unavailable.' });
  }

  const account = { ...located.account };
  const tokens = Array.isArray(account.refreshTokens) ? account.refreshTokens : [];
  if (!tokens.includes(refreshToken)) {
    clearRefreshCookie(res);
    return res.status(401).json({ message: 'Refresh token revoked.' });
  }

  account.refreshTokens = tokens.filter(t => t !== refreshToken);
  const effectiveRole = account.role || (located.source === 'memberDirectory' ? 'member' : 'sub_admin');
  const nextRefresh = signRefreshToken({ kind: 'admin', sub: String(account.id), email: account.email, role: effectiveRole });
  account.refreshTokens.unshift(nextRefresh);
  account.refreshTokens = account.refreshTokens.slice(0, 8);
  updateManagedAdminAccount(db, located, account);
  await writeDb(db);
  setRefreshCookie(res, nextRefresh);

  return res.json({
    token: signAdminToken({
      email: account.email,
      role: effectiveRole,
      permissions: getPermissionsForRole(effectiveRole),
      name: account.name,
    }),
    admin: toPublicManagedAccount({ ...account, role: effectiveRole }),
  });
});

app.post('/api/admin/logout', async (req, res) => {
  const cookies = parseCookies(req.headers.cookie || '');
  const refreshToken = cookies[REFRESH_COOKIE_NAME] || '';
  clearRefreshCookie(res);
  if (!refreshToken) return res.json({ message: 'Logged out.' });

  try {
    const payload = jwt.verify(refreshToken, REFRESH_JWT_SECRET);
    if (payload.kind === 'admin') {
      const emailLower = String(payload.email || '').toLowerCase();
      const db = await getDb();
      const located = getManagedAdminAccount(db, emailLower);
      if (located?.account) {
        const account = { ...located.account };
        account.refreshTokens = (Array.isArray(account.refreshTokens) ? account.refreshTokens : []).filter(t => t !== refreshToken);
        updateManagedAdminAccount(db, located, account);
        await writeDb(db);
      }
    }
  } catch {
    // ignore invalid token on logout
  }

  return res.json({ message: 'Logged out.' });
});

app.get('/api/admin/admin-users', requireAdminAuth, requireAdminPermission('members.read'), async (req, res) => {
  const db = await getDb();
  const adminUsers = db.adminUsers
    .map((a) => ({
      id: a.id,
      name: a.name,
      email: a.email,
      role: a.role || 'support_admin',
      isActive: a.isActive !== false,
      isVerified: a.isVerified !== false,
      managedByEnv: Boolean(a.managedByEnv),
      createdAt: a.createdAt || null,
      updatedAt: a.updatedAt || null,
    }))
    .sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime());

  return res.json(adminUsers);
});

app.post('/api/admin/admin-users', requireAdminAuth, requireSuperAdmin, async (req, res) => {
  const { name, email, password, role } = req.body || {};

  if (!name || !email || !password || !role) {
    return res.status(400).json({ message: 'name, email, password and role are required.' });
  }

  const allowedRoles = ['sub_admin', 'event_manager', 'content_manager', 'support_admin'];
  if (!allowedRoles.includes(String(role))) {
    return res.status(400).json({ message: 'Invalid role.' });
  }

  const adminPasswordPolicy = validatePasswordPolicy(password, email);
  if (!adminPasswordPolicy.ok) {
    return res.status(400).json({ message: adminPasswordPolicy.message });
  }

  const emailLower = String(email).trim().toLowerCase();
  const db = await getDb();

  const exists = db.adminUsers.some(a => String(a.email).toLowerCase() === emailLower);
  if (exists) {
    return res.status(400).json({ message: 'Admin account with this email already exists.' });
  }

  const passwordHash = await bcrypt.hash(String(password), 10);
  const verificationCode = generateVerificationCode();
  const verificationExpiresAt = new Date(Date.now() + VERIFICATION_TTL_MS).toISOString();
  const adminUser = {
    id: `admin-${Date.now()}`,
    name: String(name).trim(),
    email: emailLower,
    role: String(role),
    isActive: true,
    isVerified: false,
    verificationCode,
    verificationExpiresAt,
    passwordHash,
    createdAt: new Date().toISOString(),
    managedByEnv: false,
  };

  db.adminUsers.push(adminUser);
  addAuditLog(db, req, 'admin.account.create', { email: adminUser.email, role: adminUser.role });
  addNotification(db, {
    type: 'admin',
    title: 'Sub-admin created',
    message: `${adminUser.email} added as ${adminUser.role}. Verification OTP sent.`,
  });

  let otpDispatchError = null;
  try {
    if (emailTransporter) {
      await sendVerificationEmail({ email: adminUser.email, name: adminUser.name, code: verificationCode });
    } else {
      console.warn('SMTP NOT CONFIGURED: Verification OTP for', adminUser.email, 'is', verificationCode);
    }
  } catch (emailErr) {
    otpDispatchError = emailErr?.message || 'OTP email failed to send.';
  }

  await writeDb(db);

  return res.status(201).json({
    message: otpDispatchError
      ? `Sub-admin created successfully, but ${otpDispatchError}`
      : 'Sub-admin created successfully. OTP sent for verification.',
    adminUser: {
      id: adminUser.id,
      name: adminUser.name,
      email: adminUser.email,
      role: adminUser.role,
      isActive: adminUser.isActive,
      isVerified: adminUser.isVerified,
    },
  });
});

app.put('/api/admin/admin-users/:id', requireAdminAuth, requireSuperAdmin, async (req, res) => {
  const { role, isActive, password } = req.body || {};
  const db = await getDb();
  const adminUser = db.adminUsers.find(a => String(a.id) === String(req.params.id));

  if (!adminUser) {
    return res.status(404).json({ message: 'Admin account not found.' });
  }

  if (isProtectedAdminAccount(adminUser)) {
    if (role !== undefined || isActive !== undefined || password !== undefined) {
      return res.status(403).json({ message: 'Primary super admin cannot be modified.' });
    }
  }

  if (role !== undefined) {
    const allowedRoles = ['sub_admin', 'event_manager', 'content_manager', 'support_admin'];
    if (!allowedRoles.includes(String(role))) {
      return res.status(400).json({ message: 'Invalid role.' });
    }
    adminUser.role = String(role);
  }

  if (isActive !== undefined) {
    adminUser.isActive = Boolean(isActive);
  }

  if (password !== undefined) {
    const updatePasswordPolicy = validatePasswordPolicy(password, adminUser.email);
    if (!updatePasswordPolicy.ok) {
      return res.status(400).json({ message: updatePasswordPolicy.message });
    }
    adminUser.passwordHash = await bcrypt.hash(String(password), 10);
  }

  adminUser.updatedAt = new Date().toISOString();
  addAuditLog(db, req, 'admin.account.update', {
    adminId: adminUser.id,
    email: adminUser.email,
    fields: Object.keys(req.body || {}),
  });
  await writeDb(db);

  return res.json({
    message: 'Admin account updated successfully.',
    adminUser: {
      id: adminUser.id,
      name: adminUser.name,
      email: adminUser.email,
      role: adminUser.role,
      isActive: adminUser.isActive,
    },
  });
});

app.delete('/api/admin/admin-users/:id', requireAdminAuth, requireSuperAdmin, async (req, res) => {
  const db = await getDb();
  const adminUser = db.adminUsers.find(a => String(a.id) === String(req.params.id));

  if (!adminUser) {
    return res.status(404).json({ message: 'Admin account not found.' });
  }

  if (isProtectedAdminAccount(adminUser)) {
    return res.status(403).json({ message: 'Primary super admin cannot be removed.' });
  }

  db.adminUsers = db.adminUsers.filter(a => String(a.id) !== String(req.params.id));
  addAuditLog(db, req, 'admin.account.delete', { email: adminUser.email, role: adminUser.role });
  addNotification(db, {
    type: 'admin',
    title: 'Sub-admin removed',
    message: `${adminUser.email} was removed from admin accounts.`,
    priority: 'high',
  });
  await writeDb(db);

  return res.json({ message: 'Admin account removed successfully.' });
});

app.put('/api/admin/admin-users/:id/reset-password', requireAdminAuth, requireSuperAdmin, async (req, res) => {
  const { password } = req.body || {};
  if (!password) {
    return res.status(400).json({ message: 'password is required.' });
  }

  const db = await getDb();
  const adminUser = db.adminUsers.find(a => String(a.id) === String(req.params.id));
  if (!adminUser) {
    return res.status(404).json({ message: 'Admin account not found.' });
  }

  if (isProtectedAdminAccount(adminUser)) {
    return res.status(403).json({ message: 'Primary super admin password cannot be reset from this panel.' });
  }

  const resetPasswordPolicy = validatePasswordPolicy(password, adminUser.email);
  if (!resetPasswordPolicy.ok) {
    return res.status(400).json({ message: resetPasswordPolicy.message });
  }

  adminUser.passwordHash = await bcrypt.hash(String(password), 10);
  adminUser.updatedAt = new Date().toISOString();
  addAuditLog(db, req, 'admin.account.reset_password', { adminId: adminUser.id, email: adminUser.email });
  await writeDb(db);

  return res.json({ message: 'Sub-admin password reset successfully.' });
});

app.get('/api/admin/members', requireAdminAuth, requireAdminPermission('members.read'), async (req, res) => {
  const db = await getDb();
  const members = [...db.memberDirectory]
    .map((m) => ({
      id: m.id,
      name: m.name,
      email: m.email,
      designation: m.designation,
      isActive: m.isActive !== false,
      isVerified: m.isVerified !== false,
      createdAt: m.createdAt || null,
      updatedAt: m.updatedAt || null,
    }))
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
  return res.json(members);
});

app.post('/api/admin/members', requireAdminAuth, requireAdminPermission('members.write'), async (req, res) => {
  const { name, email, designation, password } = req.body || {};
  if (!name || !email || !designation || !password) {
    return res.status(400).json({ message: 'name, email, designation and password are required.' });
  }

  const memberPasswordPolicy = validatePasswordPolicy(password, email);
  if (!memberPasswordPolicy.ok) {
    return res.status(400).json({ message: memberPasswordPolicy.message });
  }

  const db = await getDb();
  const emailLower = String(email).trim().toLowerCase();
  const existing = db.memberDirectory.some(m => String(m.email || '').toLowerCase() === emailLower);
  if (existing) {
    return res.status(400).json({ message: 'Member account with this email already exists.' });
  }

  const verificationCode = generateVerificationCode();
  const verificationExpiresAt = new Date(Date.now() + VERIFICATION_TTL_MS).toISOString();

  const member = {
    id: `member-${Date.now()}`,
    name: String(name).trim(),
    email: emailLower,
    designation: String(designation).trim(),
    role: 'member',
    isActive: true,
    isVerified: false,
    passwordHash: await bcrypt.hash(String(password), 10),
    verificationCode,
    verificationExpiresAt,
    createdAt: new Date().toISOString(),
  };
  db.memberDirectory.push(member);
  addAuditLog(db, req, 'member.create', { memberId: member.id, email: member.email });

  addNotification(db, {
    type: 'member',
    title: 'Member account created',
    message: `${member.email} added as member. Verification OTP sent.`,
  });

  let memberOtpDispatchError = null;
  try {
    if (emailTransporter) {
      await sendVerificationEmail({ email: member.email, name: member.name, code: verificationCode });
    } else {
      console.warn('SMTP NOT CONFIGURED: Verification OTP for', member.email, 'is', verificationCode);
    }
  } catch (emailErr) {
    memberOtpDispatchError = emailErr?.message || 'OTP email failed to send.';
  }

  await writeDb(db);
  return res.status(201).json({
    message: memberOtpDispatchError
      ? `Member added successfully, but ${memberOtpDispatchError}`
      : 'Member added successfully. OTP sent for verification.',
    member: {
      id: member.id,
      name: member.name,
      email: member.email,
      designation: member.designation,
      isActive: member.isActive,
      isVerified: member.isVerified,
    },
  });
});

app.put('/api/admin/members/:id', requireAdminAuth, requireAdminPermission('members.write'), async (req, res) => {
  const { name, email, designation, password, isActive } = req.body || {};
  const db = await getDb();
  const member = db.memberDirectory.find(m => String(m.id) === String(req.params.id));

  if (!member) {
    return res.status(404).json({ message: 'Member not found.' });
  }

  if (name !== undefined) member.name = String(name).trim();
  if (email !== undefined) member.email = String(email).trim().toLowerCase();
  if (designation !== undefined) member.designation = String(designation).trim();
  if (isActive !== undefined) member.isActive = Boolean(isActive);
  if (password !== undefined) {
    const memberUpdatePasswordPolicy = validatePasswordPolicy(password, member.email);
    if (!memberUpdatePasswordPolicy.ok) {
      return res.status(400).json({ message: memberUpdatePasswordPolicy.message });
    }
    member.passwordHash = await bcrypt.hash(String(password), 10);
  }
  member.updatedAt = new Date().toISOString();

  addAuditLog(db, req, 'member.update', { memberId: member.id, fields: Object.keys(req.body || {}) });
  await writeDb(db);
  return res.json({ message: 'Member updated successfully.', member });
});

app.delete('/api/admin/members/:id', requireAdminAuth, requireAdminPermission('members.write'), async (req, res) => {
  const db = await getDb();
  const member = db.memberDirectory.find(m => String(m.id) === String(req.params.id));

  if (!member) {
    return res.status(404).json({ message: 'Member not found.' });
  }

  db.memberDirectory = db.memberDirectory.filter(m => String(m.id) !== String(req.params.id));
  addAuditLog(db, req, 'member.delete', { memberId: member.id, email: member.email });
  addNotification(db, {
    type: 'member',
    title: 'Member removed',
    message: `${member.email} was removed by ${req.admin.email}.`,
    priority: 'high',
  });
  await writeDb(db);
  return res.json({ message: 'Member removed successfully.' });
});

app.get('/api/admin/users', requireAdminAuth, requireAdminPermission('users.read'), async (req, res) => {
  const db = await getDb();
  const users = db.users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    collegeId: u.collegeId,
    joinedAt: u.joinedAt,
    lastLoginAt: u.lastLoginAt || null,
    isVerified: Boolean(u.isVerified),
    status: u.status || 'active',
    registrations: db.registrations.filter(r => r.userId === u.id).length,
  }));
  return res.json(users);
});

app.put('/api/admin/users/:id/status', requireAdminAuth, requireAdminPermission('users.write'), async (req, res) => {
  const { status } = req.body || {};
  if (!['active', 'suspended'].includes(status)) {
    return res.status(400).json({ message: 'status must be active or suspended.' });
  }

  const db = await getDb();
  const user = db.users.find(u => String(u.id) === String(req.params.id));
  if (!user) {
    return res.status(404).json({ message: 'User not found.' });
  }

  user.status = status;
  user.updatedAt = new Date().toISOString();
  addAuditLog(db, req, 'user.status.update', { userId: user.id, status });
  addNotification(db, {
    type: 'user',
    title: `User ${status}`,
    message: `${user.email} was set to ${status} by ${req.admin.email}.`,
    priority: status === 'suspended' ? 'high' : 'normal',
  });
  await writeDb(db);
  return res.json({ message: `User marked ${status}.`, user: toPublicUser(user) });
});

app.post('/api/admin/users/bulk-action', requireAdminAuth, requireAdminPermission('users.write'), async (req, res) => {
  const { userIds, action } = req.body || {};
  if (!Array.isArray(userIds) || userIds.length === 0 || !action) {
    return res.status(400).json({ message: 'userIds array and action are required.' });
  }

  const allowedActions = ['activate', 'suspend', 'verify', 'unverify'];
  if (!allowedActions.includes(String(action))) {
    return res.status(400).json({ message: 'Invalid action.' });
  }

  const db = await getDb();
  const uniqueIds = [...new Set(userIds.map(id => String(id)))];
  const users = db.users.filter(u => uniqueIds.includes(String(u.id)));
  if (users.length === 0) {
    return res.status(404).json({ message: 'No users found for selected ids.' });
  }

  for (const user of users) {
    if (action === 'activate') user.status = 'active';
    if (action === 'suspend') user.status = 'suspended';
    if (action === 'verify') user.isVerified = true;
    if (action === 'unverify') user.isVerified = false;
    user.updatedAt = new Date().toISOString();
  }

  addAuditLog(db, req, 'user.bulk_action', { action, count: users.length, userIds: users.map(u => u.id) });
  addNotification(db, {
    type: 'user',
    title: 'Bulk user action completed',
    message: `${req.admin.email} applied ${action} on ${users.length} users.`,
  });
  await writeDb(db);

  return res.json({ message: `Bulk action "${action}" applied to ${users.length} users.` });
});

app.put('/api/admin/users/:id/verification', requireAdminAuth, requireAdminPermission('users.write'), async (req, res) => {
  const { isVerified } = req.body || {};
  if (typeof isVerified !== 'boolean') {
    return res.status(400).json({ message: 'isVerified boolean is required.' });
  }

  const db = await getDb();
  const user = db.users.find(u => String(u.id) === String(req.params.id));
  if (!user) {
    return res.status(404).json({ message: 'User not found.' });
  }

  user.isVerified = isVerified;
  user.updatedAt = new Date().toISOString();
  addAuditLog(db, req, 'user.verification.update', { userId: user.id, isVerified });
  await writeDb(db);
  return res.json({ message: 'Verification status updated.', user: toPublicUser(user) });
});

app.get('/api/admin/registrations', requireAdminAuth, requireAdminPermission('registrations.read'), async (req, res) => {
  const db = await getDb();
  const list = db.registrations
    .map((r) => {
      const user = db.users.find(u => u.id === r.userId);
      const event = db.events.find(e => Number(e.id) === Number(r.eventId));
      if (!user || !event) return null;
      return {
        userId: r.userId,
        eventId: Number(r.eventId),
        userName: user.name,
        userEmail: user.email,
        eventName: event.name,
        status: r.status || 'confirmed',
        attendedAt: r.attendedAt || null,
        timestamp: r.timestamp || null,
      };
    })
    .filter(Boolean)
    .sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime());

  return res.json(list);
});

app.put('/api/admin/registrations/:userId/:eventId/status', requireAdminAuth, requireAdminPermission('registrations.write'), async (req, res) => {
  const { userId, eventId } = req.params;
  const { status } = req.body || {};

  if (!['confirmed', 'waitlisted', 'cancelled'].includes(status)) {
    return res.status(400).json({ message: 'status must be confirmed, waitlisted, or cancelled.' });
  }

  const db = await getDb();
  const event = db.events.find(e => Number(e.id) === Number(eventId));
  if (!event) {
    return res.status(404).json({ message: 'Event not found.' });
  }

  const regIndex = db.registrations.findIndex(r => r.userId === String(userId) && Number(r.eventId) === Number(eventId));
  if (regIndex === -1) {
    return res.status(404).json({ message: 'Registration not found.' });
  }

  if (status === 'cancelled') {
    db.registrations.splice(regIndex, 1);
    promoteWaitlistForEvent(db, eventId);
  } else {
    db.registrations[regIndex].status = status;
    db.registrations[regIndex].updatedAt = new Date().toISOString();
    if (status === 'confirmed') {
      promoteWaitlistForEvent(db, eventId);
    }
  }

  addAuditLog(db, req, 'registration.status.update', { userId, eventId: Number(eventId), status });
  await writeDb(db);
  return res.json({ message: 'Registration status updated.' });
});

app.post('/api/admin/events/:id/waitlist/promote', requireAdminAuth, requireAdminPermission('registrations.write'), async (req, res) => {
  const db = await getDb();
  const promoted = promoteWaitlistForEvent(db, Number(req.params.id));
  addAuditLog(db, req, 'registration.waitlist.promote', { eventId: Number(req.params.id), promotedCount: promoted.length });
  await writeDb(db);
  return res.json({ message: `Promoted ${promoted.length} registrations.`, promotedCount: promoted.length });
});

app.put('/api/admin/contact-submissions/:id/status', requireAdminAuth, requireAdminPermission('contacts.write'), async (req, res) => {
  const { status, assignee, priority, note } = req.body || {};
  if (!['new', 'in-progress', 'resolved', 'read'].includes(status || '')) {
    return res.status(400).json({ message: 'status must be new, in-progress, resolved, or read.' });
  }

  const db = await getDb();
  const item = db.contactSubmissions.find(s => s.id === String(req.params.id));
  if (!item) {
    return res.status(404).json({ message: 'Contact submission not found.' });
  }

  item.status = status;
  if (assignee !== undefined) item.assignee = String(assignee || '').trim() || null;
  if (priority !== undefined) item.priority = String(priority || '').trim() || 'normal';
  if (note !== undefined) item.note = String(note || '').trim() || null;
  item.updatedAt = new Date().toISOString();
  if (status === 'read' || status === 'resolved') {
    item.readAt = item.readAt || new Date().toISOString();
  }

  addAuditLog(db, req, 'contact.status.update', { contactId: item.id, status: item.status });
  await writeDb(db);
  return res.json({ message: 'Submission updated.', submission: item });
});

app.get('/api/admin/audit-logs', requireAdminAuth, requireAdminPermission('audit.read'), async (req, res) => {
  const db = await getDb();
  const limit = Math.min(200, Math.max(1, Number(req.query.limit || 80)));
  const action = String(req.query.action || '').trim();

  let logs = db.auditLogs;
  if (action) {
    logs = logs.filter(log => String(log.action).toLowerCase().includes(action.toLowerCase()));
  }

  return res.json(logs.slice(0, limit));
});

app.get('/api/admin/notifications', requireAdminAuth, requireAdminPermission('notifications.read'), async (req, res) => {
  const db = await getDb();
  return res.json(db.notifications.slice(0, 100));
});

app.put('/api/admin/notifications/:id/read', requireAdminAuth, requireAdminPermission('notifications.read'), async (req, res) => {
  const db = await getDb();
  const item = db.notifications.find(n => n.id === String(req.params.id));
  if (!item) {
    return res.status(404).json({ message: 'Notification not found.' });
  }
  item.read = true;
  item.readAt = new Date().toISOString();
  await writeDb(db);
  return res.json({ message: 'Notification marked as read.', notification: item });
});

app.delete('/api/admin/notifications/:id', requireAdminAuth, requireAdminPermission('notifications.read'), async (req, res) => {
  const db = await getDb();
  const before = db.notifications.length;
  db.notifications = db.notifications.filter(n => n.id !== String(req.params.id));
  if (before === db.notifications.length) {
    return res.status(404).json({ message: 'Notification not found.' });
  }
  await writeDb(db);
  return res.json({ message: 'Notification deleted.' });
});

app.get('/api/admin/reports/export', requireAdminAuth, requireAdminPermission('reports.read'), async (req, res) => {
  const type = String(req.query.type || '').trim();
  const db = await getDb();

  const datasets = {
    users: {
      rows: db.users.map(u => ({
        id: u.id,
        name: u.name,
        email: u.email,
        collegeId: u.collegeId,
        isVerified: Boolean(u.isVerified),
        status: u.status || 'active',
        joinedAt: u.joinedAt || '',
      })),
      headers: ['id', 'name', 'email', 'collegeId', 'isVerified', 'status', 'joinedAt'],
    },
    events: {
      rows: db.events.map(e => ({
        id: e.id,
        name: e.name,
        date: e.date,
        time: e.time,
        category: e.category,
        location: e.location,
        capacity: Number(e.capacity ?? 60),
      })),
      headers: ['id', 'name', 'date', 'time', 'category', 'location', 'capacity'],
    },
    registrations: {
      rows: db.registrations.map(r => ({
        userId: r.userId,
        eventId: r.eventId,
        status: r.status || 'confirmed',
        attendedAt: r.attendedAt || '',
        timestamp: r.timestamp || '',
      })),
      headers: ['userId', 'eventId', 'status', 'attendedAt', 'timestamp'],
    },
    contacts: {
      rows: db.contactSubmissions.map(c => ({
        id: c.id,
        name: c.name,
        email: c.email,
        status: c.status || 'new',
        priority: c.priority || 'normal',
        assignee: c.assignee || '',
        createdAt: c.createdAt || '',
      })),
      headers: ['id', 'name', 'email', 'status', 'priority', 'assignee', 'createdAt'],
    },
    audit: {
      rows: db.auditLogs.map(l => ({
        id: l.id,
        action: l.action,
        adminEmail: l.adminEmail,
        adminRole: l.adminRole,
        ip: l.ip,
        createdAt: l.createdAt,
      })),
      headers: ['id', 'action', 'adminEmail', 'adminRole', 'ip', 'createdAt'],
    },
  };

  if (!datasets[type]) {
    return res.status(400).json({ message: 'Invalid report type. Use users, events, registrations, contacts, or audit.' });
  }

  const csv = toCSV(datasets[type].rows, datasets[type].headers);
  addAuditLog(db, req, 'report.export', { type, rows: datasets[type].rows.length });
  await writeDb(db);

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${type}-report.csv"`);
  return res.send(csv);
});

app.get('/api/admin/content-settings', requireAdminAuth, requireAdminPermission('content.read'), async (req, res) => {
  const db = await getDb();
  return res.json(db.contentSettings);
});

app.put('/api/admin/content-settings', requireAdminAuth, requireAdminPermission('content.write'), async (req, res) => {
  const { announcement, heroBadge, aboutTitle, aboutIntro, aboutMission, showSkillAnalyzer } = req.body || {};
  const db = await getDb();

  if (announcement !== undefined) {
    db.contentSettings.announcement = String(announcement).trim().slice(0, 400);
  }
  if (heroBadge !== undefined) {
    db.contentSettings.heroBadge = String(heroBadge).trim().slice(0, 120);
  }
  if (aboutTitle !== undefined) {
    db.contentSettings.aboutTitle = String(aboutTitle).trim().slice(0, 120);
  }
  if (aboutIntro !== undefined) {
    db.contentSettings.aboutIntro = String(aboutIntro).trim().slice(0, 700);
  }
  if (aboutMission !== undefined) {
    db.contentSettings.aboutMission = String(aboutMission).trim().slice(0, 900);
  }
  if (showSkillAnalyzer !== undefined) {
    db.contentSettings.showSkillAnalyzer = Boolean(showSkillAnalyzer);
  }

  db.contentSettings.updatedAt = new Date().toISOString();
  addAuditLog(db, req, 'content.settings.update', { fields: Object.keys(req.body || {}) });
  await writeDb(db);
  return res.json({ message: 'Content settings updated.', settings: db.contentSettings });
});

app.post('/api/admin/backups', requireAdminAuth, requireAdminPermission('reports.read'), async (req, res) => {
  try {
    ensureBackupDir();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `db-backup-${timestamp}.json`;
    const outputPath = path.join(BACKUP_DIR, filename);
    fs.copyFileSync(DB_PATH, outputPath);

    const db = await getDb();
    addAuditLog(db, req, 'backup.create', { filename });
    addNotification(db, { type: 'backup', title: 'Backup created', message: `${filename} created by ${req.admin.email}.` });
    await writeDb(db);

    return res.json({ message: 'Backup created successfully.', filename });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to create backup.', error: err.message });
  }
});

app.get('/api/admin/backups', requireAdminAuth, requireAdminPermission('reports.read'), async (req, res) => {
  try {
    ensureBackupDir();
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(name => name.endsWith('.json'))
      .map(name => {
        const fullPath = path.join(BACKUP_DIR, name);
        const stat = fs.statSync(fullPath);
        return {
          name,
          sizeBytes: stat.size,
          createdAt: stat.birthtime.toISOString(),
        };
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return res.json(files);
  } catch (err) {
    return res.status(500).json({ message: 'Failed to read backups.', error: err.message });
  }
});

app.post('/api/admin/backups/:name/restore', requireAdminAuth, requireAdminPermission('reports.read'), async (req, res) => {
  try {
    ensureBackupDir();
    const rawName = String(req.params.name || '');
    if (!/^[a-zA-Z0-9._-]+$/.test(rawName)) {
      return res.status(400).json({ message: 'Invalid backup filename.' });
    }
    const backupPath = path.join(BACKUP_DIR, rawName);
    if (!fs.existsSync(backupPath)) {
      return res.status(404).json({ message: 'Backup file not found.' });
    }

    fs.copyFileSync(backupPath, DB_PATH);
    const db = await getDb();
    addAuditLog(db, req, 'backup.restore', { filename: rawName });
    addNotification(db, {
      type: 'backup',
      title: 'Backup restored',
      message: `${rawName} restored by ${req.admin.email}.`,
      priority: 'high',
    });
    await writeDb(db);
    return res.json({ message: 'Backup restored successfully.' });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to restore backup.', error: err.message });
  }
});

app.get('/api/admin/system-info', requireAdminAuth, async (req, res) => {
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

// ─── Events Routes ────────────────────────────────────────────────────────────
app.get('/api/events', async (req, res) => {
  const db = await getDb();
  res.json(db.events.map(event => decorateEvent(db, event)));
});

app.get('/api/projects', async (req, res) => {
  const db = await getDb();
  res.json(db.projects);
});

app.post('/api/contact', contactLimiter, async (req, res) => {
  const name = String(req.body?.name || '').trim();
  const email = String(req.body?.email || '').trim().toLowerCase();
  const message = String(req.body?.message || '').trim();

  if (!name || !email || !message) {
    return res.status(400).json({ message: 'name, email and message are required.' });
  }

  if (!/^\S+@\S+\.\S+$/.test(email)) {
    return res.status(400).json({ message: 'Please enter a valid email address.' });
  }

  if (message.length < 8) {
    return res.status(400).json({ message: 'Message is too short. Please provide more details.' });
  }

  const db = await getDb();
  db.contactSubmissions = Array.isArray(db.contactSubmissions) ? db.contactSubmissions : [];

  const submission = {
    id: `contact-${Date.now()}`,
    name,
    email,
    message,
    status: 'new',
    createdAt: new Date().toISOString(),
  };

  db.contactSubmissions.unshift(submission);
  if (db.contactSubmissions.length > 1000) {
    db.contactSubmissions = db.contactSubmissions.slice(0, 1000);
  }
  await writeDb(db);

  try {
    await sendContactEmail({ name, email, message });
    return res.status(201).json({ message: 'Thanks. Your message was sent successfully.', submissionId: submission.id });
  } catch (err) {
    console.error('Contact email delivery failed:', err.message || err);
    return res.status(201).json({
      message: 'Your message was saved successfully. Email delivery is temporarily unavailable, and the admin can still view your submission.',
      submissionId: submission.id,
      emailDelivery: 'failed',
    });
  }
});

app.post('/api/events/register', async (req, res) => {
  const { userId, eventId } = req.body;
  if (!userId || !eventId) {
    return res.status(400).json({ message: "userId and eventId are required." });
  }
  const db = await getDb();

  const user = db.users.find(u => String(u.id) === String(userId));
  if (!user) {
    return res.status(404).json({ message: 'User not found.' });
  }
  if ((user.status || 'active') === 'suspended') {
    return res.status(403).json({ message: 'Your account is suspended. Please contact support.' });
  }

  // Check event exists
  const event = db.events.find(e => e.id === Number(eventId));
  if (!event) {
    return res.status(404).json({ message: "Event not found." });
  }

  if (!isEventOpen(event)) {
    return res.status(400).json({ message: 'Registration deadline has passed for this event.' });
  }

  const registrationExists = db.registrations.find(
    r => r.userId === userId && r.eventId === Number(eventId)
  );
  if (registrationExists) {
    return res.status(400).json({ message: `You are already ${registrationExists.status} for this event.` });
  }

  const { confirmedCount } = getEventRegistrationCounts(db, event.id);
  const capacity = Number(event.capacity ?? 60);
  const registrationStatus = confirmedCount >= capacity ? 'waitlisted' : 'confirmed';
  const waitlistPosition = registrationStatus === 'waitlisted'
    ? db.registrations.filter(r => Number(r.eventId) === Number(eventId) && r.status === 'waitlisted').length + 1
    : null;

  db.registrations.push({
    userId,
    eventId: Number(eventId),
    status: registrationStatus,
    timestamp: new Date().toISOString(),
    teamMembers: [],
    teamInvites: [],
    teamLeader: {
      userId: user.id,
      name: user.name,
      email: user.email,
    },
  });
  await writeDb(db);

  try {
    if (emailTransporter) {
      await sendEventRegistrationEmail({
        email: user.email,
        name: user.name,
        eventName: event.name,
        eventDate: event.date,
        eventTime: event.time,
        status: registrationStatus,
      });
    } else {
      console.warn('SMTP NOT CONFIGURED: registration email skipped for', user.email, 'event', event.name);
    }
  } catch (emailErr) {
    console.error('Failed to send registration success email:', emailErr);
  }

  if (registrationStatus === 'waitlisted') {
    return res.json({
      message: `"${event.name}" is full. You have been added to the waitlist.`,
      status: 'waitlisted',
      waitlistPosition,
    });
  }

  res.json({ message: `Successfully registered for "${event.name}"! 🎉`, status: 'confirmed' });
});

app.post('/api/events/cancel-registration', async (req, res) => {
  return res.status(400).json({
    requiresOtp: true,
    message: 'Cancellation now requires OTP verification. Request OTP first.',
  });
});

app.post('/api/events/cancel-registration/request-otp', async (req, res) => {
  const { userId, eventId } = req.body;
  if (!userId || !eventId) {
    return res.status(400).json({ message: 'userId and eventId are required.' });
  }

  const db = await getDb();
  const registration = db.registrations.find(r => r.userId === userId && Number(r.eventId) === Number(eventId));
  if (!registration) {
    return res.status(404).json({ message: 'Registration not found.' });
  }

  const user = db.users.find(u => String(u.id) === String(userId));
  if (!user) {
    return res.status(404).json({ message: 'User not found.' });
  }

  const event = db.events.find(e => Number(e.id) === Number(eventId));
  if (!event) {
    return res.status(404).json({ message: 'Event not found.' });
  }

  registration.cancelOtp = generateVerificationCode();
  registration.cancelOtpExpiresAt = new Date(Date.now() + (10 * 60 * 1000)).toISOString();

  try {
    if (emailTransporter) {
      await sendCancellationOtpEmail({
        email: user.email,
        name: user.name,
        eventName: event.name,
        code: registration.cancelOtp,
      });
    } else {
      console.warn('SMTP NOT CONFIGURED: cancel OTP for', user.email, 'event', event.name, 'is', registration.cancelOtp);
    }
  } catch (emailErr) {
    return res.status(500).json({ message: emailErr?.message || 'Unable to send cancellation OTP.' });
  }

  await writeDb(db);
  return res.json({ message: 'Cancellation OTP sent to your email.' });
});

app.post('/api/events/cancel-registration/verify-otp', async (req, res) => {
  const { userId, eventId, otp } = req.body || {};
  if (!userId || !eventId || !otp) {
    return res.status(400).json({ message: 'userId, eventId and otp are required.' });
  }

  const db = await getDb();
  const index = db.registrations.findIndex(r => r.userId === userId && Number(r.eventId) === Number(eventId));
  if (index === -1) {
    return res.status(404).json({ message: 'Registration not found.' });
  }

  const target = db.registrations[index];
  if (!target.cancelOtp || String(target.cancelOtp) !== String(otp).trim()) {
    return res.status(400).json({ message: 'Invalid cancellation OTP.' });
  }

  if (!target.cancelOtpExpiresAt || new Date(target.cancelOtpExpiresAt).getTime() < Date.now()) {
    return res.status(400).json({ message: 'Cancellation OTP expired. Request a new OTP.' });
  }

  const removed = db.registrations[index];
  db.registrations.splice(index, 1);

  let promoted = [];
  if (removed.status === 'confirmed') {
    promoted = promoteWaitlistForEvent(db, eventId);
  }

  await writeDb(db);
  return res.json({
    message: 'Registration cancelled successfully.',
    promotedCount: promoted.length,
  });
});

app.put('/api/events/:eventId/team-members', async (req, res) => {
  const { eventId } = req.params;
  const { userId, teamMembers } = req.body || {};

  if (!userId || !eventId) {
    return res.status(400).json({ message: 'userId and eventId are required.' });
  }

  if (!Array.isArray(teamMembers)) {
    return res.status(400).json({ message: 'teamMembers must be an array.' });
  }

  if (teamMembers.length > 4) {
    return res.status(400).json({ message: 'Maximum 4 team members are allowed.' });
  }

  const normalized = [];
  for (let idx = 0; idx < teamMembers.length; idx += 1) {
    const member = teamMembers[idx];
    const name = String(member?.name || '').trim();
    const email = String(member?.email || '').trim().toLowerCase();
    if (!name || !email) {
      return res.status(400).json({ message: `Team member ${idx + 1} must include name and email.` });
    }
    normalized.push({ id: member?.id || `tm-${Date.now()}-${idx}`, name, email });
  }

  const db = await getDb();
  const user = db.users.find(u => String(u.id) === String(userId));
  if (!user) {
    return res.status(404).json({ message: 'User not found.' });
  }

  const registration = db.registrations.find(r => r.userId === String(userId) && Number(r.eventId) === Number(eventId));
  if (!registration) {
    return res.status(404).json({ message: 'Registration not found. Please register first.' });
  }

  registration.teamMembers = normalized;
  registration.teamLeader = {
    userId: user.id,
    name: user.name,
    email: user.email,
  };
  registration.updatedAt = new Date().toISOString();

  await writeDb(db);
  return res.json({
    message: 'Team members updated successfully.',
    teamLeader: registration.teamLeader,
    teamMembers: registration.teamMembers,
  });
});

app.post('/api/events/:eventId/team-invites', async (req, res) => {
  const { eventId } = req.params;
  const { userId, inviteeEmail, inviteeName } = req.body || {};
  if (!userId || !eventId || !inviteeEmail) {
    return res.status(400).json({ message: 'userId, eventId and inviteeEmail are required.' });
  }

  const db = await getDb();
  const user = db.users.find(u => String(u.id) === String(userId));
  if (!user) return res.status(404).json({ message: 'User not found.' });

  const event = db.events.find(e => Number(e.id) === Number(eventId));
  if (!event) return res.status(404).json({ message: 'Event not found.' });

  const registration = db.registrations.find(r => String(r.userId) === String(userId) && Number(r.eventId) === Number(eventId));
  if (!registration) {
    return res.status(404).json({ message: 'Register for this event before sending invites.' });
  }

  const email = String(inviteeEmail).trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email)) {
    return res.status(400).json({ message: 'Invalid invitee email.' });
  }
  if (email === String(user.email || '').toLowerCase()) {
    return res.status(400).json({ message: 'You cannot invite yourself.' });
  }

  if (!Array.isArray(registration.teamInvites)) registration.teamInvites = [];
  const existing = registration.teamInvites.find(i => String(i.email).toLowerCase() === email && i.status === 'pending');
  if (existing) {
    return res.status(400).json({ message: 'A pending invite already exists for this email.' });
  }

  const token = crypto.randomBytes(20).toString('hex');
  const invite = {
    id: `inv-${Date.now()}`,
    token,
    email,
    inviteeName: String(inviteeName || '').trim() || null,
    inviterName: user.name,
    status: 'pending',
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + (72 * 60 * 60 * 1000)).toISOString(),
  };
  registration.teamInvites.unshift(invite);

  const acceptUrl = `${FRONTEND_BASE_URL}/team-invite/${token}`;
  const rejectUrl = `${FRONTEND_BASE_URL}/team-invite/${token}`;

  try {
    if (emailTransporter) {
      await sendTeamInviteEmail({
        email,
        inviteeName: invite.inviteeName,
        inviterName: user.name,
        eventName: event.name,
        acceptUrl,
        rejectUrl,
      });
    } else {
      console.warn('SMTP NOT CONFIGURED: Team invite generated for', email, acceptUrl, rejectUrl);
    }
  } catch (emailErr) {
    return res.status(500).json({ message: emailErr?.message || 'Unable to send invite email.' });
  }

  await writeDb(db);
  return res.json({ message: 'Invite sent successfully.', invite });
});

app.get('/api/events/team-invites/:token', async (req, res) => {
  const { token } = req.params;
  const db = await getDb();

  let targetRegistration = null;
  let targetInvite = null;
  for (const reg of db.registrations) {
    const invites = Array.isArray(reg.teamInvites) ? reg.teamInvites : [];
    const hit = invites.find(i => i.token === token);
    if (hit) {
      targetRegistration = reg;
      targetInvite = hit;
      break;
    }
  }

  if (!targetRegistration || !targetInvite) {
    return res.status(404).json({ message: 'Invite not found.' });
  }

  const event = db.events.find(e => Number(e.id) === Number(targetRegistration.eventId));
  const expiresInMs = new Date(targetInvite.expiresAt).getTime() - Date.now();

  return res.json({
    invite: {
      id: targetInvite.id,
      email: targetInvite.email,
      inviteeName: targetInvite.inviteeName,
      inviterName: targetInvite.inviterName,
      status: targetInvite.status,
      expiresAt: targetInvite.expiresAt,
      expiresInMs,
      eventId: targetRegistration.eventId,
      eventName: event?.name || 'Event',
      requiresSignIn: true,
    },
  });
});

app.get('/api/events/:eventId/team-invites', async (req, res) => {
  const { eventId } = req.params;
  const { userId } = req.query || {};
  if (!userId) return res.status(400).json({ message: 'userId is required.' });

  const db = await getDb();
  const registration = db.registrations.find(r => String(r.userId) === String(userId) && Number(r.eventId) === Number(eventId));
  if (!registration) return res.status(404).json({ message: 'Registration not found.' });

  const invites = (Array.isArray(registration.teamInvites) ? registration.teamInvites : []).map(invite => ({
    ...invite,
    expiresInMs: new Date(invite.expiresAt).getTime() - Date.now(),
  }));

  return res.json({ invites });
});

app.post('/api/events/:eventId/team-invites/:inviteId/revoke', async (req, res) => {
  const { eventId, inviteId } = req.params;
  const { userId } = req.body || {};
  if (!userId) return res.status(400).json({ message: 'userId is required.' });

  const db = await getDb();
  const registration = db.registrations.find(r => String(r.userId) === String(userId) && Number(r.eventId) === Number(eventId));
  if (!registration) return res.status(404).json({ message: 'Registration not found.' });

  const invite = (registration.teamInvites || []).find(i => String(i.id) === String(inviteId));
  if (!invite) return res.status(404).json({ message: 'Invite not found.' });
  if (invite.status !== 'pending') return res.status(400).json({ message: `Invite already ${invite.status}.` });

  invite.status = 'revoked';
  invite.respondedAt = new Date().toISOString();
  registration.updatedAt = new Date().toISOString();
  await writeDb(db);
  return res.json({ message: 'Invite revoked successfully.' });
});

app.post('/api/events/:eventId/team-invites/:inviteId/resend', async (req, res) => {
  const { eventId, inviteId } = req.params;
  const { userId } = req.body || {};
  if (!userId) return res.status(400).json({ message: 'userId is required.' });

  const db = await getDb();
  const registration = db.registrations.find(r => String(r.userId) === String(userId) && Number(r.eventId) === Number(eventId));
  if (!registration) return res.status(404).json({ message: 'Registration not found.' });

  const invite = (registration.teamInvites || []).find(i => String(i.id) === String(inviteId));
  if (!invite) return res.status(404).json({ message: 'Invite not found.' });
  if (invite.status !== 'pending') return res.status(400).json({ message: `Invite already ${invite.status}.` });

  const event = db.events.find(e => Number(e.id) === Number(eventId));
  const inviter = db.users.find(u => String(u.id) === String(userId));
  invite.expiresAt = new Date(Date.now() + (72 * 60 * 60 * 1000)).toISOString();
  invite.resentAt = new Date().toISOString();

  const acceptUrl = `${FRONTEND_BASE_URL}/team-invite/${invite.token}`;
  const rejectUrl = `${FRONTEND_BASE_URL}/team-invite/${invite.token}`;
  try {
    if (emailTransporter) {
      await sendTeamInviteEmail({
        email: invite.email,
        inviteeName: invite.inviteeName,
        inviterName: inviter?.name || invite.inviterName || 'Team Leader',
        eventName: event?.name || 'Event',
        acceptUrl,
        rejectUrl,
      });
    }
  } catch (emailErr) {
    return res.status(500).json({ message: emailErr?.message || 'Unable to resend invite email.' });
  }

  registration.updatedAt = new Date().toISOString();
  await writeDb(db);
  return res.json({ message: 'Invite resent successfully.' });
});

app.post('/api/events/team-invites/respond', requireUserAuth, async (req, res) => {
  const { token, decision, userId } = req.body || {};
  const safeDecision = String(decision || '').toLowerCase();
  if (!token || !['accept', 'reject'].includes(safeDecision) || !userId) {
    return res.status(400).json({ message: 'token, userId and valid decision are required.' });
  }

  if (String(req.userAuth.id) !== String(userId)) {
    return res.status(403).json({ message: 'You can only respond using your own signed-in account.' });
  }

  const db = await getDb();
  let targetRegistration = null;
  let targetInvite = null;
  for (const reg of db.registrations) {
    const invites = Array.isArray(reg.teamInvites) ? reg.teamInvites : [];
    const hit = invites.find(i => i.token === token);
    if (hit) {
      targetRegistration = reg;
      targetInvite = hit;
      break;
    }
  }

  if (!targetRegistration || !targetInvite) {
    return res.status(404).json({ message: 'Invite not found.' });
  }

  const respondingUser = db.users.find(u => String(u.id) === String(userId));
  if (!respondingUser) return res.status(404).json({ message: 'Signed-in user not found.' });
  if (String(respondingUser.email || '').toLowerCase() !== String(targetInvite.email || '').toLowerCase()) {
    return res.status(403).json({ message: 'This invite belongs to a different email account.' });
  }

  if (targetInvite.status !== 'pending') {
    return res.status(400).json({ message: `Invite is already ${targetInvite.status}.` });
  }
  if (new Date(targetInvite.expiresAt).getTime() < Date.now()) {
    targetInvite.status = 'expired';
    await writeDb(db);
    return res.status(400).json({ message: 'Invite has expired.' });
  }

  targetInvite.status = safeDecision === 'accept' ? 'accepted' : 'rejected';
  targetInvite.respondedAt = new Date().toISOString();

  if (safeDecision === 'accept') {
    if (!Array.isArray(targetRegistration.teamMembers)) targetRegistration.teamMembers = [];
    if (targetRegistration.teamMembers.length >= 4) {
      targetInvite.status = 'rejected';
      targetInvite.note = 'Team is already full.';
      await writeDb(db);
      return res.status(400).json({ message: 'Team is already full.' });
    }

    const exists = targetRegistration.teamMembers.some(m => String(m.email || '').toLowerCase() === String(targetInvite.email || '').toLowerCase());
    if (!exists) {
      targetRegistration.teamMembers.push({
        id: `tm-${Date.now()}`,
        name: targetInvite.inviteeName || targetInvite.email.split('@')[0],
        email: targetInvite.email,
      });
    }
  }

  targetRegistration.updatedAt = new Date().toISOString();
  await writeDb(db);
  return res.json({
    message: safeDecision === 'accept' ? 'Invite accepted and added to team.' : 'Invite rejected.',
    decision: safeDecision,
  });
});

app.get('/api/events/:eventId/checkin-qr', async (req, res) => {
  const { eventId } = req.params;
  const { userId } = req.query;

  if (!userId) {
    return res.status(400).json({ message: 'userId is required.' });
  }

  const db = await getDb();
  const registration = db.registrations.find(
    r => r.userId === String(userId) && Number(r.eventId) === Number(eventId) && r.status === 'confirmed'
  );

  if (!registration) {
    return res.status(404).json({ message: 'Confirmed registration not found for this user.' });
  }

  const token = signCheckinToken({ eventId: Number(eventId), userId: String(userId) });
  const qrDataUrl = await QRCode.toDataURL(token, { margin: 2, width: 280 });

  return res.json({ token, qrDataUrl });
});

app.post('/api/events/check-in', async (req, res) => {
  const { token } = req.body;

  if (!token) {
    return res.status(400).json({ message: 'token is required.' });
  }

  let payload;
  try {
    payload = jwt.verify(token, CHECKIN_JWT_SECRET);
  } catch {
    return res.status(400).json({ message: 'Invalid or expired check-in token.' });
  }

  if (payload.role !== 'checkin') {
    return res.status(400).json({ message: 'Invalid check-in token.' });
  }

  const db = await getDb();
  const registration = db.registrations.find(
    r => r.userId === String(payload.userId) && Number(r.eventId) === Number(payload.eventId) && r.status === 'confirmed'
  );

  if (!registration) {
    return res.status(404).json({ message: 'Confirmed registration not found.' });
  }

  if (registration.attendedAt) {
    return res.json({ message: 'Attendance already marked.', attendedAt: registration.attendedAt });
  }

  registration.attendedAt = new Date().toISOString();
  await writeDb(db);
  return res.json({ message: 'Attendance marked successfully.', attendedAt: registration.attendedAt });
});

app.get('/api/events/:eventId/calendar.ics', async (req, res) => {
  const { eventId } = req.params;
  const db = await getDb();
  const event = db.events.find(e => Number(e.id) === Number(eventId));
  if (!event) return res.status(404).json({ message: 'Event not found.' });

  const start = getIcsDateTime(event.date, event.time, 10, 0);
  if (!start) return res.status(400).json({ message: 'Invalid event date.' });
  const end = new Date(start.getTime() + (2 * 60 * 60 * 1000));
  const uid = `event-${event.id}@developers-guild`;

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Developers Guild//Events//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${formatUtcStamp(new Date())}`,
    `DTSTART:${formatUtcStamp(start)}`,
    `DTEND:${formatUtcStamp(end)}`,
    `SUMMARY:${escapeIcsText(event.name)}`,
    `DESCRIPTION:${escapeIcsText(event.description || '')}`,
    `LOCATION:${escapeIcsText(event.location || '')}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ];

  const icsBody = `${lines.join('\r\n')}\r\n`;
  res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="event-${event.id}.ics"`);
  return res.send(icsBody);
});

app.get('/api/events/:eventId/certificate', async (req, res) => {
  const { eventId } = req.params;
  const { userId } = req.query;
  if (!userId) return res.status(400).json({ message: 'userId is required.' });

  const db = await getDb();
  const event = db.events.find(e => Number(e.id) === Number(eventId));
  if (!event) return res.status(404).json({ message: 'Event not found.' });

  const user = db.users.find(u => String(u.id) === String(userId));
  if (!user) return res.status(404).json({ message: 'User not found.' });

  const registration = db.registrations.find(
    r => String(r.userId) === String(userId) && Number(r.eventId) === Number(eventId)
  );
  if (!registration) {
    return res.status(404).json({ message: 'Registration not found.' });
  }
  if (!registration.attendedAt) {
    return res.status(400).json({ message: 'Certificate is available only after event check-in.' });
  }

  try {
    const pdfBuffer = await generateCertificatePdfBuffer({
      participantName: user.name || 'Participant',
      eventName: event.name,
      eventDate: event.date,
      attendedAt: registration.attendedAt,
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="certificate-${event.id}-${String(user.name || 'participant').replace(/\s+/g, '-')}.pdf"`);
    return res.send(pdfBuffer);
  } catch (err) {
    return res.status(500).json({ message: 'Unable to generate certificate.', error: err.message });
  }
});

// ─── Auth Routes ──────────────────────────────────────────────────────────────




// Get user's registered events
app.get('/api/user/:userId/registrations', async (req, res) => {
  const { userId } = req.params;
  const db = await getDb();
  const registrations = db.registrations.filter(r => r.userId === userId);
  const events = registrations
    .map(registration => {
      const event = db.events.find(e => Number(e.id) === Number(registration.eventId));
      if (!event) return null;
      return {
        ...decorateEvent(db, event),
        registrationStatus: registration.status || 'confirmed',
        registrationTimestamp: registration.timestamp || null,
        attendedAt: registration.attendedAt || null,
        teamMembers: Array.isArray(registration.teamMembers) ? registration.teamMembers : [],
        teamLeader: registration.teamLeader || null,
      };
    })
    .filter(Boolean);
  res.json(events);
});

app.get('/api/public/profile/:slug', async (req, res) => {
  const slug = String(req.params.slug || '').trim().toLowerCase();
  if (!slug) return res.status(400).json({ message: 'Profile slug is required.' });

  const db = await getDb();
  const user = (db.users || []).find(u => getUserProfileSlug(u) === slug && u.isVerified !== false);
  if (!user) return res.status(404).json({ message: 'Profile not found.' });

  return res.json(toPublicProfile(user));
});

app.get('/api/user/:userId/student-projects', async (req, res) => {
  const { userId } = req.params;
  const db = await getDb();
  const user = db.users.find(u => String(u.id) === String(userId));
  if (!user) return res.status(404).json({ message: 'User not found.' });

  if (!Array.isArray(user.studentProjects)) user.studentProjects = [];
  await writeDb(db);
  return res.json(user.studentProjects);
});

app.post('/api/user/:userId/student-projects', async (req, res) => {
  const { userId } = req.params;
  const { title, summary, techStack, githubUrl, demoUrl } = req.body || {};
  if (!title || !summary) {
    return res.status(400).json({ message: 'title and summary are required.' });
  }

  const db = await getDb();
  const user = db.users.find(u => String(u.id) === String(userId));
  if (!user) return res.status(404).json({ message: 'User not found.' });

  if (!Array.isArray(user.studentProjects)) user.studentProjects = [];
  const project = {
    id: `sp-${Date.now()}`,
    title: String(title).trim().slice(0, 120),
    summary: String(summary).trim().slice(0, 400),
    techStack: String(techStack || '').trim().slice(0, 200),
    githubUrl: String(githubUrl || '').trim().slice(0, 300),
    demoUrl: String(demoUrl || '').trim().slice(0, 300),
    createdAt: new Date().toISOString(),
  };
  user.studentProjects.unshift(project);
  user.updatedAt = new Date().toISOString();

  await writeDb(db);
  return res.status(201).json(project);
});

app.delete('/api/user/:userId/student-projects/:projectId', async (req, res) => {
  const { userId, projectId } = req.params;
  const db = await getDb();
  const user = db.users.find(u => String(u.id) === String(userId));
  if (!user) return res.status(404).json({ message: 'User not found.' });

  if (!Array.isArray(user.studentProjects)) user.studentProjects = [];
  const index = user.studentProjects.findIndex(p => String(p.id) === String(projectId));
  if (index < 0) return res.status(404).json({ message: 'Project not found.' });

  user.studentProjects.splice(index, 1);
  user.updatedAt = new Date().toISOString();
  await writeDb(db);
  return res.json({ message: 'Project removed successfully.' });
});

app.put('/api/user/:userId/update-profile', async (req, res) => {
  const { userId } = req.params;
  const {
    name,
    collegeId,
    profilePhoto,
    bio,
    githubUrl,
    linkedinUrl,
    portfolioUrl,
    skills,
    profileSlug,
    profileVisibility,
    profileTheme,
    profileBannerUrl,
  } = req.body || {};

  const db = await getDb();
  const user = db.users.find(u => String(u.id) === String(userId));
  if (!user) {
    return res.status(404).json({ message: 'User not found.' });
  }

  if (name !== undefined) {
    const safeName = String(name).trim();
    if (!safeName) {
      return res.status(400).json({ message: 'Name cannot be empty.' });
    }
    user.name = safeName;
  }

  if (collegeId !== undefined) {
    const safeCollegeId = String(collegeId).trim();
    if (!safeCollegeId) {
      return res.status(400).json({ message: 'College ID cannot be empty.' });
    }
    user.collegeId = safeCollegeId;
  }

  if (profilePhoto !== undefined) {
    const photo = String(profilePhoto || '').trim();
    if (photo && !photo.startsWith('data:image/') && !/^https?:\/\//i.test(photo)) {
      return res.status(400).json({ message: 'Invalid profile photo format.' });
    }
    if (photo.length > 2_000_000) {
      return res.status(400).json({ message: 'Profile photo is too large.' });
    }
    user.profilePhoto = photo || null;
  }

  if (bio !== undefined) {
    user.bio = String(bio || '').trim().slice(0, 400);
  }

  if (profileSlug !== undefined) {
    const slug = slugify(profileSlug);
    if (!slug || slug.length < 3) {
      return res.status(400).json({ message: 'Profile URL slug must have at least 3 valid characters.' });
    }
    const collision = db.users.find(u => String(u.id) !== String(user.id) && getUserProfileSlug(u) === slug);
    if (collision) {
      return res.status(400).json({ message: 'This profile URL is already taken.' });
    }
    user.profileSlug = slug;
  }

  if (profileTheme !== undefined) {
    const allowedThemes = new Set(['default', 'ocean', 'sunset', 'forest', 'midnight']);
    const nextTheme = String(profileTheme || 'default').trim().toLowerCase();
    if (!allowedThemes.has(nextTheme)) {
      return res.status(400).json({ message: 'Invalid profile theme.' });
    }
    user.profileTheme = nextTheme;
  }

  if (profileBannerUrl !== undefined) {
    const banner = String(profileBannerUrl || '').trim();
    if (banner && !banner.startsWith('data:image/') && !/^https?:\/\//i.test(banner)) {
      return res.status(400).json({ message: 'Invalid profile banner URL format.' });
    }
    if (banner.length > 2_000_000) {
      return res.status(400).json({ message: 'Profile banner is too large.' });
    }
    user.profileBannerUrl = banner;
  }

  if (profileVisibility !== undefined) {
    const source = typeof profileVisibility === 'object' && profileVisibility ? profileVisibility : {};
    user.profileVisibility = {
      bio: source.bio !== false,
      skills: source.skills !== false,
      socials: source.socials !== false,
      projects: source.projects !== false,
    };
  }

  const validateOptionalUrl = (value, fieldName) => {
    const url = String(value || '').trim();
    if (!url) return '';
    if (!/^https?:\/\//i.test(url)) {
      throw new Error(`${fieldName} must start with http:// or https://`);
    }
    if (url.length > 300) {
      throw new Error(`${fieldName} is too long.`);
    }
    return url;
  };

  try {
    if (githubUrl !== undefined) {
      user.githubUrl = validateOptionalUrl(githubUrl, 'GitHub URL');
    }

    if (linkedinUrl !== undefined) {
      user.linkedinUrl = validateOptionalUrl(linkedinUrl, 'LinkedIn URL');
    }

    if (portfolioUrl !== undefined) {
      user.portfolioUrl = validateOptionalUrl(portfolioUrl, 'Portfolio URL');
    }
  } catch (err) {
    return res.status(400).json({ message: err.message || 'Invalid profile URL.' });
  }

  if (skills !== undefined) {
    const normalizedSkills = Array.isArray(skills)
      ? skills
      : String(skills || '').split(',');

    user.skills = normalizedSkills
      .map(skill => String(skill).trim())
      .filter(Boolean)
      .slice(0, 20);
  }

  user.updatedAt = new Date().toISOString();
  await writeDb(db);
  return res.json(toPublicUser(user));
});

// ─── Python Service Proxy (Skill Analyzer) ────────────────────────────────────
const SKILL_BUCKETS = [
  { key: 'foundation', weight: 1, keywords: ['html', 'css', 'javascript', 'js', 'git', 'github', 'sql', 'c', 'c++', 'cpp'] },
  { key: 'frameworks', weight: 2, keywords: ['react', 'node', 'express', 'fastapi', 'django', 'flask', 'spring', 'next', 'vite', 'tailwind'] },
  { key: 'advanced', weight: 3, keywords: ['typescript', 'aws', 'docker', 'kubernetes', 'microservice', 'redis', 'graphql', 'machine learning', 'ml', 'ai', 'devops'] },
];

const getGuildLevelFromScore = (score) => {
  if (score <= 4) return 'Novice';
  if (score <= 8) return 'Apprentice';
  if (score <= 13) return 'Journeyman';
  if (score <= 18) return 'Master';
  return 'Grandmaster';
};

const buildSkillAnalysis = ({ name, skills, source }) => {
  const normalizedSkills = Array.isArray(skills)
    ? [...new Set(skills.map(s => String(s).trim()).filter(Boolean))]
    : [];

  let score = 0;
  const matchedSkills = [];
  const bucketPresence = new Set();

  for (const rawSkill of normalizedSkills) {
    const skill = rawSkill.toLowerCase();
    let matchedBucket = null;

    for (const bucket of SKILL_BUCKETS) {
      if (bucket.keywords.some(keyword => skill.includes(keyword))) {
        matchedBucket = bucket;
      }
    }

    if (matchedBucket) {
      score += matchedBucket.weight;
      bucketPresence.add(matchedBucket.key);
      matchedSkills.push({ skill: rawSkill, bucket: matchedBucket.key, weight: matchedBucket.weight });
    } else {
      score += 1;
      matchedSkills.push({ skill: rawSkill, bucket: 'general', weight: 1 });
    }
  }

  const hasReact = normalizedSkills.some(s => /react/i.test(s));
  const hasNode = normalizedSkills.some(s => /node|express/i.test(s));
  const hasPythonWeb = normalizedSkills.some(s => /django|flask|fastapi/i.test(s));
  const diversityBonus = bucketPresence.size >= 3 ? 2 : 0;
  const stackBonus = (hasReact && (hasNode || hasPythonWeb)) ? 2 : 0;

  score += diversityBonus + stackBonus;
  const guildLevel = getGuildLevelFromScore(score);
  const displayName = String(name || 'Developer').trim() || 'Developer';
  const skillsText = normalizedSkills.length ? normalizedSkills.join(', ') : 'your submitted stack';

  return {
    name: displayName,
    guild_level: guildLevel,
    score,
    score_breakdown: {
      matchedSkills,
      diversityBonus,
      stackBonus,
    },
    analysis_basis: [
      'Each skill is weighted by complexity (foundation=1, frameworks=2, advanced=3).',
      'Diversity bonus (+2) is added for skills across at least 3 categories.',
      'Full-stack bonus (+2) is added for frontend + backend stack combinations.',
      'Final guild level is mapped from total score bands.',
    ],
    recommendation: `Based on your skills in ${skillsText}, your score is ${score} and we recommend ${displayName} for the ${guildLevel} tier of the Developers' Guild.`,
    source,
  };
};

const localSkillAnalysis = ({ name, skills }) => buildSkillAnalysis({ name, skills, source: 'node-fallback' });

const localAssistantReply = async ({ message, language, contextPath }) => {
  const db = await getDb();
  const normalized = String(message || '').toLowerCase();
  const isHindi = String(language || 'en').toLowerCase() === 'hi';
  const decoratedEvents = db.events.map(event => decorateEvent(db, event));
  const openEvents = decoratedEvents.filter(event => event.isOpen);
  const upcomingEvents = decoratedEvents
    .filter(event => new Date(event.date).getTime() >= Date.now())
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const pendingContacts = db.contactSubmissions.filter(c => c.status !== 'resolved').length;
  const pendingRegistrations = db.registrations.filter(r => r.status === 'pending').length;
  const membersCount = Array.isArray(db.memberDirectory) ? db.memberDirectory.length : 0;

  const aboutTitle = db.contentSettings?.aboutTitle || "The Developers' Guild";
  const aboutIntro = db.contentSettings?.aboutIntro
    || 'Official coding club of Accurate Institute of Management and Technology (AIMT), Greater Noida.';

  const make = (en, hi, action = null, suggestions = []) => ({
    reply: isHindi ? hi : en,
    action,
    suggestions,
  });

  if (/(admin\s*password|super\s*admin\s*password|admin\s*mail|admin\s*email|credential|secret|token|jwt|otp\s*code|पासवर्ड बताओ|एडमिन पासवर्ड|सीक्रेट|क्रेडेंशियल)/i.test(normalized)) {
    return make(
      'I cannot share passwords, emails, tokens, OTPs, or any private credentials. For admin access, use the official login and OTP verification flow from the Login page.',
      'मैं पासवर्ड, ईमेल, टोकन, OTP या कोई भी निजी क्रेडेंशियल साझा नहीं कर सकता। एडमिन एक्सेस के लिए Login पेज से आधिकारिक login और OTP verification flow का उपयोग करें।',
      '/login',
      ['/login', '/forgot-password', '/verify-email']
    );
  }

  if (/(about|guild|aimt|club|mission|team|website info|what is this site|इस वेबसाइट|गिल्ड|मिशन|क्लब)/i.test(normalized)) {
    const nextEvent = upcomingEvents[0];
    const nextEventText = nextEvent
      ? `${nextEvent.name} on ${new Date(nextEvent.date).toLocaleDateString('en-IN')}`
      : 'No upcoming event announced yet';

    return make(
      `${aboutTitle} is a student coding platform for AIMT with features for events, projects, team directory, contact support, user dashboards, public student profiles, and admin operations. ${aboutIntro} Current stats: ${db.projects.length} projects, ${decoratedEvents.length} events, ${membersCount} listed team members. Next event: ${nextEventText}.`,
      `${aboutTitle} AIMT का student coding platform है जिसमें events, projects, team directory, contact support, user dashboards, public student profiles और admin operations शामिल हैं। ${aboutIntro} अभी के stats: ${db.projects.length} projects, ${decoratedEvents.length} events, ${membersCount} team members। अगला event: ${nextEvent ? `${nextEvent.name} (${new Date(nextEvent.date).toLocaleDateString('en-IN')})` : 'अभी कोई upcoming event घोषित नहीं है'}।`,
      '/about',
      ['/about', '/events', '/projects', '/team']
    );
  }

  if (/(event|register|registration|waitlist|इवेंट|रजिस्टर|वेटलिस्ट)/i.test(normalized)) {
    return make(
      `There are ${openEvents.length} open events right now. You can register from the Events page, and if full, you will be added to waitlist automatically.`,
      `अभी ${openEvents.length} ओपन इवेंट्स हैं। आप Events पेज से रजिस्टर कर सकते हैं, और सीट फुल होने पर आप ऑटोमैटिक वेटलिस्ट में जुड़ जाएंगे।`,
      '/events',
      ['/events', '/dashboard']
    );
  }

  if (/(project|portfolio|प्रोजेक्ट)/i.test(normalized)) {
    return make(
      `We currently have ${db.projects.length} projects listed. Open Projects to explore details and tech stacks.`,
      `अभी ${db.projects.length} प्रोजेक्ट्स लिस्टेड हैं। Projects पेज पर जाकर डिटेल्स और टेक स्टैक देखें।`,
      '/projects',
      ['/projects']
    );
  }

  if (/(contact|support|help|issue|problem|संपर्क|मदद|समस्या)/i.test(normalized)) {
    return make(
      `You can submit your issue via Contact page. Current unresolved support items: ${pendingContacts}.`,
      `आप Contact पेज से अपनी समस्या भेज सकते हैं। अभी अनरिजॉल्व्ड सपोर्ट आइटम्स: ${pendingContacts}।`,
      '/contact',
      ['/contact']
    );
  }

  if (/(login|password|otp|verify|लॉगिन|पासवर्ड|ओटीपी|वेरिफाई)/i.test(normalized)) {
    return make(
      'Use Login for OTP flow, Forgot Password for reset, and Verify Email if your account is not verified.',
      'OTP लॉगिन के लिए Login इस्तेमाल करें, पासवर्ड रीसेट के लिए Forgot Password, और अकाउंट verify न हो तो Verify Email करें।',
      '/login',
      ['/login', '/forgot-password']
    );
  }

  if (/(dashboard|profile|डैशबोर्ड|प्रोफाइल)/i.test(normalized)) {
    return make(
      `Your dashboard helps with profile completion and registrations. Pending registrations across system: ${pendingRegistrations}.`,
      `डैशबोर्ड में प्रोफाइल completion और registrations दिखते हैं। पूरे सिस्टम में pending registrations: ${pendingRegistrations}।`,
      '/dashboard',
      ['/dashboard']
    );
  }

  if (/(admin|analytics|report|audit|एडमिन|रिपोर्ट|ऑडिट)/i.test(normalized)) {
    return make(
      'Admin panel includes analytics, reports, audit logs, content controls, member management, event/project operations, and notification workflows. Access is role and permission based.',
      'एडमिन पैनल में analytics, reports, audit logs, content controls, member management, event/project operations और notification workflows हैं। एक्सेस role और permission आधारित है।',
      '/admin',
      ['/admin']
    );
  }

  return make(
    `I can help with website info, events, registrations, login, projects, team details, support, and dashboard guidance. You are currently on ${contextPath || '/'}.`,
    `मैं वेबसाइट info, events, registration, login, projects, team details, support और dashboard में मदद कर सकता हूं। आप अभी ${contextPath || '/'} पेज पर हैं।`,
    null,
    ['/about', '/events', '/projects', '/team', '/contact', '/dashboard']
  );
};

app.post('/api/assistant/chat', chatLimiter, async (req, res) => {
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
    const response = await localAssistantReply({ message, language, contextPath });
    return res.json({
      ...response,
      source: 'backend-assistant',
      timestamp: new Date().toISOString(),
    });
  } catch {
    return res.status(500).json({ message: 'Assistant is temporarily unavailable.' });
  }
});

app.post('/api/analyze-skills', async (req, res) => {
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
      ...buildSkillAnalysis({ name: payload.name, skills: payload.skills, source: 'python-service' }),
      ...data,
      source: 'python-service',
    };
    return res.json(normalizedData);
  } catch (err) {
    const fallback = localSkillAnalysis(payload);
    return res.status(200).json(fallback);
  }
});

// ─── Start Server ─────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`✅  The Developers' Guild API running at http://localhost:${PORT}`);
});

// Trigger restart
