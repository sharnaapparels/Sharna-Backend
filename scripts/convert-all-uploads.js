const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const uploadsDir = path.join(__dirname, '../public/uploads');
const cmsPath = path.join(__dirname, '../data/homepage-cms.json');

async function processUploads() {
  console.log('🚀 Converting all /public/uploads files to Studio-Grade AVIF & WebP...');

  if (!fs.existsSync(uploadsDir)) {
    console.log('No uploads directory found.');
    return;
  }

  const files = fs.readdirSync(uploadsDir);

  for (const file of files) {
    const ext = path.extname(file).toLowerCase();
    if (!['.png', '.jpg', '.jpeg'].includes(ext) || file.includes('-master') || file.includes('-mobile')) {
      continue;
    }

    const filePath = path.join(uploadsDir, file);
    const baseName = path.parse(file).name;
    const webpPath = path.join(uploadsDir, `${baseName}.webp`);
    const avifPath = path.join(uploadsDir, `${baseName}.avif`);
    const mobileWebpPath = path.join(uploadsDir, `${baseName}-mobile.webp`);
    const mobileAvifPath = path.join(uploadsDir, `${baseName}-mobile.avif`);

    const stat = fs.statSync(filePath);
    console.log(`\n📸 Processing: ${file} (${(stat.size / 1024 / 1024).toFixed(2)} MB)`);

    try {
      // 1. Desktop WebP (1920px, 86%)
      await sharp(filePath)
        .resize({ width: 1920, withoutEnlargement: true })
        .webp({ quality: 86, smartSubsample: true })
        .toFile(webpPath);

      // 2. Desktop AVIF (1920px, 85%)
      await sharp(filePath)
        .resize({ width: 1920, withoutEnlargement: true })
        .avif({ quality: 85, chromaSubsampling: '4:4:4' })
        .toFile(avifPath);

      // 3. Mobile WebP (900px, 86%)
      await sharp(filePath)
        .resize({ width: 900, withoutEnlargement: true })
        .webp({ quality: 86, smartSubsample: true })
        .toFile(mobileWebpPath);

      // 4. Mobile AVIF (900px, 85%)
      await sharp(filePath)
        .resize({ width: 900, withoutEnlargement: true })
        .avif({ quality: 85, chromaSubsampling: '4:4:4' })
        .toFile(mobileAvifPath);

      const webpStat = fs.statSync(webpPath);
      const avifStat = fs.statSync(avifPath);
      const mobWebpStat = fs.statSync(mobileWebpPath);
      const mobAvifStat = fs.statSync(mobileAvifPath);

      console.log(`   Desktop WebP: ${(webpStat.size / 1024).toFixed(1)} KB`);
      console.log(`   Desktop AVIF: ${(avifStat.size / 1024).toFixed(1)} KB`);
      console.log(`   Mobile WebP:  ${(mobWebpStat.size / 1024).toFixed(1)} KB`);
      console.log(`   Mobile AVIF:  ${(mobAvifStat.size / 1024).toFixed(1)} KB`);
    } catch (err) {
      console.error(`❌ Failed to convert ${file}:`, err.message);
    }
  }

  // Update homepage-cms.json to replace any .png with .webp
  if (fs.existsSync(cmsPath)) {
    let raw = fs.readFileSync(cmsPath, 'utf8');
    raw = raw.replace(/\.png/g, (match, offset, str) => {
      // Only replace inside upload URLs
      const before = str.substring(Math.max(0, offset - 100), offset);
      if (before.includes('/uploads/')) {
        return '.webp';
      }
      return match;
    });
    fs.writeFileSync(cmsPath, raw, 'utf8');
    console.log('\n✅ Updated homepage-cms.json to point to optimized .webp assets!');
  }

  console.log('\n✨ All uploads successfully optimized to AVIF and WebP!');
}

processUploads();
