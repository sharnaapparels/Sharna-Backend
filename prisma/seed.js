const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
  datasourceUrl: process.env.DATABASE_URL
});

// A subset of mock products with placeholders or actual cloud links
const SEED_PRODUCTS = [
  {
    title: 'Blush Toga Co-ord Set (2 Pcs)',
    slug: 'blush-toga-co-ord-set',
    description: 'A luxurious blush pink toga co-ord set with a straight leg fit. Styled to represent sustainable fashion and lasting luxury.',
    price: 18500.00,
    category: 'New Arrivals',
    collection: 'Festive',
    fabric: 'Pure organic cotton',
    care: 'Dry clean only',
    images: [
      { url: 'https://res.cloudinary.com/demo/image/upload/v1652345678/sharna_placeholder.jpg', isPrimary: true }
    ],
    variants: [
      { size: 'XS', color: 'pink', stock: 10 },
      { size: 'S', color: 'pink', stock: 15 },
      { size: 'M', color: 'pink', stock: 20 },
      { size: 'L', color: 'pink', stock: 10 }
    ]
  },
  {
    title: 'Sand Toga Co-ord Set (2 Pcs)',
    slug: 'sand-toga-co-ord-set',
    description: 'Beautiful earth-toned sand toga co-ord set with a comfortable straight leg fit. Handcrafted using eco-friendly materials.',
    price: 18500.00,
    category: 'New Arrivals',
    collection: 'Casual',
    fabric: 'Linen cotton blend',
    care: 'Gentle hand wash',
    images: [
      { url: 'https://res.cloudinary.com/demo/image/upload/v1652345678/sharna_placeholder.jpg', isPrimary: true }
    ],
    variants: [
      { size: 'S', color: 'beige', stock: 12 },
      { size: 'M', color: 'beige', stock: 18 },
      { size: 'L', color: 'beige', stock: 14 }
    ]
  },
  {
    title: 'Ash Gray Toga Co-ord Set (2 Pcs)',
    slug: 'ash-gray-toga-co-ord-set',
    description: 'Sleek, sustainable, and modern grey toga co-ord set. Ideal for casual elegance.',
    price: 18800.00,
    category: 'New Arrivals',
    collection: 'Ready to Ship',
    fabric: 'Hemp cotton blend',
    care: 'Dry clean only',
    images: [
      { url: 'https://res.cloudinary.com/demo/image/upload/v1652345678/sharna_placeholder.jpg', isPrimary: true }
    ],
    variants: [
      { size: 'S', color: 'grey', stock: 8 },
      { size: 'M', color: 'grey', stock: 10 },
      { size: 'L', color: 'grey', stock: 5 }
    ]
  },
  {
    title: 'Off-White Fringed Saree-Corset-Jacket Set (3 Pcs)',
    slug: 'off-white-fringed-saree-set',
    description: 'A premium celebrity closet item. Fringed saree paired with an off-white corset and elegant overlay jacket.',
    price: 40500.00,
    category: 'Celebrity Closet',
    collection: 'Bridal',
    fabric: 'Mulberry silk',
    care: 'Dry clean only',
    images: [
      { url: 'https://res.cloudinary.com/demo/image/upload/v1652345678/sharna_placeholder.jpg', isPrimary: true }
    ],
    variants: [
      { size: 'S', color: 'white', stock: 3 },
      { size: 'M', color: 'white', stock: 5 },
      { size: 'L', color: 'white', stock: 2 }
    ]
  }
];

async function main() {
  console.log('🌱 Starting database seed...');

  // Clear existing products
  await prisma.product.deleteMany({});
  console.log('🧹 Cleared old products');

  for (const item of SEED_PRODUCTS) {
    const { images, variants, ...prodData } = item;
    
    await prisma.product.create({
      data: {
        ...prodData,
        images: {
          create: images
        },
        variants: {
          create: variants
        }
      }
    });
    console.log(`✨ Created product: ${item.title}`);
  }

  console.log('✅ Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
