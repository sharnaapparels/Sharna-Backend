const prisma = require('./database');

const INITIAL_CATALOG = [
  {
    title: 'IVORY HAND EMBROIDERED CO-ORD SET',
    price: 18500,
    salePrice: 21500,
    category: 'co-ords',
    collection: 'new-arrivals',
    description: 'Handwoven pure cotton co-ord set with exquisite zardozi and gota patti threadwork. Designed for timeless festive luxury.',
    image: '/src/assets/co-ord-sand.png',
    images: ['/src/assets/co-ord-sand.png', '/src/assets/co-ord-blush.png'],
    color: 'beige',
    colors: ['beige', 'pink', 'white'],
    sizes: ['XS', 'S', 'M', 'L', 'XL'],
    isReadyToShip: true,
    isNewArrival: true,
    isFeatured: true
  },
  {
    title: 'BLUSH PINK EMBROIDERED KURTI SET',
    price: 16200,
    salePrice: 19000,
    category: 'suit-sets',
    collection: 'new-arrivals',
    description: 'Blush pink handspun chanderi silk kurti set featuring delicate floral embroidery and sheer organza dupatta.',
    image: '/src/assets/co-ord-blush.png',
    images: ['/src/assets/co-ord-blush.png'],
    color: 'pink',
    colors: ['pink', 'beige'],
    sizes: ['XS', 'S', 'M', 'L', 'XL', '2XL'],
    isReadyToShip: true,
    isNewArrival: true,
    isFeatured: true
  },
  {
    title: 'ASH GREY HANDLOOM TUNIC DRESS',
    price: 14800,
    salePrice: 17000,
    category: 'dresses',
    collection: 'ready-to-ship',
    description: 'Contemporary ash grey tunic dress in breathable handspun linen with hand-cut mother-of-pearl buttons.',
    image: '/src/assets/co-ord-ash.png',
    images: ['/src/assets/co-ord-ash.png'],
    color: 'grey',
    colors: ['grey', 'black'],
    sizes: ['S', 'M', 'L', 'XL'],
    isReadyToShip: true,
    isNewArrival: false,
    isFeatured: true
  },
  {
    title: 'MULTICOLOR HERITAGE CO-ORD SET',
    price: 22000,
    salePrice: 25500,
    category: 'co-ords',
    collection: 'ready-to-ship',
    description: 'Vibrant heritage-inspired multicolor co-ord set with handcrafted mirror work detailing.',
    image: '/src/assets/co-ord-mul.png',
    images: ['/src/assets/co-ord-mul.png'],
    color: 'multicolor',
    colors: ['multicolor', 'orange', 'yellow'],
    sizes: ['XS', 'S', 'M', 'L', 'XL'],
    isReadyToShip: true,
    isNewArrival: false,
    isFeatured: true
  },
  {
    title: 'EMERALD GOTA PATTI ANARKALI SET',
    price: 28500,
    salePrice: 32000,
    category: 'suit-sets',
    collection: 'festive-collection',
    description: 'Regal emerald green silk anarkali suit embellished with hand-stitched gota patti borders and matching churidar.',
    image: '/src/assets/festive-1.png',
    images: ['/src/assets/festive-1.png', '/src/assets/festive-2.png'],
    color: 'green',
    colors: ['green', 'navy'],
    sizes: ['XS', 'S', 'M', 'L', 'XL', '2XL'],
    isReadyToShip: false,
    isNewArrival: true,
    isFeatured: true
  },
  {
    title: 'CRIMSON LEHENGA SET',
    price: 42000,
    salePrice: 48000,
    category: 'bridal',
    collection: 'festive-collection',
    description: 'Grand crimson red bridal lehenga adorned with zardozi, sequins, and handcrafted velvet blouse.',
    image: '/src/assets/bridal-1.png',
    images: ['/src/assets/bridal-1.png'],
    color: 'red',
    colors: ['red', 'maroon'],
    sizes: ['XS', 'S', 'M', 'L', 'XL'],
    isReadyToShip: false,
    isNewArrival: true,
    isFeatured: true
  },
  {
    title: 'ROYAL BLUE RECEPTION GOWN',
    price: 34000,
    salePrice: 39000,
    category: 'dresses',
    collection: 'celebrity-closet',
    description: 'Statement royal blue evening gown worn by leading muses. Features structured silhouette and intricate metallic embroidery.',
    image: '/src/assets/reception-1.png',
    images: ['/src/assets/reception-1.png', '/src/assets/reception-2.png'],
    color: 'blue',
    colors: ['blue', 'navy'],
    sizes: ['S', 'M', 'L', 'XL'],
    isReadyToShip: true,
    isNewArrival: false,
    isFeatured: true
  },
  {
    title: 'PASTEL PEARL CELEBRITY DRESS',
    price: 29500,
    salePrice: 34000,
    category: 'dresses',
    collection: 'celebrity-closet',
    description: 'Ethereal pastel pearl gown with cascading crystal threadwork as featured in top editorial showcases.',
    image: '/src/assets/celebrity-1.png',
    images: ['/src/assets/celebrity-1.png'],
    color: 'beige',
    colors: ['beige', 'white'],
    sizes: ['XS', 'S', 'M', 'L'],
    isReadyToShip: true,
    isNewArrival: false,
    isFeatured: true
  }
];

async function seedCatalogIfNeeded() {
  try {
    const existingCount = await prisma.product.count();
    if (existingCount === 0) {
      console.log('🌱 [SEEDER]: PostgreSQL database product count is 0. Initializing luxury catalog seed...');
      
      for (const item of INITIAL_CATALOG) {
        const slug = item.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
        
        await prisma.product.create({
          data: {
            title: item.title,
            slug,
            description: item.description,
            price: item.price,
            salePrice: item.salePrice,
            category: item.category,
            collection: item.collection,
            isFeatured: item.isFeatured,
            images: {
              create: item.images.map((imgUrl, idx) => ({ url: imgUrl, isPrimary: idx === 0 }))
            },
            variants: {
              create: item.sizes.map(size => ({
                size,
                color: item.color,
                colorHex: item.color === 'beige' ? '#e5d5ba' : (item.color === 'pink' ? '#FFC0CB' : '#000000'),
                stock: 25
              }))
            }
          }
        });
      }
      console.log(`✅ [SEEDER]: Successfully seeded ${INITIAL_CATALOG.length} luxury products into database!`);
    } else {
      console.log(`ℹ️ [SEEDER]: Database already contains ${existingCount} products. Skipping initial seed.`);
    }
  } catch (err) {
    console.error('❌ [SEEDER ERROR]: Failed to seed catalog products:', err.message);
  }
}

module.exports = { seedCatalogIfNeeded };
