const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { cloudinary, upload, uploadsDir } = require('../config/cloudinary');
const { protect, adminOnly, optionalAuth } = require('../middleware/auth.middleware');

const sharp = require('sharp');

const uploadFileToCloudinaryOrDisk = async (req, file, folderName = 'sharna_uploads') => {
  if (!file || !file.buffer) return null;

  // 1. Try Cloudinary upload via data URI
  if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY) {
    try {
      const b64 = Buffer.from(file.buffer).toString('base64');
      const dataURI = `data:${file.mimetype};base64,${b64}`;
      const res = await cloudinary.uploader.upload(dataURI, {
        folder: folderName
      });
      if (res && res.secure_url) {
        return res.secure_url;
      }
    } catch (cErr) {
      console.warn('Cloudinary upload fallback to local disk:', cErr.message);
    }
  }

  // 2. Fallback to local disk storage with Sharp AVIF & WebP optimization
  const timestamp = Date.now();
  const rand = Math.round(Math.random() * 1e9);
  const baseName = `${folderName}-${timestamp}-${rand}`;

  const masterPath = path.join(uploadsDir, `${baseName}-master${path.extname(file.originalname) || '.png'}`);
  const webpPath = path.join(uploadsDir, `${baseName}.webp`);
  const avifPath = path.join(uploadsDir, `${baseName}.avif`);
  const mobileWebpPath = path.join(uploadsDir, `${baseName}-mobile.webp`);
  const mobileAvifPath = path.join(uploadsDir, `${baseName}-mobile.avif`);

  // Preserve raw master
  try {
    fs.writeFileSync(masterPath, file.buffer);
  } catch (_) {}

  try {
    // ⚡ Fast Parallel WebP Transcoding (Responds in < 300ms)
    await Promise.all([
      sharp(file.buffer)
        .resize({ width: 2560, withoutEnlargement: true })
        .webp({ quality: 92, effort: 3, smartSubsample: true })
        .toFile(webpPath),
      sharp(file.buffer)
        .resize({ width: 1440, withoutEnlargement: true })
        .webp({ quality: 90, effort: 3, smartSubsample: true })
        .toFile(mobileWebpPath)
    ]);

    // 🚀 Background Non-Blocking AVIF Generation (Doesn't delay the upload response!)
    Promise.all([
      sharp(file.buffer)
        .resize({ width: 2560, withoutEnlargement: true })
        .avif({ quality: 90, effort: 2, chromaSubsampling: '4:4:4' })
        .toFile(avifPath),
      sharp(file.buffer)
        .resize({ width: 1440, withoutEnlargement: true })
        .avif({ quality: 88, effort: 2, chromaSubsampling: '4:4:4' })
        .toFile(mobileAvifPath)
    ]).catch(err => console.warn('Background AVIF gen notice:', err.message));

    const protocol = req.protocol || 'http';
    const host = req.get('host') || 'localhost:5008';
    return `${protocol}://${host}/uploads/${baseName}.webp`;
  } catch (optErr) {
    console.warn('Sharp optimization fallback to raw png:', optErr.message);
    const fallbackPath = path.join(uploadsDir, `${baseName}.png`);
    fs.writeFileSync(fallbackPath, file.buffer);
    const protocol = req.protocol || 'http';
    const host = req.get('host') || 'localhost:5008';
    return `${protocol}://${host}/uploads/${baseName}.png`;
  }
};

// Upload single image (Admin only)
// POST /api/upload/single
router.post('/single', protect, adminOnly, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }
    
    const fileUrl = await uploadFileToCloudinaryOrDisk(req, req.file, 'sharna_products');
    res.json({
      success: true,
      message: 'Image uploaded successfully',
      url: fileUrl
    });
  } catch (error) {
    console.error('Single Upload Error:', error.message);
    res.status(500).json({ success: false, message: 'Upload failed', error: error.message });
  }
});

// Upload customer review image (Supports Logged In & Guest Reviewers)
// POST /api/upload/review
router.post('/review', optionalAuth, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }
    
    const fileUrl = await uploadFileToCloudinaryOrDisk(req, req.file, 'sharna_reviews');
    res.json({
      success: true,
      message: 'Review image uploaded successfully',
      url: fileUrl
    });
  } catch (error) {
    console.error('Review Upload Error:', error.message);
    res.status(500).json({ success: false, message: 'Upload failed', error: error.message });
  }
});

// Upload multiple images (Admin only) (up to 5)
// POST /api/upload/multiple
router.post('/multiple', protect, adminOnly, upload.array('images', 5), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, message: 'No files uploaded' });
    }

    const uploadPromises = req.files.map(file => uploadFileToCloudinaryOrDisk(req, file, 'sharna_products'));
    const urls = await Promise.all(uploadPromises);

    const uploadedImages = urls.map(url => ({ url }));

    res.json({
      success: true,
      message: 'Images uploaded successfully',
      images: uploadedImages
    });
  } catch (error) {
    console.error('Multiple Upload Error:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/upload/cloudinary-signature (Admin only - Direct browser to Cloudinary upload)
router.get('/cloudinary-signature', protect, adminOnly, (req, res) => {
  try {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    if (!cloudName || !apiKey || !apiSecret) {
      return res.status(503).json({ success: false, message: 'Cloudinary direct credentials not configured on server' });
    }

    const folder = req.query.folder || 'sharna_banners';
    const timestamp = Math.round(new Date().getTime() / 1000);

    const signature = cloudinary.utils.api_sign_request(
      {
        timestamp: timestamp,
        folder: folder
      },
      apiSecret
    );

    res.json({
      success: true,
      signature,
      timestamp,
      apiKey,
      cloudName,
      folder
    });
  } catch (error) {
    console.error('Cloudinary Signature Error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to generate upload signature', error: error.message });
  }
});

module.exports = router;
