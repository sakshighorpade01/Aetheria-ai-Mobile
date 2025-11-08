// sw.js - Production Service Worker for Aetheria AI PWA
const CACHE_VERSION = 'aetheria-v1.1.1';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const DYNAMIC_CACHE = `${CACHE_VERSION}-dynamic`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;

// Assets to cache immediately on install
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/assets/icon.png',
  '/assets/splash-512.png',
  '/assets/splash-1024.png',
  '/assets/splash-2048.png',
  
  // Core CSS
  '/css/splash-screen.css',
  '/css/design-system.css',
  '/css/style.css',
  '/css/chat-variables.css',
  '/css/chat-layout.css',
  '/css/chat-messages.css',
  '/css/chat-context.css',
  '/css/chat-input.css',
  '/css/notifications.css',
  '/css/welcome-message.css',
  '/css/chat.css',
  '/css/to-do-list.css',
  '/css/artifact-ui.css',
  '/css/aios.css',
  '/css/mobile.css',
  '/css/modals.css',
  '/css/install-prompt.css',
  
  // Core JS modules
  '/js/splash-screen.js',
  '/js/config.js',
  '/js/supabase-client.js',
  '/js/socket-service.js',
  '/js/notification-service.js',
  '/js/aios.js',
  '/js/chat.js',
  '/js/context-handler.js',
  '/js/file-attachment-handler.js',
  '/js/message-formatter.js',
  '/js/artifact-handler.js',
  '/js/add-files.js',
  '/js/to-do-list.js',
  '/js/welcome-display.js',
  '/js/shuffle-menu-controller.js',
  '/js/conversation-state-manager.js',
  '/js/auth-service.js'
];

// CDN resources (cache but don't block install)
const CDN_RESOURCES = [
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
  'https://cdn.jsdelivr.net/npm/marked/marked.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/dompurify/3.0.6/purify.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js',
  'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js',
  'https://cdn.socket.io/4.7.5/socket.io.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/atom-one-dark.min.css'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');
  
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('[SW] Caching static assets');
        // Cache static assets, but don't fail install if some fail
        return cache.addAll(STATIC_ASSETS.map(url => new Request(url, { cache: 'reload' })))
          .catch((err) => {
            console.warn('[SW] Failed to cache some static assets:', err);
            // Cache individually to avoid complete failure
            return Promise.allSettled(
              STATIC_ASSETS.map(url => 
                cache.add(new Request(url, { cache: 'reload' }))
                  .catch(e => console.warn(`[SW] Failed to cache ${url}:`, e))
              )
            );
          });
      })
      .then(() => {
        console.log('[SW] Static assets cached successfully');
        // Skip waiting to activate immediately
        return self.skipWaiting();
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => {
              // Delete caches that don't match current version
              return name.startsWith('aetheria-') && 
                     !name.startsWith(CACHE_VERSION);
            })
            .map((name) => {
              console.log('[SW] Deleting old cache:', name);
              return caches.delete(name);
            })
        );
      })
      .then(() => {
        console.log('[SW] Service worker activated');
        // Take control of all pages immediately
        return self.clients.claim();
      })
  );
});

// Fetch event - implement caching strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }
  
  // Skip chrome-extension and other non-http(s) requests
  if (!url.protocol.startsWith('http')) {
    return;
  }
  
  // CRITICAL: Never cache real-time endpoints (socket.io, sessions API)
  // This prevents stale connection states and ensures fresh data
  if (url.pathname.includes('socket.io') || 
      url.pathname.includes('/api/sessions') ||
      url.pathname.includes('/api/integrations')) {
    // Direct network request, no caching
    event.respondWith(fetch(request));
    return;
  }
  
  // Strategy 1: Network-first for other API calls (with timeout)
  if (url.pathname.startsWith('/api/') || 
      url.pathname.startsWith('/login/') ||
      url.hostname.includes('onrender.com') ||
      url.hostname.includes('supabase.co') ||
      url.hostname.includes('railway.app')) {
    event.respondWith(networkFirstWithTimeout(request, 5000));
    return;
  }
  
  // Strategy 2: Cache-first for static assets
  if (STATIC_ASSETS.some(asset => url.pathname === asset || url.pathname.endsWith(asset))) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }
  
  // Strategy 3: Stale-while-revalidate for CDN resources
  if (CDN_RESOURCES.some(cdn => request.url.startsWith(cdn)) || 
      url.hostname.includes('cdnjs.cloudflare.com') ||
      url.hostname.includes('cdn.jsdelivr.net')) {
    event.respondWith(staleWhileRevalidate(request, DYNAMIC_CACHE));
    return;
  }
  
  // Strategy 4: Network-first with cache fallback for everything else
  event.respondWith(networkFirst(request, RUNTIME_CACHE));
});

// Caching Strategies

// Cache-first: Check cache, fallback to network
async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) {
    return cached;
  }
  
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    console.error('[SW] Cache-first fetch failed:', error);
    return offlineFallback(request);
  }
}

// Network-first: Try network, fallback to cache
async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }
    console.error('[SW] Network-first fetch failed:', error);
    return offlineFallback(request);
  }
}

// Network-first with timeout
async function networkFirstWithTimeout(request, timeout) {
  try {
    const response = await Promise.race([
      fetch(request),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Network timeout')), timeout)
      )
    ]);
    return response;
  } catch (error) {
    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }
    console.error('[SW] Network request timed out or failed:', error);
    // For API calls, return error response instead of offline page
    return new Response(
      JSON.stringify({ error: 'Network unavailable', offline: true }),
      { 
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

// Stale-while-revalidate: Return cache immediately, update in background
async function staleWhileRevalidate(request, cacheName) {
  const cached = await caches.match(request);
  
  const fetchPromise = fetch(request).then((response) => {
    if (response.ok) {
      // Clone the response before using it, as response body can only be consumed once
      const responseToCache = response.clone();
      caches.open(cacheName).then(cache => {
        cache.put(request, responseToCache);
      });
    }
    return response;
  }).catch(err => {
    console.warn('[SW] Background fetch failed:', err);
    return cached;
  });
  
  return cached || fetchPromise;
}

// Offline fallback
async function offlineFallback(request) {
  const url = new URL(request.url);
  
  // For navigation requests, return cached index.html
  if (request.mode === 'navigate' || request.destination === 'document') {
    const cached = await caches.match('/index.html');
    if (cached) {
      return cached;
    }
  }
  
  // For images, return cached icon as placeholder
  if (request.destination === 'image') {
    const cached = await caches.match('/assets/icon.png');
    if (cached) {
      return cached;
    }
  }
  
  // Generic offline response
  return new Response(
    `<!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Offline - Aetheria AI</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          margin: 0;
          background: #1a1a1a;
          color: #fff;
        }
        .offline-container {
          text-align: center;
          padding: 2rem;
        }
        .offline-icon {
          font-size: 4rem;
          margin-bottom: 1rem;
        }
        h1 { margin: 0 0 0.5rem; }
        p { color: #999; }
        button {
          margin-top: 1.5rem;
          padding: 0.75rem 1.5rem;
          background: #333;
          color: #fff;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          font-size: 1rem;
        }
        button:hover { background: #444; }
      </style>
    </head>
    <body>
      <div class="offline-container">
        <div class="offline-icon">📡</div>
        <h1>You're Offline</h1>
        <p>Please check your internet connection and try again.</p>
        <button onclick="window.location.reload()">Retry</button>
      </div>
    </body>
    </html>`,
    {
      status: 503,
      statusText: 'Service Unavailable',
      headers: { 'Content-Type': 'text/html' }
    }
  );
}

// Handle messages from clients
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CACHE_URLS') {
    const urls = event.data.urls || [];
    caches.open(DYNAMIC_CACHE).then(cache => {
      urls.forEach(url => {
        cache.add(url).catch(err => 
          console.warn(`[SW] Failed to cache ${url}:`, err)
        );
      });
    });
  }
});