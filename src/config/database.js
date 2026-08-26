require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

let dbUrl = process.env.DATABASE_URL || '';

// If connection_limit is not explicitly provided in DATABASE_URL, set conservative defaults for Supabase transaction pooler (port 6543)
if (dbUrl) {
  const urlObj = new URL(dbUrl);
  if (!urlObj.searchParams.has('connection_limit')) {
    urlObj.searchParams.set('connection_limit', '10');
  }
  if (!urlObj.searchParams.has('pool_timeout')) {
    urlObj.searchParams.set('pool_timeout', '30');
  }
  dbUrl = urlObj.toString();
}

const prismaOptions = {
  datasources: dbUrl ? { db: { url: dbUrl } } : undefined,
  log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
};

// Singleton PrismaClient instance to prevent multiple connection pools
let prisma;
if (process.env.NODE_ENV === 'production') {
  prisma = new PrismaClient(prismaOptions);
} else {
  if (!global.__prisma) {
    global.__prisma = new PrismaClient(prismaOptions);
  }
  prisma = global.__prisma;
}

process.on('beforeExit', async () => {
  await prisma.$disconnect();
});

module.exports = prisma;
