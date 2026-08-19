const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const prisma = require('../config/database');
const { sendWhatsAppOTPText } = require('../utils/whatsapp.service');

// ─── Helpers ──────────────────────────────────────────────────────────────────

const generateToken = (userId, role = 'USER') =>
  jwt.sign({ id: userId, role }, process.env.JWT_SECRET || 'sharna_super_secure_jwt_secret_key_12345', { expiresIn: '30d' });

const generateAccessToken = (userId, role = 'USER') =>
  jwt.sign({ id: userId, role }, process.env.JWT_SECRET || 'sharna_super_secure_jwt_secret_key_12345', { expiresIn: '15m' });

const generateRefreshToken = (userId, role = 'USER') =>
  jwt.sign({ id: userId, role, type: 'refresh' }, process.env.JWT_SECRET || 'sharna_super_secure_jwt_secret_key_12345', { expiresIn: '7d' });

const setRefreshTokenCookie = (res, refreshToken) => {
  const isProduction = process.env.NODE_ENV === 'production';
  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'strict' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days in milliseconds
  });
};

const generateOTP = () =>
  Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit

const OTP_EXPIRY_MINUTES = 10;

const formatUserResponse = (user) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  phone: user.phone,
  role: user.role,
  isVerified: user.isVerified
});

// ─── REGISTER (Step 1: Create account + send OTP) ────────────────────────────
// POST /api/auth/register
exports.register = async (req, res) => {
  const { name, email, phone, password } = req.body;

  if (!phone) {
    return res.status(400).json({ success: false, message: 'Phone number is required for WhatsApp OTP verification' });
  }

  // Normalize email to null if empty/blank
  const normalizedEmail = (email && email.trim() !== '') ? email.trim().toLowerCase() : null;

  // Check if verified user exists with this phone or email
  const existingVerified = await prisma.user.findFirst({
    where: {
      OR: [
        { phone, isVerified: true },
        ...(normalizedEmail ? [{ email: normalizedEmail, isVerified: true }] : [])
      ]
    }
  });

  if (existingVerified) {
    return res.status(400).json({ 
      success: false, 
      message: 'An account with this phone/email already exists. Please Sign In instead.' 
    });
  }

  // Delete any unverified account that has the conflicting email (since email is unique)
  if (normalizedEmail) {
    const conflictingUnverified = await prisma.user.findFirst({
      where: { email: normalizedEmail, isVerified: false, NOT: { phone } }
    });
    if (conflictingUnverified) {
      await prisma.user.delete({ where: { id: conflictingUnverified.id } });
    }
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const otp = generateOTP();
  const hashedOtp = await bcrypt.hash(otp, 10);
  const otpExpires = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

  // Upsert: create or update unverified account
  const user = await prisma.user.upsert({
    where: { phone },
    update: {
      name, email: normalizedEmail, password: hashedPassword,
      otp: hashedOtp, otpExpires, otpPurpose: 'SIGNUP'
    },
    create: {
      name, email: normalizedEmail, phone, password: hashedPassword,
      otp: hashedOtp, otpExpires, otpPurpose: 'SIGNUP',
      isVerified: false
    }
  });

  // Log OTP in terminal for testing
  console.log(`\n=============================================`);
  console.log(`[TESTING OTP] Register OTP for ${phone}: ${otp}`);
  console.log(`=============================================\n`);

  // Send OTP via WhatsApp
  await sendWhatsAppOTPText(phone, otp);

  res.status(201).json({
    success: true,
    message: `OTP sent to WhatsApp number ${phone}. Please verify to complete registration.`,
    userId: user.id // needed for frontend to call verify-otp
  });
};

// ─── Failed OTP Attempt Lockout Helper ────────────────────────────────────────
const failedOtpAttempts = new Map(); // phone -> { count: number, lockUntil: timestamp }
const MAX_OTP_ATTEMPTS = 3;
const LOCKOUT_TIME_MS = 15 * 60 * 1000; // 15 minutes

const checkOtpLockout = (phone) => {
  const record = failedOtpAttempts.get(phone);
  if (!record) return null;
  if (Date.now() < record.lockUntil) {
    const remainingMins = Math.ceil((record.lockUntil - Date.now()) / 60000);
    return `Security Lockout: 3 failed OTP attempts exceeded. Please wait ${remainingMins} minute(s) before trying again.`;
  }
  failedOtpAttempts.delete(phone);
  return null;
};

const registerFailedOtpAttempt = (phone) => {
  const record = failedOtpAttempts.get(phone) || { count: 0, lockUntil: 0 };
  record.count += 1;
  if (record.count >= MAX_OTP_ATTEMPTS) {
    record.lockUntil = Date.now() + LOCKOUT_TIME_MS;
    failedOtpAttempts.set(phone, record);
    return { isLocked: true, message: 'Security Lockout: 3 incorrect OTP attempts entered. Account locked for 15 minutes.' };
  }
  failedOtpAttempts.set(phone, record);
  const attemptsLeft = MAX_OTP_ATTEMPTS - record.count;
  return { isLocked: false, message: `Invalid OTP. ${attemptsLeft} attempt(s) remaining before a 15-minute lockout.` };
};

const resetOtpAttempts = (phone) => {
  failedOtpAttempts.delete(phone);
};

// ─── VERIFY OTP (Step 2: Verify OTP after register) ─────────────────────────
// POST /api/auth/verify-otp
exports.verifyOtp = async (req, res) => {
  const { phone, otp } = req.body;

  // 1. Check if user is currently locked out from too many failed OTP attempts
  const lockoutMsg = checkOtpLockout(phone);
  if (lockoutMsg) {
    return res.status(429).json({ success: false, message: lockoutMsg });
  }

  const user = await prisma.user.findUnique({ where: { phone } });

  if (!user) {
    return res.status(404).json({ success: false, message: 'No account found with this phone number' });
  }

  if (!user.otp || !user.otpExpires) {
    return res.status(400).json({ success: false, message: 'No OTP requested. Please register again.' });
  }

  if (new Date() > user.otpExpires) {
    return res.status(400).json({ success: false, message: 'OTP has expired. Please request a new one.' });
  }

  const isMatch = await bcrypt.compare(otp, user.otp);
  if (!isMatch) {
    const lockResult = registerFailedOtpAttempt(phone);
    const status = lockResult.isLocked ? 429 : 400;
    return res.status(status).json({ success: false, message: lockResult.message });
  }

  // Clear attempts on success
  resetOtpAttempts(phone);

  // Mark account as verified & clear OTP
  const verifiedUser = await prisma.user.update({
    where: { phone },
    data: { isVerified: true, otp: null, otpExpires: null, otpPurpose: null }
  });

  const accessToken = generateAccessToken(verifiedUser.id, verifiedUser.role);
  const refreshToken = generateRefreshToken(verifiedUser.id, verifiedUser.role);
  setRefreshTokenCookie(res, refreshToken);

  res.json({
    success: true,
    message: 'Account verified successfully!',
    token: accessToken,
    accessToken,
    user: formatUserResponse(verifiedUser)
  });
};

// Helper for case-insensitive email and multi-format phone lookup across all devices
const findUserByIdentifier = async (rawIdentifier) => {
  if (!rawIdentifier) return null;
  const trimmed = rawIdentifier.trim();
  const lower = trimmed.toLowerCase();
  const digitsOnly = trimmed.replace(/\D/g, '');
  const tenDigitPhone = digitsOnly.length >= 10 ? digitsOnly.slice(-10) : digitsOnly;

  const phoneVariations = Array.from(new Set([
    trimmed,
    digitsOnly,
    tenDigitPhone,
    `+91${tenDigitPhone}`,
    `91${tenDigitPhone}`
  ])).filter(Boolean);

  return await prisma.user.findFirst({
    where: {
      OR: [
        { email: lower },
        { email: trimmed },
        { phone: { in: phoneVariations } }
      ]
    },
    orderBy: [
      { isVerified: 'desc' },
      { createdAt: 'desc' }
    ]
  });
};

// ─── SEND LOGIN OTP ─────────────────────────────────────────────────────────
// POST /api/auth/send-otp
exports.sendLoginOtp = async (req, res) => {
  const { phone } = req.body;

  if (!phone) {
    return res.status(400).json({ success: false, message: 'Phone number is required' });
  }

  // Check lockout before sending new OTP
  const lockoutMsg = checkOtpLockout(phone);
  if (lockoutMsg) {
    return res.status(429).json({ success: false, message: lockoutMsg });
  }

  const user = await findUserByIdentifier(phone);

  if (!user) {
    return res.status(404).json({ success: false, message: 'No account found with this number. Please sign up first.' });
  }

  if (user.isBlocked) {
    return res.status(401).json({ success: false, message: 'Account is blocked' });
  }

  const otp = generateOTP();
  const hashedOtp = await bcrypt.hash(otp, 10);
  const otpExpires = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

  await prisma.user.update({
    where: { id: user.id },
    data: { otp: hashedOtp, otpExpires, otpPurpose: 'LOGIN' }
  });

  // Log OTP in terminal for testing
  console.log(`\n=============================================`);
  console.log(`[TESTING OTP] Login OTP for ${phone}: ${otp}`);
  console.log(`=============================================\n`);

  await sendWhatsAppOTPText(user.phone || phone, otp);

  res.json({
    success: true,
    message: `OTP sent to WhatsApp number ${phone}`
  });
};

// ─── LOGIN WITH OTP ─────────────────────────────────────────────────────────
// POST /api/auth/login-otp
exports.loginWithOtp = async (req, res) => {
  const { phone, otp } = req.body;

  // Check lockout
  const lockoutMsg = checkOtpLockout(phone);
  if (lockoutMsg) {
    return res.status(429).json({ success: false, message: lockoutMsg });
  }

  const user = await findUserByIdentifier(phone);

  if (!user || user.isBlocked) {
    return res.status(401).json({ success: false, message: 'Account not found or blocked' });
  }

  if (!user.otp || !user.otpExpires) {
    return res.status(400).json({ success: false, message: 'No OTP requested. Please request one first.' });
  }

  if (new Date() > user.otpExpires) {
    return res.status(400).json({ success: false, message: 'OTP expired. Please request a new one.' });
  }

  const isMatch = await bcrypt.compare(otp, user.otp);
  if (!isMatch) {
    const lockResult = registerFailedOtpAttempt(phone);
    const status = lockResult.isLocked ? 429 : 400;
    return res.status(status).json({ success: false, message: lockResult.message });
  }

  // Clear attempts on success
  resetOtpAttempts(phone);

  // Clear OTP after use
  const loggedUser = await prisma.user.update({
    where: { id: user.id },
    data: { otp: null, otpExpires: null, otpPurpose: null, isVerified: true }
  });

  res.json({
    success: true,
    token: generateToken(loggedUser.id),
    user: formatUserResponse(loggedUser)
  });
};


// ─── LOGIN WITH PASSWORD ─────────────────────────────────────────────────────
// POST /api/auth/login
exports.login = async (req, res) => {
  const rawIdentifier = (req.body.identifier || req.body.email || req.body.phone || '').trim();
  const password = (req.body.password || '').trim();

  if (!rawIdentifier || !password) {
    return res.status(400).json({ success: false, message: 'Email/phone and password are required' });
  }

  // Find user by email OR phone using flexible format matcher
  const user = await findUserByIdentifier(rawIdentifier);

  if (!user) {
    return res.status(401).json({ 
      success: false, 
      message: 'Invalid email/phone or password. Please check your credentials.' 
    });
  }

  if (user.isBlocked) {
    return res.status(403).json({ success: false, message: 'Your account has been suspended. Please contact customer support.' });
  }

  if (!user.password) {
    return res.status(401).json({ 
      success: false, 
      message: 'No password set on this account. Please log in using WhatsApp OTP or reset your password.' 
    });
  }

  // Compare hashed password with bcrypt
  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    return res.status(401).json({ success: false, message: 'Incorrect password. Please try again.' });
  }

  const accessToken = generateAccessToken(user.id, user.role);
  const refreshToken = generateRefreshToken(user.id, user.role);
  setRefreshTokenCookie(res, refreshToken);

  res.json({
    success: true,
    token: accessToken,
    accessToken,
    user: formatUserResponse(user)
  });
};

// ─── REFRESH TOKEN (POST /api/auth/refresh) ─────────────────────────
exports.refresh = async (req, res) => {
  try {
    const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;
    if (!refreshToken) {
      return res.status(401).json({ success: false, message: 'Refresh token missing' });
    }

    const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET || 'sharna_super_secure_jwt_secret_key_12345');
    const user = await prisma.user.findUnique({ where: { id: decoded.id } });

    if (!user || user.isBlocked) {
      return res.status(401).json({ success: false, message: 'User unauthorized or account blocked' });
    }

    const newAccessToken = generateAccessToken(user.id, user.role);
    const newRefreshToken = generateRefreshToken(user.id, user.role);
    setRefreshTokenCookie(res, newRefreshToken);

    res.json({
      success: true,
      token: newAccessToken,
      accessToken: newAccessToken,
      user: formatUserResponse(user)
    });
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid or expired refresh token' });
  }
};

// ─── LOGOUT (POST /api/auth/logout) ─────────────────────────────────
exports.logout = async (req, res) => {
  const isProduction = process.env.NODE_ENV === 'production';
  res.clearCookie('refreshToken', {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'strict' : 'lax'
  });
  res.json({ success: true, message: 'Logged out successfully' });
};

// ─── GET PROFILE ─────────────────────────────────────────────────────────────
// GET /api/auth/me
exports.getProfile = async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    include: { addresses: true },
    omit: { password: true, otp: true, otpExpires: true }
  });
  res.json({ success: true, user });
};

// ─── UPDATE PROFILE ───────────────────────────────────────────────────────────
// PUT /api/auth/profile
exports.updateProfile = async (req, res) => {
  const data = {};
  if (req.body.name) data.name = req.body.name;
  if (req.body.password) data.password = await bcrypt.hash(req.body.password, 10);

  const user = await prisma.user.update({
    where: { id: req.user.id },
    data
  });

  res.json({ success: true, user: formatUserResponse(user) });
};

// ─── RESEND OTP ──────────────────────────────────────────────────────────────
// POST /api/auth/resend-otp
exports.resendOtp = async (req, res) => {
  const { phone } = req.body;

  if (!phone) {
    return res.status(400).json({ success: false, message: 'Phone number is required' });
  }

  // Rate-limit check to prevent WhatsApp API spam
  const lockoutMsg = checkOtpLockout(phone);
  if (lockoutMsg) {
    return res.status(429).json({ success: false, message: lockoutMsg });
  }

  const user = await prisma.user.findUnique({ where: { phone } });

  if (!user) {
    return res.status(404).json({ success: false, message: 'No account found with this phone' });
  }

  const otp = generateOTP();
  const hashedOtp = await bcrypt.hash(otp, 10);
  const otpExpires = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

  await prisma.user.update({
    where: { phone },
    data: { otp: hashedOtp, otpExpires, otpPurpose: user.isVerified ? 'LOGIN' : 'SIGNUP' }
  });

  // Log OTP in terminal for testing
  console.log(`\n=============================================`);
  console.log(`[TESTING OTP] Resend OTP for ${phone}: ${otp}`);
  console.log(`=============================================\n`);

  await sendWhatsAppOTPText(phone, otp);

  res.json({ success: true, message: `New OTP sent to ${phone}` });
};

// POST /api/auth/address
exports.saveAddress = async (req, res) => {
  const { street, city, state, postalCode, country } = req.body;

  if (!street || !city || !state || !postalCode) {
    return res.status(400).json({ success: false, message: 'Street, city, state, and postal code are required' });
  }

  try {
    const existingAddress = await prisma.address.findFirst({
      where: { userId: req.user.id }
    });

    let address;
    if (existingAddress) {
      address = await prisma.address.update({
        where: { id: existingAddress.id },
        data: {
          street,
          city,
          state,
          postalCode,
          country: country || 'India'
        }
      });
    } else {
      address = await prisma.address.create({
        data: {
          userId: req.user.id,
          street,
          city,
          state,
          postalCode,
          country: country || 'India',
          isDefault: true
        }
      });
    }

    res.json({ success: true, address });
  } catch (err) {
    console.error("Save address failed:", err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
