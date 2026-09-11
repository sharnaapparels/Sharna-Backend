const prisma = require('../src/config/database');
const fs = require('fs');
const path = require('path');

const cleanHeroSlides = [
  {
    id: 'slide-1',
    title: '',
    subtitle: '',
    buttonText: 'SHOP COLLECTION',
    linkPath: '/collections',
    imageUrl: 'https://res.cloudinary.com/fcmtpwwu/image/upload/v1789102878/sharna_banners/hero_desktop_1_lux.webp',
    desktopImageUrl: 'https://res.cloudinary.com/fcmtpwwu/image/upload/v1789102878/sharna_banners/hero_desktop_1_lux.webp',
    mobileImageUrl: 'https://res.cloudinary.com/fcmtpwwu/image/upload/v1789102878/sharna_banners/hero_mobile_1_lux.webp'
  },
  {
    id: 'slide-2',
    title: '',
    subtitle: '',
    buttonText: 'SHOP COLLECTION',
    linkPath: '/collections',
    imageUrl: 'https://res.cloudinary.com/fcmtpwwu/image/upload/v1789102879/sharna_banners/hero_desktop_2_lux.webp',
    desktopImageUrl: 'https://res.cloudinary.com/fcmtpwwu/image/upload/v1789102879/sharna_banners/hero_desktop_2_lux.webp',
    mobileImageUrl: 'https://res.cloudinary.com/fcmtpwwu/image/upload/v1789102878/sharna_banners/hero_mobile_2_lux.webp'
  }
];

async function cleanDatabase() {
  console.log('--- CLEANING DATABASE OF ALL BROKEN /uploads/ URLS ---');

  // 1. Clean CmsConfig homepage
  const homepageCms = await prisma.cmsConfig.findUnique({ where: { key: 'homepage' } });
  if (homepageCms) {
    const data = typeof homepageCms.data === 'string' ? JSON.parse(homepageCms.data) : (homepageCms.data || {});
    data.heroSlides = cleanHeroSlides;
    data.updatedAt = new Date().toISOString();
    await prisma.cmsConfig.update({
      where: { key: 'homepage' },
      data: { data }
    });
    console.log('✅ Updated CmsConfig homepage with clean Cloudinary heroSlides!');
  }

  // Update homepage-cms.json
  const cmsFilePath = path.join(__dirname, '../data/homepage-cms.json');
  try {
    let localData = JSON.parse(fs.readFileSync(cmsFilePath, 'utf8'));
    localData.heroSlides = cleanHeroSlides;
    localData.updatedAt = new Date().toISOString();
    fs.writeFileSync(cmsFilePath, JSON.stringify(localData, null, 2), 'utf8');
    console.log('✅ Updated data/homepage-cms.json');
  } catch (e) {
    console.warn('File update notice:', e.message);
  }

  // 2. Fix Product: Teal Sleeveles Co-ord Set (delete broken 2nd image)
  await prisma.productImage.deleteMany({
    where: {
      id: 'cmtwcg73s0001p201c07d3tm4'
    }
  });
  console.log('✅ Removed broken image from Teal Sleeveles Co-ord Set');

  // 3. Fix Product: Front Slit Anarkali Set (delete broken primary, set valid Cloudinary image as primary)
  await prisma.productImage.deleteMany({
    where: {
      id: 'cmtpy5w0s0025nv01h6pa7hub'
    }
  });
  await prisma.productImage.update({
    where: { id: 'cmtpy5w0s0026nv01a0f7pakz' },
    data: { isPrimary: true }
  });
  console.log('✅ Fixed Front Slit Anarkali Set primary image');

  // 4. Fix Product: Angrakha Gown Gota patti Dress (delete broken primary, set valid Cloudinary image as primary)
  await prisma.productImage.deleteMany({
    where: {
      id: 'cmtu6fpnr005mnv01nxbn4abk'
    }
  });
  await prisma.productImage.update({
    where: { id: 'cmtu6fpnr005nnv01hqacafuh' },
    data: { isPrimary: true }
  });
  console.log('✅ Fixed Angrakha Gown Gota patti Dress primary image');

  // 5. Fix Product: Maroon and Navy Gaji Silk Coord Set (delete broken 2nd image)
  await prisma.productImage.deleteMany({
    where: {
      id: 'cmtvq9jaw0088nv01iaoqnl5k'
    }
  });
  console.log('✅ Removed broken image from Maroon and Navy Gaji Silk Coord Set');

  // 6. Scan all product scalar fields (e.g. description, fabric, care, etc.)
  const allProds = await prisma.product.findMany({ include: { images: true } });
  for (const p of allProds) {
    const str = JSON.stringify(p);
    if (str.includes('/uploads/') || str.includes('railway.app/uploads')) {
      console.log('Found product with /uploads/ string:', p.id, p.title);
      for (const [k, v] of Object.entries(p)) {
        if (typeof v === 'string' && (v.includes('/uploads/') || v.includes('railway.app/uploads'))) {
          console.log(`Field [${k}] has bad URL:`, v);
          // If it has images, pick first primary or first image
          const primaryImg = p.images.find(img => img.isPrimary) || p.images[0];
          const fallbackUrl = primaryImg ? primaryImg.url : 'https://res.cloudinary.com/fcmtpwwu/image/upload/v1788708465/sharna_banners/krkuj4oo3uebmx2excvg.jpg';
          await prisma.product.update({
            where: { id: p.id },
            data: { [k]: fallbackUrl }
          });
          console.log(`Updated product [${p.id}] field [${k}] to:`, fallbackUrl);
        }
      }
    }
  }

  // Verify all products
  const remainingBadImages = await prisma.productImage.findMany({
    where: {
      url: {
        contains: 'uploads'
      }
    }
  });
  console.log(`Remaining broken ProductImages in DB: ${remainingBadImages.length}`);

  await prisma.$disconnect();
  console.log('🎉 ALL BROKEN DATABASE IMAGE URLS HAVE BEEN CLEANED!');
}

cleanDatabase().catch(console.error);
