const CACHE_NAME = 'speedyex-v18';
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './styles.css',
    './logo.png',
    './pwa-icon.png',
    './favicon.ico',
    './manifest.json',


    // JS Modules
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
    './js/firebase-config.js',
    './js/tailwind-config.js',

    // External Libraries (CDNs) - CRITICAL for Offline
    'https://cdn.tailwindcss.com',
    'https://cdn.jsdelivr.net/npm/chart.js',
    'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
    'https://cdn.sheetjs.com/xlsx-0.20.0/package/dist/xlsx.full.min.js',
    'https://unpkg.com/lucide@latest',

    // Firebase SDKs (Attempts to cache entry points)
    'https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js',
    'https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js',
];

// Install Event
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[Service Worker] Caching app shell and external libs');
            // We use map to catch individual failures so one bad link doesn't break everything
            return Promise.all(
                ASSETS_TO_CACHE.map(url => {
                    return cache.add(url).catch(err => {
                        console.warn('[Service Worker] Failed to cache:', url, err);
                    });
                })
            );
        })
    );
    self.skipWaiting();
});

// Activate Event
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
    self.clients.claim();
});

// Fetch Event
self.addEventListener('fetch', (event) => {
    // Strategy: Stale-While-Revalidate for most things, but we simplify to:
    // Try Network -> If fail, return Cache.
    // For CDNs/Libs (immutable-ish), we could prefer Cache, but Network fallback is safer for "latest" tags.

    // Filter out unsupported schemes (like chrome-extension://) and non-GET methods (POST, PUT, etc.)
    if (!event.request.url.startsWith('http') || event.request.method !== 'GET') return;

    event.respondWith(
        fetch(event.request)
            .then(networkResponse => {
                // Clone response to put in cache (Stale-While-Revalidate logic)
                // Only cache valid responses
                // Clone response to put in cache (Stale-While-Revalidate logic)
                // Cache valid responses (Basic and CORS for CDNs)
                // We also allow Opaque (type 'opaque', status 0) for no-cors scripts if needed, 
                // though explicit CORS is better. For now, we accept them to ensure Tailwind loads.
                if (networkResponse && (
                    networkResponse.status === 200 ||
                    networkResponse.status === 0 ||
                    networkResponse.type === 'cors' ||
                    networkResponse.type === 'opaque'
                )) {
                    const responseToCache = networkResponse.clone();
                    caches.open(CACHE_NAME).then(cache => {
                        cache.put(event.request, responseToCache);
                    });
                }
                return networkResponse;
            })
            .catch(() => {
                // Network failed, try cache
                return caches.match(event.request);
            })
    );
});
