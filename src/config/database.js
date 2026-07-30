require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
});

// ⚡ Neon PostgreSQL Keep-Alive Ping (Runs every 3 minutes to prevent auto-suspend & E57P01 connection drops)
setInterval(async () => {
  try {
    await prisma.$queryRaw`SELECT 1;`;
  } catch (err) {
    // If connection dropped, reconnect silently
    console.log('🔄 [Neon DB Reconnecting...]');
    try {
      await prisma.$connect();
    } catch (e) {}
  }
}, 3 * 60 * 1000);

process.on('beforeExit', async () => {
  await prisma.$disconnect();
});

module.exports = prisma;
