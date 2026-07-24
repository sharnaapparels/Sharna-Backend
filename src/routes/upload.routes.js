const express = require('express');
const router = express.Router();
const { upload } = require('../config/cloudinary');
const { protect, adminOnly } = require('../middleware/auth.middleware');

// Upload single image
// POST /api/upload/single
router.post('/single', protect, adminOnly, upload.single('image'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }
    
    // req.file contains: path (Cloudinary URL), filename (Cloudinary public_id)
    res.json({
      success: true,
      message: 'Image uploaded successfully',
      url: req.file.path,
      publicId: req.file.filename
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Upload multiple images (up to 5)
// POST /api/upload/multiple
router.post('/multiple', protect, adminOnly, upload.array('images', 5), (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, message: 'No files uploaded' });
    }

    const uploadedImages = req.files.map(file => ({
      url: file.path,
      publicId: file.filename
    }));

    res.json({
      success: true,
      message: 'Images uploaded successfully',
      images: uploadedImages
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
