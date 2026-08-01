const prisma = require('./src/config/database');

async function fixUnpublished() {
  const result = await prisma.product.updateMany({
    where: { isPublished: false },
    data: { isPublished: true }
  });
  console.log('Fixed', result.count, 'unpublished products - they will now appear on the shop!');
  
  const all = await prisma.product.findMany({ select: { id: true, title: true, isPublished: true } });
  console.log('All products in DB:');
  all.forEach(p => console.log(` - ${p.title} | isPublished: ${p.isPublished}`));
  
  await prisma.$disconnect();
}

fixUnpublished().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
