const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function ensureAdmin() {
  const hashedPassword = await bcrypt.hash('admin123', 10);

  // 1. Ensure sharnaapparels@gmail.com admin account
  const adminEmail = 'sharnaapparels@gmail.com';
  const existingAdmin = await prisma.user.findFirst({
    where: { email: adminEmail }
  });

  if (existingAdmin) {
    await prisma.user.update({
      where: { id: existingAdmin.id },
      data: {
        password: hashedPassword,
        role: 'ADMIN',
        isVerified: true,
        isBlocked: false
      }
    });
    console.log(`✅ Admin account updated: ${adminEmail} (Role: ADMIN, Password: admin123)`);
  } else {
    await prisma.user.create({
      data: {
        name: 'Mrs. Swati Kureel',
        email: adminEmail,
        phone: '+919324503975',
        password: hashedPassword,
        role: 'ADMIN',
        isVerified: true
      }
    });
    console.log(`✅ Admin account created: ${adminEmail} (Role: ADMIN, Password: admin123)`);
  }

  // 2. Ensure swati@sharna.com admin account
  const swatiEmail = 'swati@sharna.com';
  const existingSwati = await prisma.user.findFirst({
    where: { email: swatiEmail }
  });

  if (existingSwati) {
    await prisma.user.update({
      where: { id: existingSwati.id },
      data: {
        name: 'Mrs. Swati Kureel',
        password: hashedPassword,
        role: 'ADMIN',
        isVerified: true,
        isBlocked: false
      }
    });
    console.log(`✅ Secondary Admin updated: ${swatiEmail} (Password: admin123)`);
  } else {
    await prisma.user.create({
      data: {
        name: 'Mrs. Swati Kureel',
        email: swatiEmail,
        phone: '+917999715256',
        password: hashedPassword,
        role: 'ADMIN',
        isVerified: true
      }
    });
    console.log(`✅ Secondary Admin created: ${swatiEmail} (Password: admin123)`);
  }
}

ensureAdmin()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
