const CACHE_NAME = 'speedyex-v2';
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './styles.css',
    './logo.png',
    './pwa-icon.png',
    './favicon.ico',
    './manifest.json',
    './js/app.js',
    './js/api.js',
    './js/calendar.js',
    './js/dashboard.js',
    './js/invoice.js',
    './js/modals.js',
    './js/settings.js',
    './js/reminders.js',
    './js/store.js',
    './js/theme.js',
    './js/toast.js',
    './js/translations.js',
    './js/utils.js',
    // External libs (ideally vendor them, but for now cache the CDN links if used, or let them fail offline if not critical. 
    // Note: Cross-origin requests might be opaque. Better to cache local files.)
    // We are relying on some CDNs (Firebase, Lucide, Tailwind script). 
    // A robust PWA should have these local. For this "quick PWA" we focus on app shell.
];

// Install Event
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[Service Worker] Caching all: app shell and content');
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
});

// Activate Event (Cleanup old caches)
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keyList) => {
            return Promise.all(keyList.map((key) => {
                if (key !== CACHE_NAME) {
                    return caches.delete(key);
                }
            }));
        })
    );
});

// Fetch Event (Network First, then Cache)
// Strategy: Network First ensures fresh data (especially for Firebase interaction scripts which are external).
// Actually, for static assets "StaleWhileRevalidate" is better, but simple "Cache First" or "Network First" is easier to write without Workbox.
// Let's use "StaleWhileRevalidate" logic manually for static, and Network Only for others?
// Simple approach: Try Network -> Fallback to Cache.
self.addEventListener('fetch', (event) => {
    event.respondWith(
        fetch(event.request).catch(() => {
            return caches.match(event.request);
        })
    );
});
