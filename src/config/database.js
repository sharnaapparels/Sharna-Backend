require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

let dbUrl = process.env.DATABASE_URL || '';
if (dbUrl && !dbUrl.includes('pool_timeout=')) {
  dbUrl += (dbUrl.includes('?') ? '&' : '?') + 'pool_timeout=30&connection_limit=30';
}

const prisma = new PrismaClient({
  datasources: dbUrl ? { db: { url: dbUrl } } : undefined,
  log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
});

// ⚡ Supabase PostgreSQL Connection Pool Keep-Alive Ping (Runs every 45s to keep pooler connection warm)
setInterval(async () => {
  try {
    await prisma.$queryRaw`SELECT 1;`;
  } catch (err) {
    // If Supabase connection dropped or timed out, reconnect silently
    console.log('🔄 [Supabase DB Reconnecting...]');
    try {
      await prisma.$connect();
    } catch (e) {}
  }
}, 45 * 1000);

process.on('beforeExit', async () => {
  await prisma.$disconnect();
});

module.exports = prisma;
