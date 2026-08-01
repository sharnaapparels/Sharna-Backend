const express = require('express');
const router = express.Router();
const contactController = require('../controllers/contact.controller');
const { protect, adminOnly, optionalAuth } = require('../middleware/auth.middleware');

const { body, validationResult } = require('express-validator');

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array().map(e => ({ field: e.path, message: e.msg }))
    });
  }
  next();
};

router.post(
  '/',
  optionalAuth,
  [
    body('name').trim().notEmpty().withMessage('Name is required').isLength({ min: 2, max: 100 }).withMessage('Name must be 2-100 characters'),
    body('email').trim().notEmpty().withMessage('Email is required').isEmail().withMessage('Must be a valid email address'),
    body('message').trim().notEmpty().withMessage('Message is required').isLength({ min: 5, max: 2000 }).withMessage('Message must be 5-2000 characters'),
    body('phone').optional({ checkFalsy: true }).isMobilePhone().withMessage('Invalid phone number format')
  ],
  handleValidationErrors,
  contactController.submitContact
);
router.get('/', protect, adminOnly, contactController.getAllContacts);
router.patch('/:id/status', protect, adminOnly, contactController.updateContactStatus);
router.delete('/:id', protect, adminOnly, contactController.deleteContact);


module.exports = router;
