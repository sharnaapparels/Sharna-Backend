// In-memory cache for ultra-fast product responses from database
let cacheMap = new Map();
const TTL = 10 * 60 * 1000; // 10 minutes default TTL

function getCache(key) {
  const cached = cacheMap.get(key);
  if (cached && (Date.now() - cached.timestamp < TTL)) {
    return cached.data;
  }
  cacheMap.delete(key);
  return null;
}

function setCache(key, data) {
  cacheMap.set(key, {
    timestamp: Date.now(),
    data
  });
}

function clearProductCache() {
  cacheMap.clear();
  console.log('⚡ [PRODUCT CACHE CLEARED]');
}

module.exports = {
  getCache,
  setCache,
  clearProductCache
};
