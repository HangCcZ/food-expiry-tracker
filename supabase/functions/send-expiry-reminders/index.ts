import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

// Web Push library for Deno
import webpush from 'npm:web-push@3.6.6'

/**
 * Edge Function: Send Expiry Reminders
 *
 * Triggered by: Daily cron job (configured in Supabase dashboard)
 * Purpose: Send push notifications to users about expiring food items
 *
 * Flow:
 * 1. Query food items expiring in next 0-5 days
 * 2. Group items by user
 * 3. Check if user has notifications enabled and push subscriptions
 * 4. Send push notification with grouped items
 * 5. Log notification to prevent duplicates
 */

interface FoodItem {
  id: string
  name: string
  expiry_date: string
  category: string
  user_id: string
}

serve(async (req) => {
  try {
    // Verify this is called by Supabase cron or has valid auth
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Initialize Supabase client with service role (bypass RLS)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    )

    // Configure Web Push with VAPID keys
    webpush.setVapidDetails(
      `mailto:${Deno.env.get('VAPID_EMAIL')}`,
      Deno.env.get('VAPID_PUBLIC_KEY') ?? '',
      Deno.env.get('VAPID_PRIVATE_KEY') ?? ''
    )

    // 1. Find all active food items expiring in the next 5 days
    const fiveDaysFromNow = new Date()
    fiveDaysFromNow.setDate(fiveDaysFromNow.getDate() + 5)

    const { data: expiringItems, error: itemsError } = await supabaseAdmin
      .from('food_items')
      .select('id, name, expiry_date, category, user_id')
      .eq('status', 'active')
      .lte('expiry_date', fiveDaysFromNow.toISOString().split('T')[0])
      .order('expiry_date', { ascending: true })

    if (itemsError) {
      throw new Error(`Failed to fetch expiring items: ${itemsError.message}`)
    }

    if (!expiringItems || expiringItems.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No expiring items found', count: 0 }),
        { headers: { 'Content-Type': 'application/json' } }
      )
    }

    // 2. Group items by user
    const itemsByUser = expiringItems.reduce((acc, item) => {
      if (!acc[item.user_id]) {
        acc[item.user_id] = []
      }
      acc[item.user_id].push(item)
      return acc
    }, {} as Record<string, FoodItem[]>)

    const results = []

    // 3. Process each user
    for (const [userId, items] of Object.entries(itemsByUser)) {
      try {
        // Check if user has notifications enabled
        const { data: profile } = await supabaseAdmin
          .from('profiles')
          .select('notification_enabled')
          .eq('id', userId)
          .single()

        if (!profile?.notification_enabled) {
          continue // Skip users who disabled notifications
        }

        // Get user's active push subscriptions
        const { data: subscriptions } = await supabaseAdmin
          .from('push_subscriptions')
          .select('endpoint, p256dh, auth')
          .eq('user_id', userId)
          .eq('is_active', true)

        if (!subscriptions || subscriptions.length === 0) {
          continue // Skip users without push subscriptions
        }

        // Check if we already sent notification today for these items
        const today = new Date().toISOString().split('T')[0]
        const { data: sentToday } = await supabaseAdmin
          .from('notification_log')
          .select('id')
          .eq('user_id', userId)
          .eq('notification_type', 'expiry_reminder')
          .gte('sent_at', `${today}T00:00:00Z`)

        if (sentToday && sentToday.length > 0) {
          continue // Already sent notification today
        }

        // 4. Categorize items by urgency
        const urgent = items.filter((item) => {
          const daysUntilExpiry = Math.floor(
            (new Date(item.expiry_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
          )
          return daysUntilExpiry <= 2
        })

        const soon = items.filter((item) => {
          const daysUntilExpiry = Math.floor(
            (new Date(item.expiry_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
          )
          return daysUntilExpiry > 2 && daysUntilExpiry <= 5
        })

        // Create notification message
        let title = '🍎 Food Expiry Alert'
        let body = ''

        if (urgent.length > 0) {
          title = `⚠️ ${urgent.length} item${urgent.length > 1 ? 's' : ''} expiring soon!`
          body = urgent.map((i) => `• ${i.name} (${i.expiry_date})`).join('\n')
          if (soon.length > 0) {
            body += `\n\n${soon.length} more item${soon.length > 1 ? 's' : ''} expiring this week`
          }
        } else if (soon.length > 0) {
          title = `📅 ${soon.length} item${soon.length > 1 ? 's' : ''} expiring this week`
          body = soon.slice(0, 3).map((i) => `• ${i.name} (${i.expiry_date})`).join('\n')
          if (soon.length > 3) {
            body += `\n...and ${soon.length - 3} more`
          }
        }

        const payload = JSON.stringify({
          title,
          body,
          icon: '/icons/icon-192x192.png',
          badge: '/icons/badge-72x72.png',
          data: {
            url: '/',
            itemCount: items.length,
          },
        })

        // 5. Send push notification to all user's subscriptions
        const pushPromises = subscriptions.map(async (sub) => {
          try {
            await webpush.sendNotification(
              {
                endpoint: sub.endpoint,
                keys: {
                  p256dh: sub.p256dh,
                  auth: sub.auth,
                },
              },
              payload
            )
            return { success: true, endpoint: sub.endpoint }
          } catch (error) {
            // If subscription is invalid (410 Gone), mark it as inactive
            if (error.statusCode === 410) {
              await supabaseAdmin
                .from('push_subscriptions')
                .update({ is_active: false })
                .eq('endpoint', sub.endpoint)
            }
            return { success: false, endpoint: sub.endpoint, error: error.message }
          }
        })

        const pushResults = await Promise.all(pushPromises)
        const successCount = pushResults.filter((r) => r.success).length

        // 6. Log the notification
        if (successCount > 0) {
          await supabaseAdmin.from('notification_log').insert({
            user_id: userId,
            notification_type: 'expiry_reminder',
            food_item_ids: items.map((i) => i.id),
            status: 'sent',
          })
        }

        results.push({
          userId,
          itemCount: items.length,
          pushResults,
        })
      } catch (userError) {
        console.error(`Error processing user ${userId}:`, userError)
        results.push({
          userId,
          error: userError.message,
        })
      }
    }

    return new Response(
      JSON.stringify({
        message: 'Expiry reminders processed',
        totalItems: expiringItems.length,
        usersProcessed: Object.keys(itemsByUser).length,
        results,
      }),
      { headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error in send-expiry-reminders:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
