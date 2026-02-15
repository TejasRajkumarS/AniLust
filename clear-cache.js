// Quick Cache Clear Script
// Copy and paste this into your browser console to clear the cache

import { clearCache } from './services/consumet';

// Clear all cache
clearCache();

// Or clear specific cache entries
// clearCache('info'); // Clear all anime info cache
// clearCache('trending'); // Clear trending cache
// clearCache('search'); // Clear search cache

console.log('✅ Cache cleared! Refresh the page to fetch fresh data.');
