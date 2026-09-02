const express = require('express');
const { body } = require('express-validator');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { protect } = require('../middleware/auth.middleware');

// ─── Security Rate Limiters ──────────────────────────────────────────────────

// Password Login Brute-Force Limiter: Max 5 attempts per 15 mins per IP
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { success: false, message: 'Security Alert: Too many login attempts. Please try again after 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false
});

// OTP Guessing Protection Limiter: Max 5 attempts per 15 mins per IP
const otpVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { success: false, message: 'Security Alert: Too many incorrect OTP attempts. Please wait 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false
});

// OTP Request Spam Protection: Max 3 OTP dispatches per 15 mins per IP
const otpSendLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 3,
  message: { success: false, message: 'Too many OTP requests. Please wait 15 minutes before requesting again.' },
  standardHeaders: true,
  legacyHeaders: false
});

// ─── Register (Step 1: Create account + send OTP to WhatsApp) ────────────────
router.post('/register', otpSendLimiter, [
  body('name').notEmpty().withMessage('Name is required'),
  body('phone').notEmpty().withMessage('Phone number is required').isMobilePhone().withMessage('Invalid phone number'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('email').optional().isEmail().withMessage('Invalid email address')
], authController.register);

// ─── Verify OTP (Step 2: Activate account) ────────────────────────────────────
router.post('/verify-otp', otpVerifyLimiter, [
  body('phone').notEmpty().withMessage('Phone number is required'),
  body('otp').isLength({ min: 6, max: 6 }).withMessage('OTP must be 6 digits')
], authController.verifyOtp);

// ─── Login with Password (email or phone + password) ─────────────────────────
router.post('/login', loginLimiter, [
  body('identifier').notEmpty().withMessage('Email or phone is required'),
  body('password').notEmpty().withMessage('Password is required')
], authController.login);

// ─── Admin Two-Factor Authentication (2FA) Routes ────────────────────────────
router.post('/verify-admin-2fa', otpVerifyLimiter, [
  body('email').notEmpty().withMessage('Admin email is required'),
  body('otp').isLength({ min: 6, max: 6 }).withMessage('2FA OTP must be 6 digits')
], authController.verifyAdmin2FA);

router.post('/resend-admin-2fa', otpSendLimiter, [
  body('email').notEmpty().withMessage('Admin email is required')
], authController.resendAdmin2FA);

// ─── Send OTP for Login ───────────────────────────────────────────────────────
router.post('/send-otp', otpSendLimiter, [
  body('phone').notEmpty().withMessage('Phone number is required')
], authController.sendLoginOtp);

// ─── Login with OTP ───────────────────────────────────────────────────────────
router.post('/login-otp', otpVerifyLimiter, [
  body('phone').notEmpty().withMessage('Phone number is required'),
  body('otp').isLength({ min: 6, max: 6 }).withMessage('OTP must be 6 digits')
], authController.loginWithOtp);

// ─── Resend OTP ───────────────────────────────────────────────────────────────
router.post('/resend-otp', otpSendLimiter, [
  body('phone').notEmpty().withMessage('Phone number is required')
], authController.resendOtp);

// ─── Forgot / Reset Password Routes ──────────────────────────────────────────
router.post('/send-reset-otp', otpSendLimiter, authController.sendResetOtp);
router.post('/forgot-password', otpSendLimiter, authController.sendResetOtp);
router.post('/reset-password', otpVerifyLimiter, authController.resetPassword);

// ─── Refresh Token & Logout (HTTP-Only Secure Cookie Architecture) ───────────
router.post('/refresh', authController.refresh);
router.post('/logout', authController.logout);

// ─── Protected Routes ─────────────────────────────────────────────────────────
router.get('/me', protect, authController.getProfile);
router.put('/profile', protect, authController.updateProfile);
router.post('/address', protect, authController.saveAddress);

module.exports = router;
