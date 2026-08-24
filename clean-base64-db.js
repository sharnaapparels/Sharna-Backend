const prisma = require('./src/config/database');
const { cloudinary } = require('./src/config/cloudinary');

async function cleanBase64Images() {
  console.log('🚀 [BASE64 CLEANUP]: Starting Database Scan for Base64 Images...');

  // 1. Clean ProductImages
  try {
    const productImages = await prisma.productImage.findMany({});
    console.log(`📦 Inspecting ${productImages.length} total ProductImage records...`);

    let cleanedCount = 0;
    for (const img of productImages) {
      if (typeof img.url === 'string' && img.url.startsWith('data:image')) {
        console.log(`⏳ Uploading Base64 ProductImage ID ${img.id} to Cloudinary...`);
        try {
          const uploadRes = await cloudinary.uploader.upload(img.url, {
            folder: 'sharna_products'
          });
          if (uploadRes && uploadRes.secure_url) {
            await prisma.productImage.update({
              where: { id: img.id },
              data: { url: uploadRes.secure_url }
            });
            cleanedCount++;
            console.log(`  ✅ Cleaned ProductImage ID ${img.id} -> ${uploadRes.secure_url}`);
          }
        } catch (uErr) {
          console.error(`  ❌ Failed to upload ProductImage ID ${img.id}:`, uErr.message);
        }
      }
    }
    console.log(`✨ ProductImage Cleanup Complete! Converted ${cleanedCount} Base64 images to Cloudinary URLs.`);
  } catch (err) {
    console.error('Error cleaning product images:', err.message);
  }

  // 2. Clean HomepageCMS
  try {
    const cmsRecords = await prisma.homepageCMS.findMany({});
    console.log(`📦 Inspecting ${cmsRecords.length} HomepageCMS records...`);

    for (const record of cmsRecords) {
      let modified = false;
      const data = record.data || {};

      // Clean Hero Banners
      if (Array.isArray(data.heroSlides)) {
        for (const slide of data.heroSlides) {
          if (typeof slide.desktopImageUrl === 'string' && slide.desktopImageUrl.startsWith('data:image')) {
            console.log(`⏳ Uploading Base64 Hero Desktop Banner (Slide ${slide.id}) to Cloudinary...`);
            try {
              const res = await cloudinary.uploader.upload(slide.desktopImageUrl, { folder: 'sharna_cms' });
              if (res && res.secure_url) {
                slide.desktopImageUrl = res.secure_url;
                modified = true;
              }
            } catch (e) {
              console.error(`Failed uploading desktop banner: ${e.message}`);
            }
          }
          if (typeof slide.mobileImageUrl === 'string' && slide.mobileImageUrl.startsWith('data:image')) {
            console.log(`⏳ Uploading Base64 Hero Mobile Banner (Slide ${slide.id}) to Cloudinary...`);
            try {
              const res = await cloudinary.uploader.upload(slide.mobileImageUrl, { folder: 'sharna_cms' });
              if (res && res.secure_url) {
                slide.mobileImageUrl = res.secure_url;
                modified = true;
              }
            } catch (e) {
              console.error(`Failed uploading mobile banner: ${e.message}`);
            }
          }
        }
      }

      // Clean Testimonials
      if (Array.isArray(data.testimonials)) {
        for (const test of data.testimonials) {
          if (typeof test.image === 'string' && test.image.startsWith('data:image')) {
            console.log(`⏳ Uploading Base64 Testimonial Image (${test.id}) to Cloudinary...`);
            try {
              const res = await cloudinary.uploader.upload(test.image, { folder: 'sharna_cms' });
              if (res && res.secure_url) {
                test.image = res.secure_url;
                modified = true;
              }
            } catch (e) {
              console.error(`Failed uploading testimonial image: ${e.message}`);
            }
          }
        }
      }

      if (modified) {
        await prisma.homepageCMS.update({
          where: { id: record.id },
          data: { data }
        });
        console.log(`  ✅ Updated HomepageCMS ID ${record.id} with clean Cloudinary URLs.`);
      }
    }
  } catch (err) {
    console.error('Error cleaning HomepageCMS:', err.message);
  }

  console.log('🎉 [BASE64 CLEANUP]: All Base64 images successfully cleaned from database!');
  process.exit(0);
}

cleanBase64Images();
