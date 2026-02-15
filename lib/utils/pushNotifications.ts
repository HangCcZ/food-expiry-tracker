/**
 * Utility functions for Web Push Notifications
 */

/**
 * Convert VAPID public key from base64 to Uint8Array
 * Required for push subscription
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')

  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray as Uint8Array<ArrayBuffer>
}

/**
 * Check if push notifications are supported
 */
export function isPushNotificationSupported(): boolean {
  return (
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  )
}

/**
 * Get current notification permission status
 */
export function getNotificationPermission(): NotificationPermission {
  return Notification.permission
}

/**
 * Request notification permission from user
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!isPushNotificationSupported()) {
    throw new Error('Push notifications are not supported')
  }

  const permission = await Notification.requestPermission()
  return permission
}

/**
 * Register service worker and subscribe to push notifications
 */
export async function subscribeToPushNotifications(): Promise<PushSubscription | null> {
  if (!isPushNotificationSupported()) {
    throw new Error('Push notifications are not supported')
  }

  // Request permission first
  const permission = await requestNotificationPermission()
  if (permission !== 'granted') {
    throw new Error('Notification permission denied')
  }

  try {
    // Register service worker
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
    })

    // Wait for service worker to be ready
    await navigator.serviceWorker.ready

    // Check if already subscribed
    const existingSubscription = await registration.pushManager.getSubscription()
    if (existingSubscription) {
      return existingSubscription
    }

    // Subscribe to push notifications
    const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    if (!vapidPublicKey) {
      throw new Error('VAPID public key not configured')
    }

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    })

    return subscription
  } catch (error) {
    console.error('Error subscribing to push notifications:', error)
    throw error
  }
}

/**
 * Unsubscribe from push notifications
 */
export async function unsubscribeFromPushNotifications(): Promise<boolean> {
  if (!isPushNotificationSupported()) {
    return false
  }

  try {
    const registration = await navigator.serviceWorker.getRegistration()
    if (!registration) return false

    const subscription = await registration.pushManager.getSubscription()
    if (!subscription) return false

    const unsubscribed = await subscription.unsubscribe()
    return unsubscribed
  } catch (error) {
    console.error('Error unsubscribing from push notifications:', error)
    return false
  }
}

/**
 * Show a local test notification
 */
export async function showTestNotification(): Promise<void> {
  if (!('Notification' in window)) {
    throw new Error('Notifications are not supported')
  }

  const permission = await requestNotificationPermission()
  if (permission !== 'granted') {
    throw new Error('Notification permission denied')
  }

  // Try service worker notification first, fall back to basic Notification API
  const registration = await navigator.serviceWorker?.getRegistration()
  if (registration?.active) {
    await registration.showNotification('Food Expiry Tracker', {
      body: 'Push notifications are working!',
      icon: '/icons/icon-192x192.png',
      badge: '/icons/badge-72x72.png',
      tag: 'test-notification',
    })
  } else {
    new Notification('Food Expiry Tracker', {
      body: 'Push notifications are working!',
      icon: '/icons/icon-192x192.png',
      tag: 'test-notification',
    })
  }
}

/**
 * Extract push subscription details for sending to server
 */
export function extractSubscriptionDetails(subscription: PushSubscription) {
  const keys = subscription.toJSON().keys
  return {
    endpoint: subscription.endpoint,
    p256dh: keys?.p256dh || '',
    auth: keys?.auth || '',
  }
}
