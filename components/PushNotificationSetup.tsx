'use client';

import { useState, useEffect } from 'react';
import {
  isPushNotificationSupported,
  getNotificationPermission,
  subscribeToPushNotifications,
  unsubscribeFromPushNotifications,
  showTestNotification,
  extractSubscriptionDetails,
} from '@/lib/utils/pushNotifications';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/hooks/useAuth';

export default function PushNotificationSetup() {
  const { user } = useAuth();
  const [isSupported, setIsSupported] = useState(false);
  const [permission, setPermission] =
    useState<NotificationPermission>('default');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showBanner, setShowBanner] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    setIsSupported(isPushNotificationSupported());

    if (isPushNotificationSupported()) {
      setPermission(getNotificationPermission());
      checkSubscriptionStatus();
    }
  }, []);

  const checkSubscriptionStatus = async () => {
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration) {
        const subscription = await registration.pushManager.getSubscription();
        setIsSubscribed(!!subscription);
      }
    } catch (error) {
      console.error('Error checking subscription status:', error);
    }
  };

  const handleEnableNotifications = async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      const subscription = await subscribeToPushNotifications();

      if (subscription) {
        const subscriptionData = extractSubscriptionDetails(subscription);

        const { error } = await supabase.from('push_subscriptions').insert([
          {
            user_id: user.id,
            endpoint: subscriptionData.endpoint,
            p256dh: subscriptionData.p256dh,
            auth: subscriptionData.auth,
            user_agent: navigator.userAgent,
            is_active: true,
          },
        ]);

        if (error) throw error;

        await supabase
          .from('profiles')
          .update({ notification_enabled: true })
          .eq('id', user.id);

        setIsSubscribed(true);
        setPermission('granted');
        setShowBanner(false);

        await showTestNotification();
      }
    } catch (error: unknown) {
      console.error('Error enabling notifications:', error);
      alert(error instanceof Error ? error.message : 'Failed to enable notifications');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisableNotifications = async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      await unsubscribeFromPushNotifications();

      await supabase
        .from('push_subscriptions')
        .update({ is_active: false })
        .eq('user_id', user.id);

      await supabase
        .from('profiles')
        .update({ notification_enabled: false })
        .eq('id', user.id);

      setIsSubscribed(false);
      setShowBanner(true);
    } catch (error: unknown) {
      console.error('Error disabling notifications:', error);
      alert(error instanceof Error ? error.message : 'Failed to disable notifications');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestNotification = async () => {
    try {
      await showTestNotification();
    } catch (error: unknown) {
      alert(error instanceof Error ? error.message : 'Failed to show test notification');
    }
  };

  if (!isSupported) return null;

  // Enable banner
  if (showBanner && permission !== 'denied' && !isSubscribed) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
            <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-900">Enable expiry reminders</p>
            <p className="text-xs text-gray-500 truncate">Get notified when food is about to expire</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={handleEnableNotifications}
            disabled={isLoading}
            className="px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded-lg hover:bg-green-700 disabled:opacity-50"
          >
            {isLoading ? 'Enabling...' : 'Enable'}
          </button>
          <button
            onClick={() => setShowBanner(false)}
            className="p-1 text-gray-300 hover:text-gray-500"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    );
  }

  // Subscribed state — compact
  if (isSubscribed) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg px-3 py-2 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-500"></div>
          <span className="text-xs text-gray-600">Reminders enabled</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleTestNotification}
            className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded"
          >
            Test
          </button>
          <button
            onClick={handleDisableNotifications}
            disabled={isLoading}
            className="px-2 py-1 text-xs text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded disabled:opacity-50"
          >
            Disable
          </button>
        </div>
      </div>
    );
  }

  // Dismissed — minimal link
  if (!isSubscribed && permission !== 'denied') {
    return (
      <div className="text-center">
        <button
          onClick={() => setShowBanner(true)}
          className="text-xs text-gray-400 hover:text-blue-600"
        >
          Enable expiry reminders
        </button>
      </div>
    );
  }

  return null;
}
