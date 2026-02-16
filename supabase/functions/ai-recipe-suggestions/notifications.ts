import webpush from 'npm:web-push@3.6.6'
import type { FoodItem, PushSubscription, RecipeSuggestion } from './types.ts'

export { webpush }

/**
 * Build push notification payload with recipe suggestions.
 */
export function buildNotificationPayload(
  recipes: RecipeSuggestion[],
  ingredients: string[]
): string {
  const title = `🍳 Recipe ideas for your expiring food!`
  const recipeTitles = recipes
    .map((r, i) => `${i + 1}. ${r.title}`)
    .join('\n')
  const ingredientSummary = ingredients.slice(0, 5).join(', ')
  const body = `${recipeTitles}\n\nUsing: ${ingredientSummary}${ingredients.length > 5 ? '...' : ''}`

  return JSON.stringify({
    title,
    body,
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-72x72.png',
    tag: 'recipe-suggestion',
    data: {
      url: '/',
      type: 'recipe_suggestion',
    },
  })
}

/**
 * Build fallback notification payload when AI fails.
 */
export function buildFallbackPayload(items: FoodItem[]): string {
  const itemNames = items
    .slice(0, 3)
    .map((i) => i.name)
    .join(', ')
  const suffix =
    items.length > 3 ? ` and ${items.length - 3} more` : ''

  return JSON.stringify({
    title: '🍎 Use your expiring ingredients!',
    body: `${itemNames}${suffix} are expiring soon. Check the app for ideas!`,
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-72x72.png',
    tag: 'recipe-suggestion',
    data: {
      url: '/',
      type: 'recipe_suggestion_fallback',
    },
  })
}

/**
 * Build HTML email body for recipe suggestions.
 */
export function buildRecipeEmailHtml(
  recipes: RecipeSuggestion[],
  ingredients: string[]
): string {
  const recipeCards = recipes
    .map(
      (r) => `
      <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px; margin-bottom: 12px;">
        <h3 style="margin: 0 0 8px 0; color: #166534; font-size: 16px;">${r.title}</h3>
        <p style="margin: 0 0 8px 0; color: #374151; font-size: 14px;">${r.description}</p>
        <p style="margin: 0; color: #6b7280; font-size: 12px;">Uses: ${r.ingredients_used.join(', ')}</p>
      </div>`
    )
    .join('')

  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
      <div style="text-align: center; margin-bottom: 24px;">
        <span style="font-size: 48px;">🍳</span>
        <h1 style="margin: 8px 0 4px 0; color: #111827; font-size: 20px;">Recipe Ideas for You</h1>
        <p style="margin: 0; color: #6b7280; font-size: 14px;">Your ingredients (${ingredients.join(', ')}) are expiring soon!</p>
      </div>
      ${recipeCards}
      <div style="text-align: center; margin-top: 24px;">
        <p style="color: #9ca3af; font-size: 12px;">Food Expiry Tracker — Reduce waste, eat well.</p>
      </div>
    </div>`
}

/**
 * Build fallback HTML email when AI fails.
 */
export function buildFallbackEmailHtml(items: FoodItem[]): string {
  const itemList = items
    .map(
      (i) =>
        `<li style="color: #374151; font-size: 14px; margin-bottom: 4px;">${i.name} — expires ${i.expiry_date}</li>`
    )
    .join('')

  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
      <div style="text-align: center; margin-bottom: 24px;">
        <span style="font-size: 48px;">🍎</span>
        <h1 style="margin: 8px 0 4px 0; color: #111827; font-size: 20px;">Food Expiring Soon!</h1>
        <p style="margin: 0; color: #6b7280; font-size: 14px;">Some of your food is expiring — time to use it up!</p>
      </div>
      <ul style="padding-left: 20px;">${itemList}</ul>
      <div style="text-align: center; margin-top: 24px;">
        <p style="color: #9ca3af; font-size: 12px;">Food Expiry Tracker — Reduce waste, eat well.</p>
      </div>
    </div>`
}

/**
 * Send email via Resend API.
 */
export async function sendEmail(
  to: string,
  subject: string,
  html: string
): Promise<boolean> {
  const apiKey = Deno.env.get('RESEND_API_KEY')
  const from = Deno.env.get('RESEND_FROM_EMAIL') || 'Food Tracker <noreply@foodtracker.app>'

  if (!apiKey) {
    console.error('RESEND_API_KEY is not configured, skipping email')
    return false
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject,
        html,
      }),
    })

    if (!response.ok) {
      const errorBody = await response.text()
      console.error(`Resend API error ${response.status}: ${errorBody}`)
      return false
    }

    return true
  } catch (error) {
    console.error('Failed to send email via Resend:', error)
    return false
  }
}

/**
 * Send push notifications to all user subscriptions.
 * Returns the number of successful sends.
 */
export async function sendPushNotifications(
  supabaseAdmin: any,
  subscriptions: PushSubscription[],
  payload: string
): Promise<{
  successCount: number
  results: Array<{ success: boolean; endpoint: string; error?: string }>
}> {
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
    } catch (error: any) {
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

  const results = await Promise.all(pushPromises)
  const successCount = results.filter((r) => r.success).length

  return { successCount, results }
}
