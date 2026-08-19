require('dotenv').config();
const prisma = require('./src/config/database');
const bcrypt = require('bcrypt');

async function testLogin() {
  const email = 'chetna@sharna.com';
  const pass = 'admin123';

  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { email: email.toLowerCase() },
        { phone: email }
      ]
    }
  });

  if (!user) {
    console.log('User not found!');
    return;
  }

  const match = await bcrypt.compare(pass, user.password);
  console.log('User found in DB:', user.email, '| Phone:', user.phone, '| Role:', user.role);
  console.log('Password match test for admin123:', match);

  await prisma.$disconnect();
}

testLogin().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
});
