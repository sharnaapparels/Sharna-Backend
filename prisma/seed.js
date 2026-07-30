const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
  datasourceUrl: process.env.DATABASE_URL
});

// Comprehensive, ultra-clean seed data for SHARNA Luxury Database
const SEED_PRODUCTS = [
  // ─── NEW ARRIVALS ────────────────────────────────────────────────────────
  {
    title: 'Blush Toga Co-ord Set (2 Pcs)',
    slug: 'blush-toga-co-ord-set',
    description: 'A luxurious blush pink toga co-ord set with a straight leg fit. Styled to represent sustainable fashion and lasting luxury.',
    price: 18500.00,
    category: 'New Arrivals',
    collection: 'Festive',
    fabric: 'Pure organic cotton',
    care: 'Dry clean only',
    images: [{ url: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=800&q=80', isPrimary: true }],
    variants: [
      { size: 'XS', color: 'pink', stock: 15 },
      { size: 'S', color: 'pink', stock: 20 },
      { size: 'M', color: 'pink', stock: 25 },
      { size: 'L', color: 'pink', stock: 12 }
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
    images: [{ url: 'https://images.unsplash.com/photo-1554412933-514a83d2f3c8?auto=format&fit=crop&w=800&q=80', isPrimary: true }],
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
    images: [{ url: 'https://images.unsplash.com/photo-1496747611176-843222e1e57c?auto=format&fit=crop&w=800&q=80', isPrimary: true }],
    variants: [
      { size: 'S', color: 'grey', stock: 8 },
      { size: 'M', color: 'grey', stock: 10 },
      { size: 'L', color: 'grey', stock: 5 }
    ]
  },
  {
    title: 'Blush Rib Mul Vena Co-ord Set (2 Pcs)',
    slug: 'blush-rib-mul-vena-set',
    description: 'Handcrafted blush rib mul vena co-ord set with wide leg comfort.',
    price: 14500.00,
    category: 'New Arrivals',
    collection: 'Everyday',
    fabric: 'Mulberry Cotton',
    care: 'Dry clean only',
    images: [{ url: 'https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=800&q=80', isPrimary: true }],
    variants: [
      { size: 'S', color: 'pink', stock: 10 },
      { size: 'M', color: 'pink', stock: 15 }
    ]
  },
  {
    title: 'Sand Rib Mul Vena Co-ord Set (2 Pcs)',
    slug: 'sand-rib-mul-vena-set',
    description: 'Organic sand-hued rib mul vena set featuring delicate artisan detail.',
    price: 14500.00,
    category: 'New Arrivals',
    collection: 'Everyday',
    fabric: 'Organic Linen',
    care: 'Hand wash cold',
    images: [{ url: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=800&q=80', isPrimary: true }],
    variants: [
      { size: 'S', color: 'beige', stock: 10 },
      { size: 'M', color: 'beige', stock: 12 }
    ]
  },
  {
    title: 'Ash Gray Rib Mul Vena Co-ord Set (2 Pcs)',
    slug: 'ash-gray-rib-mul-vena-set',
    description: 'Refined ash gray rib mul vena set built for timeless elegance.',
    price: 14500.00,
    category: 'New Arrivals',
    collection: 'Everyday',
    fabric: 'Hemp Blend',
    care: 'Dry clean only',
    images: [{ url: 'https://images.unsplash.com/photo-1496747611176-843222e1e57c?auto=format&fit=crop&w=800&q=80', isPrimary: true }],
    variants: [
      { size: 'S', color: 'grey', stock: 10 },
      { size: 'M', color: 'grey', stock: 15 }
    ]
  },
  {
    title: 'Gray Thin Striped New Sphara Crop Top & Skirt Co-ord Set (2 Pcs)',
    slug: 'gray-thin-striped-sphara-set',
    description: 'Artisanal gray thin striped crop top and skirt set crafted from sustainable handloom cotton.',
    price: 12000.00,
    category: 'New Arrivals',
    collection: 'Party',
    fabric: 'Handloom Cotton',
    care: 'Dry clean only',
    images: [{ url: 'https://images.unsplash.com/photo-1509631179647-0177331693ae?auto=format&fit=crop&w=800&q=80', isPrimary: true }],
    variants: [
      { size: 'XS', color: 'grey', stock: 10 },
      { size: 'S', color: 'grey', stock: 15 },
      { size: 'M', color: 'grey', stock: 20 },
      { size: 'L', color: 'grey', stock: 10 }
    ]
  },
  {
    title: 'Brown Thin Striped New Sphara Crop Top & Skirt Co-ord Set (2 Pcs)',
    slug: 'brown-thin-striped-sphara-set',
    description: 'Rich earthy brown thin striped crop top and skirt set with flowing silhouette.',
    price: 12000.00,
    category: 'New Arrivals',
    collection: 'Party',
    fabric: 'Handloom Linen',
    care: 'Dry clean only',
    images: [{ url: 'https://images.unsplash.com/photo-1554412933-514a83d2f3c8?auto=format&fit=crop&w=800&q=80', isPrimary: true }],
    variants: [
      { size: 'S', color: 'brown', stock: 12 },
      { size: 'M', color: 'brown', stock: 18 }
    ]
  },

  // ─── CELEBRITY CLOSET ───────────────────────────────────────────────────
  {
    title: 'Off-White Fringed Saree-Corset-Jacket Set (3 Pcs)',
    slug: 'off-white-fringed-saree-set',
    description: 'A premium celebrity closet item. Fringed saree paired with an off-white corset and elegant overlay jacket.',
    price: 40500.00,
    category: 'Celebrity Closet',
    collection: 'Bridal',
    fabric: 'Mulberry Silk',
    care: 'Dry clean only',
    images: [{ url: 'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?auto=format&fit=crop&w=800&q=80', isPrimary: true }],
    variants: [
      { size: 'S', color: 'white', stock: 5 },
      { size: 'M', color: 'white', stock: 8 }
    ]
  },
  {
    title: 'Off-White Bustier-Lehenga-Jacket Set (3 Pcs)',
    slug: 'off-white-bustier-lehenga-set',
    description: 'Hand-embellished off-white bustier with voluminous lehenga and sheer embroidered jacket.',
    price: 47000.00,
    category: 'Celebrity Closet',
    collection: 'Bridal',
    fabric: 'Chiffon & Organza',
    care: 'Dry clean only',
    images: [{ url: 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=800&q=80', isPrimary: true }],
    variants: [
      { size: 'S', color: 'white', stock: 3 },
      { size: 'M', color: 'white', stock: 6 }
    ]
  },
  {
    title: 'Mati Heart Duetter Lehenga Set-Oatmeal (3 Pcs)',
    slug: 'mati-heart-duetter-lehenga-oatmeal',
    description: 'Ethically crafted oatmeal lehenga set featuring heart duetter embroidery.',
    price: 35800.00,
    category: 'Celebrity Closet',
    collection: 'Festive',
    fabric: 'Raw Silk',
    care: 'Dry clean only',
    images: [{ url: 'https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?auto=format&fit=crop&w=800&q=80', isPrimary: true }],
    variants: [
      { size: 'S', color: 'beige', stock: 4 },
      { size: 'M', color: 'beige', stock: 7 }
    ]
  },
  {
    title: 'Pink Fringed Saree & Shocked Bustier Set (2 Pcs)',
    slug: 'pink-fringed-saree-bustier-set',
    description: 'Vibrant pink fringed saree styled with a structured bustier bodice.',
    price: 31500.00,
    category: 'Celebrity Closet',
    collection: 'Party',
    fabric: 'Georgette Silk',
    care: 'Dry clean only',
    images: [{ url: 'https://images.unsplash.com/photo-1544441893-675973e31985?auto=format&fit=crop&w=800&q=80', isPrimary: true }],
    variants: [
      { size: 'S', color: 'pink', stock: 5 },
      { size: 'M', color: 'pink', stock: 8 }
    ]
  },

  // ─── BEST SELLERS ───────────────────────────────────────────────────────
  {
    title: 'Cowl Tunic Set Peach',
    slug: 'cowl-tunic-set-peach',
    description: 'Bestselling peach cowl tunic set crafted for breezy summer elegance.',
    price: 15000.00,
    category: 'Best Sellers',
    collection: 'Summer',
    fabric: 'Organic Mul Cotton',
    care: 'Hand wash cold',
    images: [{ url: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=800&q=80', isPrimary: true }],
    variants: [
      { size: 'S', color: 'peach', stock: 20 },
      { size: 'M', color: 'peach', stock: 25 }
    ]
  },
  {
    title: 'Blue Safari Sphree Jumpsuit',
    slug: 'blue-safari-sphree-jumpsuit',
    description: 'Tailored blue safari jumpsuit featuring cinched waist and tapered leg.',
    price: 14500.00,
    category: 'Best Sellers',
    collection: 'Casual',
    fabric: 'Linen Rayon Blend',
    care: 'Gentle wash',
    images: [{ url: 'https://images.unsplash.com/photo-1539109136881-3be0616acf4b?auto=format&fit=crop&w=800&q=80', isPrimary: true }],
    variants: [
      { size: 'S', color: 'blue', stock: 15 },
      { size: 'M', color: 'blue', stock: 22 }
    ]
  },
  {
    title: 'Mati Deck Set (2 Pcs)',
    slug: 'mati-deck-set',
    description: 'Signature Mati 2-piece deck set in rich cocoa brown.',
    price: 28800.00,
    category: 'Best Sellers',
    collection: 'Luxury',
    fabric: 'Handwoven Khadi Silk',
    care: 'Dry clean only',
    images: [{ url: 'https://images.unsplash.com/photo-1554412933-514a83d2f3c8?auto=format&fit=crop&w=800&q=80', isPrimary: true }],
    variants: [
      { size: 'S', color: 'brown', stock: 10 },
      { size: 'M', color: 'brown', stock: 14 }
    ]
  },

  // ─── READY TO SHIP ──────────────────────────────────────────────────────
  {
    title: 'Mati PL Shorts - Green (Ready to Ship)',
    slug: 'mati-pl-shorts-green',
    description: 'Ready to ship green shorts with relaxed drawstring waist.',
    price: 4950.00,
    category: 'Ready To Ship',
    collection: 'Resort',
    fabric: 'Linen',
    care: 'Machine wash gentle',
    images: [{ url: 'https://images.unsplash.com/photo-1509631179647-0177331693ae?auto=format&fit=crop&w=800&q=80', isPrimary: true }],
    variants: [
      { size: 'S', color: 'green', stock: 30 },
      { size: 'M', color: 'green', stock: 35 }
    ]
  },
  {
    title: 'Mati Rang Be Pants - Red (Ready to Ship)',
    slug: 'mati-rang-be-pants-red',
    description: 'Crimson red handcrafted pants ready to ship.',
    price: 5400.00,
    category: 'Ready To Ship',
    collection: 'Festive',
    fabric: 'Cotton Silk',
    care: 'Hand wash',
    images: [{ url: 'https://images.unsplash.com/photo-1544441893-675973e31985?auto=format&fit=crop&w=800&q=80', isPrimary: true }],
    variants: [
      { size: 'S', color: 'red', stock: 25 },
      { size: 'M', color: 'red', stock: 28 }
    ]
  },
  {
    title: 'Mati Rang Be Pants - Yellow (Ready to Ship)',
    slug: 'mati-rang-be-pants-yellow',
    description: 'Vibrant mustard yellow pants ready for immediate dispatch.',
    price: 5400.00,
    category: 'Ready To Ship',
    collection: 'Festive',
    fabric: 'Cotton Silk',
    care: 'Hand wash',
    images: [{ url: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=800&q=80', isPrimary: true }],
    variants: [
      { size: 'S', color: 'yellow', stock: 20 },
      { size: 'M', color: 'yellow', stock: 22 }
    ]
  }
];

async function main() {
  console.log('🌱 Starting refined database seed for SHARNA...');

  // Clear existing records cleanly
  await prisma.productVariant.deleteMany({});
  await prisma.productImage.deleteMany({});
  await prisma.product.deleteMany({});
  console.log('🧹 Database cleared cleanly - zero duplicates');

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
    console.log(`✨ Seeded: ${item.title}`);
  }

  console.log('🎉 Refined Database Seeding Completed Successfully! 100% Clean & Structured.');
}

main()
  .catch((e) => {
    console.error('❌ Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
