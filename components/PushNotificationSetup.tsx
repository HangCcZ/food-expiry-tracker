'use client'

import { useState, useEffect } from 'react'
import {
  isPushNotificationSupported,
  getNotificationPermission,
  subscribeToPushNotifications,
  unsubscribeFromPushNotifications,
  showTestNotification,
  extractSubscriptionDetails,
} from '@/lib/utils/pushNotifications'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/hooks/useAuth'

export default function PushNotificationSetup() {
  const { user } = useAuth()
  const [isSupported, setIsSupported] = useState(false)
  const [permission, setPermission] = useState<NotificationPermission>('default')
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [showBanner, setShowBanner] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    // Check if push notifications are supported
    setIsSupported(isPushNotificationSupported())

    if (isPushNotificationSupported()) {
      setPermission(getNotificationPermission())
      checkSubscriptionStatus()
    }
  }, [])

  const checkSubscriptionStatus = async () => {
    try {
      const registration = await navigator.serviceWorker.getRegistration()
      if (registration) {
        const subscription = await registration.pushManager.getSubscription()
        setIsSubscribed(!!subscription)
      }
    } catch (error) {
      console.error('Error checking subscription status:', error)
    }
  }

  const handleEnableNotifications = async () => {
    if (!user) return

    setIsLoading(true)
    try {
      // Subscribe to push notifications
      const subscription = await subscribeToPushNotifications()

      if (subscription) {
        // Send subscription to server
        const subscriptionData = extractSubscriptionDetails(subscription)

        const { error } = await supabase.from('push_subscriptions').insert([
          {
            user_id: user.id,
            endpoint: subscriptionData.endpoint,
            p256dh: subscriptionData.p256dh,
            auth: subscriptionData.auth,
            user_agent: navigator.userAgent,
            is_active: true,
          },
        ])

        if (error) throw error

        // Update profile to enable notifications
        await supabase
          .from('profiles')
          .update({ notification_enabled: true })
          .eq('id', user.id)

        setIsSubscribed(true)
        setPermission('granted')
        setShowBanner(false)

        // Show test notification
        await showTestNotification()
      }
    } catch (error: any) {
      console.error('Error enabling notifications:', error)
      alert(error.message || 'Failed to enable notifications')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDisableNotifications = async () => {
    if (!user) return

    setIsLoading(true)
    try {
      // Unsubscribe from push notifications
      await unsubscribeFromPushNotifications()

      // Mark all subscriptions as inactive in database
      await supabase
        .from('push_subscriptions')
        .update({ is_active: false })
        .eq('user_id', user.id)

      // Update profile
      await supabase
        .from('profiles')
        .update({ notification_enabled: false })
        .eq('id', user.id)

      setIsSubscribed(false)
      setShowBanner(false)
    } catch (error: any) {
      console.error('Error disabling notifications:', error)
      alert(error.message || 'Failed to disable notifications')
    } finally {
      setIsLoading(false)
    }
  }

  const handleTestNotification = async () => {
    try {
      await showTestNotification()
    } catch (error: any) {
      alert(error.message || 'Failed to show test notification')
    }
  }

  // Don't show if not supported
  if (!isSupported) return null

  // Show banner if notifications are not enabled
  if (showBanner && permission !== 'granted' && !isSubscribed) {
    return (
      <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-6">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <svg
              className="h-5 w-5 text-blue-400"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <div className="ml-3 flex-1">
            <h3 className="text-sm font-medium text-blue-800">
              Enable Expiry Reminders
            </h3>
            <p className="mt-1 text-sm text-blue-700">
              Get notified when your food is about to expire so you never waste food again!
            </p>
            <div className="mt-3 flex gap-2">
              <button
                onClick={handleEnableNotifications}
                disabled={isLoading}
                className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
              >
                {isLoading ? 'Enabling...' : 'Enable Notifications'}
              </button>
              <button
                onClick={() => setShowBanner(false)}
                className="px-4 py-2 text-sm text-blue-700 hover:text-blue-900"
              >
                Maybe Later
              </button>
            </div>
          </div>
          <button
            onClick={() => setShowBanner(false)}
            className="ml-3 flex-shrink-0"
          >
            <svg
              className="h-5 w-5 text-blue-400 hover:text-blue-600"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>
      </div>
    )
  }

  // Show status if subscribed
  if (isSubscribed) {
    return (
      <div className="bg-green-50 border-l-4 border-green-400 p-4 mb-6">
        <div className="flex items-start justify-between">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg
                className="h-5 w-5 text-green-400"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-green-800">
                Notifications enabled ✓
              </p>
              <p className="mt-1 text-xs text-green-700">
                You&apos;ll receive daily reminders about expiring items
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleTestNotification}
              className="text-xs text-green-700 hover:text-green-900 underline"
            >
              Test
            </button>
            <button
              onClick={handleDisableNotifications}
              disabled={isLoading}
              className="text-xs text-green-700 hover:text-green-900 underline"
            >
              Disable
            </button>
          </div>
        </div>
      </div>
    )
  }

  return null
}
