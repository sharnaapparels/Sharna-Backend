const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function ensureAdmin() {
  const hashedPassword = await bcrypt.hash('admin123', 10);

  // 1. Ensure Swati Kureel (sharnaapparels@gmail.com) admin account
  const adminEmail = 'sharnaapparels@gmail.com';
  const existingAdmin = await prisma.user.findFirst({
    where: { 
      OR: [
        { email: adminEmail },
        { phone: '+916268218135' }
      ]
    }
  });

  if (existingAdmin) {
    await prisma.user.update({
      where: { id: existingAdmin.id },
      data: {
        name: 'Miss Swati Kureel',
        email: adminEmail,
        phone: '+916268218135',
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
        name: 'Miss Swati Kureel',
        email: adminEmail,
        phone: '+916268218135',
        password: hashedPassword,
        role: 'ADMIN',
        isVerified: true,
        isBlocked: false
      }
    });
    console.log(`✅ Admin account created: ${adminEmail} (Role: ADMIN, Password: admin123)`);
  }

  // 2. Ensure Priyanshu Lokhande (priyanshulokhande72@gmail.com) admin account
  const priyanshuEmail = 'priyanshulokhande72@gmail.com';
  const existingPriyanshu = await prisma.user.findFirst({
    where: {
      OR: [
        { email: priyanshuEmail },
        { email: 'swati@sharna.com' },
        { phone: '+917999715256' }
      ]
    }
  });

  if (existingPriyanshu) {
    await prisma.user.update({
      where: { id: existingPriyanshu.id },
      data: {
        name: 'Priyanshu Lokhande',
        email: priyanshuEmail,
        phone: '+917999715256',
        password: hashedPassword,
        role: 'ADMIN',
        isVerified: true,
        isBlocked: false
      }
    });
    console.log(`✅ Secondary Admin updated: ${priyanshuEmail} (Password: admin123)`);
  } else {
    await prisma.user.create({
      data: {
        name: 'Priyanshu Lokhande',
        email: priyanshuEmail,
        phone: '+917999715256',
        password: hashedPassword,
        role: 'ADMIN',
        isVerified: true,
        isBlocked: false
      }
    });
    console.log(`✅ Secondary Admin created: ${priyanshuEmail} (Password: admin123)`);
  }
}

ensureAdmin()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
