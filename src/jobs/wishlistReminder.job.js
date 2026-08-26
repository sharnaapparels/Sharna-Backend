const prisma = require('../config/database');
const { sendWishlistReminderEmail } = require('../utils/email.service');
const { sendWhatsAppWishlistReminder } = require('../utils/whatsapp.service');

// Map to track last time a user was sent an automated background reminder (prevents spamming)
const lastReminderSentMap = new Map();

// Default delay threshold: 4 Days (96 hours)
const REMINDER_DAYS = parseInt(process.env.WISHLIST_REMINDER_DAYS) || 4;
const REMINDER_DELAY_MS = REMINDER_DAYS * 24 * 60 * 60 * 1000; // 4 days in milliseconds

/**
 * Execute automated scan for users with abandoned items in wishlist
 */
const runAbandonedWishlistScan = async () => {
  try {
    // Find all users who have at least 1 wishlist item
    const usersWithWishlist = await prisma.user.findMany({
      where: {
        wishlist: { some: {} },
        isBlocked: false
      },
      include: {
        wishlist: {
          include: {
            product: {
              select: {
                id: true,
                title: true,
                price: true,
                category: true,
                images: { select: { url: true } }
              }
            }
          }
        }
      }
    });

    if (!usersWithWishlist || usersWithWishlist.length === 0) {
      return;
    }

    const now = Date.now();

    for (const user of usersWithWishlist) {
      // Check cooldown & age of wishlist items (must be at least 3-4 days old)
      const lastSent = lastReminderSentMap.get(user.id) || 0;
      if (now - lastSent < REMINDER_DELAY_MS) {
        continue; // Skip user if reminded within last 3-4 days
      }

      // Filter items added to wishlist at least 3-4 days ago (or check if user has items older than threshold)
      const eligibleWishlistItems = user.wishlist.filter(w => {
        const itemAge = now - new Date(w.createdAt).getTime();
        return itemAge >= REMINDER_DELAY_MS;
      });

      // If no items are 3-4 days old yet, fallback to active items if it's been 3-4 days since last check
      const targetItems = eligibleWishlistItems.length > 0 ? eligibleWishlistItems : user.wishlist;

      const items = targetItems.map(w => ({
        id: w.product.id,
        title: w.product.title,
        price: w.product.price,
        category: w.product.category,
        image: w.product.images?.[0]?.url || ''
      }));

      if (items.length === 0) continue;

      console.log(`\n⏰ [CRON JOB] Found abandoned wishlist for user: ${user.name} (${user.email || user.phone}) with ${items.length} items.`);

      let sentAny = false;

      if (user.email) {
        try {
          await sendWishlistReminderEmail(user.email, { name: user.name, items });
          sentAny = true;
        } catch (e) {
          console.error(`❌ Cron Email error for ${user.email}:`, e.message);
        }
      }

      if (user.phone) {
        try {
          await sendWhatsAppWishlistReminder(user.phone, { name: user.name, items });
          sentAny = true;
        } catch (e) {
          console.error(`❌ Cron WhatsApp error for ${user.phone}:`, e.message);
        }
      }

      if (sentAny) {
        lastReminderSentMap.set(user.id, now);
      }
    }
  } catch (error) {
    console.error('❌ Error in abandoned wishlist background scan:', error.message);
  }
};

/**
 * Initialize background scheduler (runs every 4 days)
 */
const initWishlistReminderJob = () => {
  console.log('⏰ Wishlist Abandonment Scheduler activated (Scan interval: Every 3-4 days)');
  
  // Periodic scan every 3-4 days (3.5 days = 302,400,000 ms)
  setInterval(() => {
    runAbandonedWishlistScan();
  }, 3.5 * 24 * 60 * 60 * 1000);
};

module.exports = { initWishlistReminderJob, runAbandonedWishlistScan };
