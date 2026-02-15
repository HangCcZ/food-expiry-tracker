/**
 * Service Worker for Food Expiry Tracker PWA
 *
 * Responsibilities:
 * - Cache app assets for offline access
 * - Handle push notifications
 * - Background sync (future enhancement)
 */

const CACHE_NAME = 'food-tracker-v1'
const urlsToCache = [
  '/',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
]

// ============================================
// INSTALL EVENT
// ============================================
// Cache essential assets when SW is first installed
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('Service Worker: Caching app shell')
      return cache.addAll(urlsToCache).catch((err) => {
        console.log('Cache addAll error:', err)
      })
    })
  )
  // Activate immediately
  self.skipWaiting()
})

// ============================================
// ACTIVATE EVENT
// ============================================
// Clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Service Worker: Clearing old cache', cacheName)
            return caches.delete(cacheName)
          }
        })
      )
    })
  )
  // Take control immediately
  self.clients.claim()
})

// ============================================
// FETCH EVENT
// ============================================
// Network-first strategy for API calls, cache-first for static assets
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return

  // API / Supabase requests: Network-only (never cache sensitive data)
  if (event.request.url.includes('/api/') || event.request.url.includes('supabase')) {
    event.respondWith(fetch(event.request))
    return
  }

  // Static assets: Network-first in development, cache-first in production
  const isDevServer = event.request.url.includes('localhost') || event.request.url.includes('127.0.0.1')

  if (isDevServer) {
    // Development: always go to network so hot reload works
    event.respondWith(fetch(event.request))
    return
  }

  // Production: Cache-first
  event.respondWith(
    caches.match(event.request).then((response) => {
      if (response) {
        return response
      }
      return fetch(event.request).then((response) => {
        // Don't cache if not a valid response
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response
        }
        const responseClone = response.clone()
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseClone)
        })
        return response
      })
    })
  )
})

// ============================================
// PUSH EVENT
// ============================================
// Handle incoming push notifications
self.addEventListener('push', (event) => {
  console.log('Service Worker: Push received', event)

  let data = {
    title: 'Food Expiry Tracker',
    body: 'You have items expiring soon!',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-72x72.png',
    data: {
      url: '/',
    },
  }

  // Parse push data if available
  if (event.data) {
    try {
      data = event.data.json()
    } catch (e) {
      console.error('Failed to parse push data:', e)
    }
  }

  const options = {
    body: data.body,
    icon: data.icon || '/icons/icon-192x192.png',
    badge: data.badge || '/icons/badge-72x72.png',
    vibrate: [200, 100, 200], // Vibration pattern
    tag: 'expiry-reminder', // Group similar notifications
    renotify: true, // Alert even if notification with same tag exists
    requireInteraction: false, // Auto-dismiss after timeout
    data: data.data,
    actions: [
      {
        action: 'open',
        title: 'View Items',
        icon: '/icons/view-icon.png',
      },
      {
        action: 'close',
        title: 'Dismiss',
        icon: '/icons/close-icon.png',
      },
    ],
  }

  event.waitUntil(self.registration.showNotification(data.title, options))
})

// ============================================
// NOTIFICATION CLICK EVENT
// ============================================
// Handle user interaction with notifications
self.addEventListener('notificationclick', (event) => {
  console.log('Service Worker: Notification clicked', event)

  event.notification.close()

  // Handle action buttons
  if (event.action === 'close') {
    return
  }

  // Default action or 'open' action: navigate to app
  const urlToOpen = event.notification.data?.url || '/'

  event.waitUntil(
    clients
      .matchAll({
        type: 'window',
        includeUncontrolled: true,
      })
      .then((clientList) => {
        // If app is already open, focus it
        for (const client of clientList) {
          if (client.url === urlToOpen && 'focus' in client) {
            return client.focus()
          }
        }
        // Otherwise, open new window
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen)
        }
      })
  )
})

// ============================================
// BACKGROUND SYNC (Future Enhancement)
// ============================================
// Uncomment when implementing offline-first features
/*
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-food-items') {
    event.waitUntil(syncFoodItems())
  }
})

async function syncFoodItems() {
  // Implement sync logic here
  console.log('Background sync triggered')
}
*/
