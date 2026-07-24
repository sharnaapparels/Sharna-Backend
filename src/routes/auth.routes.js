const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { protect } = require('../middleware/auth.middleware');

// ─── Register (Step 1: Create account + send OTP to WhatsApp) ────────────────
router.post('/register', [
  body('name').notEmpty().withMessage('Name is required'),
  body('phone').notEmpty().withMessage('Phone number is required').isMobilePhone().withMessage('Invalid phone number'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('email').optional().isEmail().withMessage('Invalid email address')
], authController.register);

// ─── Verify OTP (Step 2: Activate account) ────────────────────────────────────
router.post('/verify-otp', [
  body('phone').notEmpty().withMessage('Phone number is required'),
  body('otp').isLength({ min: 6, max: 6 }).withMessage('OTP must be 6 digits')
], authController.verifyOtp);

// ─── Login with Password (email or phone + password) ─────────────────────────
router.post('/login', [
  body('identifier').notEmpty().withMessage('Email or phone is required'),
  body('password').notEmpty().withMessage('Password is required')
], authController.login);

// ─── Send OTP for Login ───────────────────────────────────────────────────────
router.post('/send-otp', [
  body('phone').notEmpty().withMessage('Phone number is required')
], authController.sendLoginOtp);

// ─── Login with OTP ───────────────────────────────────────────────────────────
router.post('/login-otp', [
  body('phone').notEmpty().withMessage('Phone number is required'),
  body('otp').isLength({ min: 6, max: 6 }).withMessage('OTP must be 6 digits')
], authController.loginWithOtp);

// ─── Resend OTP ───────────────────────────────────────────────────────────────
router.post('/resend-otp', [
  body('phone').notEmpty().withMessage('Phone number is required')
], authController.resendOtp);

// ─── Protected Routes ─────────────────────────────────────────────────────────
router.get('/me', protect, authController.getProfile);
router.put('/profile', protect, authController.updateProfile);
router.post('/address', protect, authController.saveAddress);

module.exports = router;
