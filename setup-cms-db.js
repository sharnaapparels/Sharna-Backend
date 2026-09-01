const prisma = require('./src/config/database');
const fs = require('fs');
const path = require('path');

async function setup() {
  console.log('Connecting to PostgreSQL database...');

  // 1. Create table in Postgres
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "CmsConfig" (
      "key" VARCHAR(255) PRIMARY KEY,
      "data" JSONB NOT NULL,
      "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `);
  console.log('✅ "CmsConfig" table created/verified in PostgreSQL database.');

  // 2. Read existing homepage-cms.json
  const cmsFilePath = path.join(__dirname, './data/homepage-cms.json');
  if (fs.existsSync(cmsFilePath)) {
    const raw = fs.readFileSync(cmsFilePath, 'utf8');
    const data = JSON.parse(raw);
    
    // 3. Upsert into database
    await prisma.$executeRawUnsafe(`
      INSERT INTO "CmsConfig" ("key", "data", "updatedAt")
      VALUES ('homepage', $1::jsonb, NOW())
      ON CONFLICT ("key") DO UPDATE
      SET "data" = EXCLUDED."data", "updatedAt" = NOW();
    `, JSON.stringify(data));

    console.log('✅ Existing homepage CMS migrated to database table!');
  }

  // 4. Test fetch from database
  const rows = await prisma.$queryRawUnsafe(`
    SELECT "data", "updatedAt" FROM "CmsConfig" WHERE "key" = 'homepage' LIMIT 1;
  `);

  console.log('Fetched from PostgreSQL:', rows.length > 0 ? 'Success' : 'Empty');
  if (rows.length > 0) {
    console.log('Hero Slides in DB:', rows[0].data.heroSlides?.length || 0);
  }
}

setup().then(() => {
  console.log('🚀 Complete!');
  process.exit(0);
}).catch(err => {
  console.error('❌ Error setting up CmsConfig:', err);
  process.exit(1);
});
