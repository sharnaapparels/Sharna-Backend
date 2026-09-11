const fs = require('fs');
const path = require('path');
const prisma = require('../src/config/database');

const newHeroSlides = [
  {
    id: 'slide-1',
    title: '',
    subtitle: '',
    buttonText: 'SHOP COLLECTION',
    linkPath: '/collections',
    imageUrl: 'https://res.cloudinary.com/fcmtpwwu/image/upload/v1789098738/sharna_banners/ec1bhjbqrb0cematsh2w.webp',
    desktopImageUrl: 'https://res.cloudinary.com/fcmtpwwu/image/upload/v1789098738/sharna_banners/ec1bhjbqrb0cematsh2w.webp',
    mobileImageUrl: 'https://res.cloudinary.com/fcmtpwwu/image/upload/v1789098740/sharna_banners/fua4wa7jyjctpncvrazo.webp'
  },
  {
    id: 'slide-2',
    title: '',
    subtitle: '',
    buttonText: 'SHOP COLLECTION',
    linkPath: '/collections',
    imageUrl: 'https://res.cloudinary.com/fcmtpwwu/image/upload/v1789098741/sharna_banners/pp4mu80e0xqwjovg0zjg.webp',
    desktopImageUrl: 'https://res.cloudinary.com/fcmtpwwu/image/upload/v1789098741/sharna_banners/pp4mu80e0xqwjovg0zjg.webp',
    mobileImageUrl: 'https://res.cloudinary.com/fcmtpwwu/image/upload/v1789098744/sharna_banners/wsojnoxbtx8zlsqy08ty.webp'
  }
];

const cmsFilePath = path.join(__dirname, '../data/homepage-cms.json');
let current = {};
try {
  current = JSON.parse(fs.readFileSync(cmsFilePath, 'utf8'));
} catch (e) {}
current.heroSlides = newHeroSlides;
current.updatedAt = new Date().toISOString();
fs.writeFileSync(cmsFilePath, JSON.stringify(current, null, 2), 'utf8');
console.log('homepage-cms.json updated successfully!');

async function syncDb() {
  try {
    const existing = await prisma.cmsConfig.findUnique({ where: { key: 'homepage' } });
    if (existing) {
      const data = typeof existing.data === 'string' ? JSON.parse(existing.data) : (existing.data || {});
      data.heroSlides = newHeroSlides;
      data.updatedAt = new Date().toISOString();
      await prisma.cmsConfig.update({
        where: { key: 'homepage' },
        data: { data }
      });
      console.log('Prisma CmsConfig homepage updated in PostgreSQL DB!');
    } else {
      await prisma.cmsConfig.create({
        data: {
          key: 'homepage',
          data: current
        }
      });
      console.log('Prisma CmsConfig homepage created in PostgreSQL DB!');
    }
  } catch (err) {
    console.warn('Prisma DB sync notice:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}

syncDb();
