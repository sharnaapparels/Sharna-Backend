const prisma = require('./src/config/database');

async function checkProducts() {
  const all = await prisma.product.findMany({ 
    select: { id: true, title: true, isPublished: true, category: true, collection: true },
    where: { isPublished: true }
  });
  console.log('Published products in DB:');
  all.forEach(p => console.log(` - "${p.title}" | category: "${p.category}" | collection: "${p.collection}" | isPublished: ${p.isPublished}`));
  
  await prisma.$disconnect();
}

checkProducts().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
