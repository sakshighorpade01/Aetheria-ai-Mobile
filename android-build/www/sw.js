// sw.js - Service Worker for Aetheria AI PWA
// Handles offline caching and app updates

const CACHE_VERSION = 'v1.2.0';
const CACHE_NAME = `aetheria-ai-${CACHE_VERSION}`;

// Files to cache for offline functionality
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/chat.html',
  '/manifest.json',
  
  // CSS Files
  '/css/splash-screen.css',
  '/css/design-system.css',
  '/css/style.css',
  '/css/skeleton.css',
  '/css/chat-variables.css',
  '/css/chat-layout.css',
  '/css/chat-messages.css',
  '/css/chat-context.css',
  '/css/chat-input.css',
  '/css/message-actions.css',
  '/css/notifications.css',
  '/css/welcome-message.css',
  '/css/chat.css',
  '/css/to-do-list.css',
  '/css/artifact-ui.css',
  '/css/aios.css',
  '/css/mobile.css',
  '/css/modals.css',
  '/css/install-prompt.css',
  '/css/message-actions.css',
  '/css/skeleton.css',
  
  // JavaScript Files
  '/js/splash-screen.js',
  '/js/aios.js',
  '/js/chat.js',
  '/js/to-do-list.js',
  '/js/context-handler.js',
  '/js/add-files.js',
  '/js/message-formatter.js',
  '/js/skeleton-loader.js',
  '/js/socket-service.js',
  '/js/conversation-state-manager.js',
  '/js/floating-window-manager.js',
  '/js/notification-service.js',
  '/js/welcome-display.js',
  '/js/unified-preview-handler.js',
  '/js/artifact-handler.js',
  '/js/message-actions.js',
  '/js/skeleton-loader.js',
  '/js/floating-window-manager.js',
  '/js/config.js',
  '/js/supabase-client.js',
  '/js/auth-service.js',
  
  // Assets
  '/assets/icon.png',
  '/assets/splash-512.png',
  '/assets/splash-1024.png',
  '/assets/splash-2048.png'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker version:', CACHE_VERSION);
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('[SW] Static assets cached successfully');
        return self.skipWaiting(); // Activate immediately
      })
      .catch((error) => {
        console.error('[SW] Failed to cache assets:', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker version:', CACHE_VERSION);
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME && cacheName.startsWith('aetheria-ai-')) {
              console.log('[SW] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('[SW] Service worker activated');
        return self.clients.claim(); // Take control immediately
      })
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }
  
  // Skip socket.io and API requests
  if (url.pathname.includes('/socket.io') || 
      url.pathname.includes('/api/') ||
      url.pathname.includes('/chat')) {
    return;
  }
  
  // Allow caching of CDN resources (Flaticon, Font Awesome, etc.)
  if (url.origin !== location.origin) {
    // Cache CDN resources with stale-while-revalidate
    if (url.hostname.includes('cdnjs.cloudflare.com') ||
        url.hostname.includes('cdn.jsdelivr.net') ||
        url.hostname.includes('cdn-uicons.flaticon.com')) {
      event.respondWith(
        caches.match(request).then((cached) => {
          const fetchPromise = fetch(request).then((response) => {
            if (response.ok) {
              caches.open(CACHE_NAME).then(cache => cache.put(request, response.clone()));
            }
            return response;
          }).catch(() => cached);
          return cached || fetchPromise;
        })
      );
    }
    return;
  }
  
  // Cache-first strategy for static assets
  event.respondWith(
    caches.match(request)
      .then((cachedResponse) => {
        if (cachedResponse) {
          console.log('[SW] Serving from cache:', url.pathname);
          return cachedResponse;
        }
        
        // Not in cache, fetch from network
        console.log('[SW] Fetching from network:', url.pathname);
        return fetch(request)
          .then((networkResponse) => {
            // Cache successful responses
            if (networkResponse && networkResponse.status === 200) {
              const responseToCache = networkResponse.clone();
              caches.open(CACHE_NAME)
                .then((cache) => {
                  cache.put(request, responseToCache);
                });
            }
            return networkResponse;
          })
          .catch((error) => {
            console.error('[SW] Fetch failed:', error);
            // Return offline page if available
            return caches.match('/index.html');
          });
      })
  );
});

// Message event - handle commands from the app
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => caches.delete(cacheName))
        );
      })
    );
  }
});