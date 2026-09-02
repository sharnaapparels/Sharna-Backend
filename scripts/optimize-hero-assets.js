const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

let assetsDir = 'd:/Sharna/Sharna-Frontend/src/assets';
if (!fs.existsSync(assetsDir)) {
  assetsDir = path.resolve(__dirname, '../../Sharna-Frontend/src/assets');
}
const originalDir = path.join(assetsDir, 'original');

if (!fs.existsSync(originalDir)) {
  fs.mkdirSync(originalDir, { recursive: true });
}

const imagesToProcess = [
  { name: 'hero-slide-1.png', type: 'desktop', width: 1920 },
  { name: 'hero-mobile-1.png', type: 'mobile', width: 900 },
  { name: 'hero-slide-2.png', type: 'desktop', width: 1920 },
  { name: 'hero-mobile-2.png', type: 'mobile', width: 900 },
  { name: 'hero-slide-3.png', type: 'desktop', width: 1920 },
  { name: 'hero-mobile-3.png', type: 'mobile', width: 900 },
  { name: 'about-hero.jpg', type: 'desktop', width: 1920 },
  { name: 'festive-1.png', type: 'general', width: 1000 },
  { name: 'festive-2.png', type: 'general', width: 1000 },
  { name: 'ready-1.png', type: 'general', width: 1000 },
  { name: 'ready-2.png', type: 'general', width: 1000 },
  { name: 'bridal-1.png', type: 'general', width: 1000 },
  { name: 'celebrity-1.png', type: 'general', width: 1000 },
  { name: 'reception-1.png', type: 'general', width: 1000 },
  { name: 'reception-2.png', type: 'general', width: 1000 }
];

async function run() {
  console.log('🚀 Starting Studio-Grade AVIF & WebP Asset Generator...');

  for (const item of imagesToProcess) {
    const srcPath = path.join(assetsDir, item.name);
    if (!fs.existsSync(srcPath)) {
      console.warn(`⚠️ Source file not found: ${item.name}`);
      continue;
    }

    const backupPath = path.join(originalDir, item.name);
    if (!fs.existsSync(backupPath)) {
      fs.copyFileSync(srcPath, backupPath);
      console.log(`📦 Preserved original master: original/${item.name}`);
    }

    const baseName = path.parse(item.name).name;
    const avifOut = path.join(assetsDir, `${baseName}.avif`);
    const webpOut = path.join(assetsDir, `${baseName}.webp`);

    try {
      const image = sharp(backupPath);
      const metadata = await image.metadata();

      let resizeOpts = {};
      if (metadata.width && metadata.width > item.width) {
        resizeOpts = { width: item.width, withoutEnlargement: true };
      }

      // 1. Generate AVIF (Quality 85, chromaSubsampling 4:4:4 for razor sharp edges)
      await sharp(backupPath)
        .resize(resizeOpts.width ? resizeOpts : undefined)
        .avif({
          quality: 85,
          effort: 6,
          chromaSubsampling: '4:4:4'
        })
        .toFile(avifOut);

      // 2. Generate WebP (Quality 86, smartSubsample for crisp details)
      await sharp(backupPath)
        .resize(resizeOpts.width ? resizeOpts : undefined)
        .webp({
          quality: 86,
          effort: 6,
          smartSubsample: true
        })
        .toFile(webpOut);

      const origStat = fs.statSync(backupPath);
      const avifStat = fs.statSync(avifOut);
      const webpStat = fs.statSync(webpOut);

      console.log(`✅ ${item.name}:`);
      console.log(`   Original: ${(origStat.size / 1024).toFixed(1)} KB`);
      console.log(`   AVIF:     ${(avifStat.size / 1024).toFixed(1)} KB (${((1 - avifStat.size / origStat.size) * 100).toFixed(0)}% reduction)`);
      console.log(`   WebP:     ${(webpStat.size / 1024).toFixed(1)} KB (${((1 - webpStat.size / origStat.size) * 100).toFixed(0)}% reduction)`);
    } catch (err) {
      console.error(`❌ Error processing ${item.name}:`, err.message);
    }
  }

  console.log('✨ All hero assets converted successfully with master quality preserved!');
}

run();
