require('dotenv').config();
const prisma = require('./src/config/database');
const bcrypt = require('bcrypt');

async function seedAdmin() {
  console.log('🔍 Checking existing users in PostgreSQL database...');
  const users = await prisma.user.findMany();
  console.log('Total users in DB:', users.length);
  users.forEach(u => console.log(` - ID: ${u.id} | Email: ${u.email} | Phone: ${u.phone} | Role: ${u.role}`));

  const hashedPassword = await bcrypt.hash('admin123', 10);

  const adminAccounts = [
    { email: 'sharnaapparels@gmail.com', phone: '+916268218135', name: 'Mrs. Swati Kureel' },
    { email: 'priyanshulokhande72@gmail.com', phone: '+917999715256', name: 'Priyanshu Lokhande' }
  ];

  for (const acc of adminAccounts) {
    const existing = await prisma.user.findFirst({
      where: {
        OR: [
          { email: acc.email },
          { phone: acc.phone }
        ]
      }
    });

    if (existing) {
      console.log(`Updating existing user ${existing.email || existing.phone} to ADMIN...`);
      await prisma.user.update({
        where: { id: existing.id },
        data: {
          email: acc.email,
          role: 'ADMIN',
          password: hashedPassword,
          isVerified: true,
          isBlocked: false
        }
      });
    } else {
      console.log(`Creating new ADMIN user for ${acc.email}...`);
      await prisma.user.create({
        data: {
          name: acc.name,
          email: acc.email,
          phone: acc.phone,
          role: 'ADMIN',
          password: hashedPassword,
          isVerified: true,
          isBlocked: false
        }
      });
    }
  }

  console.log('✅ Admin accounts successfully created/updated in database!');
  await prisma.$disconnect();
}

seedAdmin().catch(async (err) => {
  console.error('❌ Error seeding admin:', err);
  await prisma.$disconnect();
  process.exit(1);
});
