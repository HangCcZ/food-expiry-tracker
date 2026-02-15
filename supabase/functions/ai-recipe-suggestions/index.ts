import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

// Web Push library for Deno
import webpush from 'npm:web-push@3.6.6'

/**
 * Edge Function: AI Recipe Suggestions
 *
 * Triggered by: Daily cron job (configured in Supabase dashboard)
 * Purpose: Generate recipe suggestions for expiring food using OpenAI gpt-5-mini
 *
 * Flow:
 * 1. Query food items expiring in next 0-3 days
 * 2. Group items by user
 * 3. Build ingredient list and generate deterministic hash
 * 4. Check recipe cache for existing suggestions
 * 5. If cache miss, call OpenAI gpt-5-mini
 * 6. Store AI result in cache
 * 7. Send push notification (or email fallback via Resend)
 * 8. Log notification to prevent duplicates
 */

interface FoodItem {
  id: string
  name: string
  expiry_date: string
  category: string
  user_id: string
}

interface PushSubscription {
  endpoint: string
  p256dh: string
  auth: string
}

interface RecipeSuggestion {
  title: string
  description: string
  steps: string[]
  ingredients_used: string[]
}

interface ProcessingMetrics {
  userId: string
  ingredientCount: number
  cacheHit: boolean
  aiCallTimeMs?: number
  promptTokens?: number
  completionTokens?: number
  notificationMethod?: 'push' | 'email' | 'fallback_push' | 'fallback_email'
  pushResults?: Array<{ success: boolean; endpoint: string; error?: string }>
  error?: string
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Build a normalized, deduplicated, sorted ingredient list from food items.
 */
function buildIngredientList(items: FoodItem[]): string[] {
  const normalized = items.map((item) => item.name.trim().toLowerCase())
  const unique = [...new Set(normalized)]
  unique.sort()
  return unique
}

/**
 * Generate a deterministic SHA-256 hash of the ingredient list.
 * Uses the Web Crypto API (natively available in Deno).
 */
async function generateIngredientHash(ingredients: string[]): Promise<string> {
  const canonical = ingredients.join('|')
  const encoder = new TextEncoder()
  const data = encoder.encode(canonical)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Check if a cached recipe exists for this ingredient hash.
 * Cache entries are valid indefinitely for the same hash — the same
 * ingredient set always produces the same recipes. No need to re-call AI.
 */
async function checkCache(
  supabaseAdmin: any,
  hash: string
): Promise<RecipeSuggestion[] | null> {
  const { data, error } = await supabaseAdmin
    .from('recipe_cache')
    .select('recipes')
    .eq('ingredient_hash', hash)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error || !data) return null
  return data.recipes as RecipeSuggestion[]
}

/**
 * Call OpenAI gpt-5-mini to generate recipe suggestions.
 * Uses the Responses API (/v1/responses) which is the modern endpoint.
 */
async function callOpenAI(ingredients: string[]): Promise<{
  recipes: RecipeSuggestion[]
  usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number }
  timeMs: number
  promptText: string
}> {
  const apiKey = Deno.env.get('OPENAI_API_KEY')
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured')
  }

  const instructions = `You are a helpful cooking assistant for a food waste reduction app. Your job is to suggest simple, practical recipes that use ingredients which are about to expire. Rules:
- Suggest exactly 3 recipes
- Each recipe should be simple and achievable in under 30 minutes
- Prioritize using as many of the listed expiring ingredients as possible
- Include common pantry staples (salt, pepper, oil, etc.) as needed but focus on the expiring items
- Keep the description to 1 short sentence
- Provide 3-5 concise cooking steps
- Respond ONLY with a JSON array, no markdown, no explanation outside the JSON

Response format:
[
  {
    "title": "Recipe Name",
    "description": "One sentence summary of the dish.",
    "steps": ["Step 1 instruction", "Step 2 instruction", "Step 3 instruction"],
    "ingredients_used": ["ingredient1", "ingredient2"]
  }
]`

  const userPrompt = `I have these ingredients expiring soon: ${ingredients.join(', ')}. Suggest 3 simple recipes I can make to use them up.`

  const startTime = Date.now()

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-5-mini',
      instructions,
      input: userPrompt,
      max_output_tokens: 16000,
    }),
  })

  const timeMs = Date.now() - startTime

  if (!response.ok) {
    const errorBody = await response.text()
    throw new Error(`OpenAI API error ${response.status}: ${errorBody}`)
  }

  const result = await response.json()

  // Check for API-level errors
  if (result.status && result.status !== 'completed') {
    const errMsg = result.error
      ? JSON.stringify(result.error)
      : `status=${result.status}`
    throw new Error(`OpenAI response not completed: ${errMsg}`)
  }

  // Extract text from Responses API output
  // The output array contains message objects with content arrays
  let content: string | null = null

  // Try output_text convenience field first
  if (result.output_text) {
    content = result.output_text
  }

  // Walk the output array looking for text content
  if (!content && Array.isArray(result.output)) {
    for (const item of result.output) {
      // Format: { type: "message", content: [{ type: "output_text", text: "..." }] }
      if (Array.isArray(item.content)) {
        for (const block of item.content) {
          if (block.text) {
            content = block.text
            break
          }
        }
      }
      // Format: { type: "text", text: "..." }
      if (!content && item.text) {
        content = item.text
      }
      if (content) break
    }
  }

  if (!content) {
    // Log details to help debug the response structure
    console.error('OpenAI empty response. Status:', result.status)
    console.error('OpenAI error field:', JSON.stringify(result.error))
    console.error('OpenAI output field:', JSON.stringify(result.output))
    console.error('OpenAI incomplete_details:', JSON.stringify(result.incomplete_details))
    throw new Error(
      `OpenAI returned empty content. Status: ${result.status}, error: ${JSON.stringify(result.error)}, output length: ${Array.isArray(result.output) ? result.output.length : 'not array'}`
    )
  }

  // Parse the JSON response — strip markdown fences if present
  let jsonStr = content.trim()
  if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
  }

  let parsed: any
  try {
    parsed = JSON.parse(jsonStr)
  } catch {
    throw new Error(
      `Failed to parse OpenAI response as JSON: ${content.substring(0, 200)}`
    )
  }

  // Handle both [...] and { recipes: [...] } formats
  const recipes: any[] = Array.isArray(parsed) ? parsed : parsed.recipes

  if (!Array.isArray(recipes) || recipes.length === 0) {
    throw new Error('OpenAI response did not contain a valid recipes array')
  }

  // Validate and sanitize each recipe
  const validated: RecipeSuggestion[] = recipes.slice(0, 3).map((r) => ({
    title: String(r.title || 'Untitled Recipe'),
    description: String(
      r.description || 'A quick recipe with your expiring ingredients.'
    ),
    steps: Array.isArray(r.steps)
      ? r.steps.map(String)
      : [],
    ingredients_used: Array.isArray(r.ingredients_used)
      ? r.ingredients_used.map(String)
      : [],
  }))

  // Responses API uses input_tokens/output_tokens
  const usage = result.usage ?? {}

  return {
    recipes: validated,
    usage: {
      prompt_tokens: usage.input_tokens ?? usage.prompt_tokens ?? 0,
      completion_tokens: usage.output_tokens ?? usage.completion_tokens ?? 0,
      total_tokens: usage.total_tokens ?? (usage.input_tokens ?? 0) + (usage.output_tokens ?? 0),
    },
    timeMs,
    promptText: userPrompt,
  }
}

/**
 * Store AI-generated recipes in the cache.
 */
async function storeInCache(
  supabaseAdmin: any,
  hash: string,
  ingredients: string[],
  recipes: RecipeSuggestion[],
  promptText: string,
  usage: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  },
  timeMs: number
): Promise<void> {
  const { error } = await supabaseAdmin.from('recipe_cache').insert({
    ingredient_hash: hash,
    ingredients,
    recipes,
    prompt_text: promptText,
    model: 'gpt-5-mini',
    prompt_tokens: usage.prompt_tokens,
    completion_tokens: usage.completion_tokens,
    total_tokens: usage.total_tokens,
    generation_time_ms: timeMs,
  })

  if (error) {
    console.error('Failed to store recipe cache:', error)
    // Non-fatal: recipes were still generated, just won't be cached
  }
}

/**
 * Build push notification payload with recipe suggestions.
 */
function buildNotificationPayload(
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
function buildFallbackPayload(items: FoodItem[]): string {
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
function buildRecipeEmailHtml(
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
function buildFallbackEmailHtml(items: FoodItem[]): string {
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
async function sendEmail(
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
async function sendPushNotifications(
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

// ============================================
// MAIN HANDLER
// ============================================

function getCorsHeaders(req: Request) {
  const origin = req.headers.get('Origin') ?? ''
  // Comma-separated list, e.g. "https://myapp.vercel.app,http://localhost:3000"
  const allowedOrigins = (Deno.env.get('ALLOWED_ORIGINS') ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean)

  // Allow same-origin requests (no Origin header) or matching origins
  const isAllowed = !origin || allowedOrigins.includes(origin)
  return {
    'Access-Control-Allow-Origin': isAllowed ? origin : '',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req)

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const startTime = Date.now()

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Initialize Supabase client with service role (bypass RLS)
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      serviceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    )

    // Check if this is a single-user request from the frontend
    let body: Record<string, any> = {}
    try {
      body = await req.json()
    } catch {
      // No body — batch/cron mode
    }

    if (body.mode === 'single') {
      // ============================================
      // SINGLE-USER MODE (frontend-triggered)
      // ============================================
      // Verify user JWT and return recipes in the response
      const token = authHeader.replace('Bearer ', '')
      const { data: { user: authUser }, error: authError } = await supabaseAdmin.auth.getUser(token)

      if (authError || !authUser) {
        return new Response(JSON.stringify({ error: 'Invalid token' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const userId = authUser.id

      // Query this user's expiring items (0-3 days)
      const today = new Date()
      const todayStr = today.toISOString().split('T')[0]
      const threeDaysFromNow = new Date()
      threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3)

      const { data: userItems, error: userItemsError } = await supabaseAdmin
        .from('food_items')
        .select('id, name, expiry_date, category, user_id')
        .eq('user_id', userId)
        .eq('status', 'active')
        .gte('expiry_date', todayStr)
        .lte('expiry_date', threeDaysFromNow.toISOString().split('T')[0])
        .order('expiry_date', { ascending: true })

      if (userItemsError) {
        throw new Error(`Failed to fetch items: ${userItemsError.message}`)
      }

      if (!userItems || userItems.length === 0) {
        return new Response(
          JSON.stringify({ recipes: [], ingredients: [], cached: false, message: 'No items expiring in the next 3 days' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const ingredients = buildIngredientList(userItems)
      if (ingredients.length === 0) {
        return new Response(
          JSON.stringify({ recipes: [], ingredients: [], cached: false, message: 'No valid ingredients found' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const hash = await generateIngredientHash(ingredients)

      // Check cache first
      let recipes = await checkCache(supabaseAdmin, hash)
      let cached = !!recipes

      // If cache miss, call OpenAI
      if (!recipes) {
        const aiResult = await callOpenAI(ingredients)
        recipes = aiResult.recipes

        // Store in cache for future use
        await storeInCache(
          supabaseAdmin,
          hash,
          ingredients,
          recipes,
          aiResult.promptText,
          aiResult.usage,
          aiResult.timeMs
        )
      }

      return new Response(
        JSON.stringify({
          recipes,
          ingredients,
          cached,
          executionTimeMs: Date.now() - startTime,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ============================================
    // BATCH MODE (cron-triggered)
    // ============================================

    // Batch mode requires the service role key — reject user JWTs
    const token = authHeader.replace('Bearer ', '')
    if (token !== serviceRoleKey) {
      return new Response(JSON.stringify({ error: 'Forbidden: batch mode requires service role key' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Configure Web Push with VAPID keys
    webpush.setVapidDetails(
      `mailto:${Deno.env.get('VAPID_EMAIL')}`,
      Deno.env.get('VAPID_PUBLIC_KEY') ?? '',
      Deno.env.get('VAPID_PRIVATE_KEY') ?? ''
    )

    // 1. Find all active food items expiring in the next 3 days
    const today = new Date()
    const todayStr = today.toISOString().split('T')[0]
    const threeDaysFromNow = new Date()
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3)

    const { data: expiringItems, error: itemsError } = await supabaseAdmin
      .from('food_items')
      .select('id, name, expiry_date, category, user_id')
      .eq('status', 'active')
      .gte('expiry_date', todayStr)
      .lte('expiry_date', threeDaysFromNow.toISOString().split('T')[0])
      .order('expiry_date', { ascending: true })

    if (itemsError) {
      throw new Error(`Failed to fetch expiring items: ${itemsError.message}`)
    }

    if (!expiringItems || expiringItems.length === 0) {
      return new Response(
        JSON.stringify({
          message: 'No expiring items found',
          count: 0,
          executionTimeMs: Date.now() - startTime,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 2. Group items by user
    const itemsByUser = expiringItems.reduce(
      (acc, item) => {
        if (!acc[item.user_id]) {
          acc[item.user_id] = []
        }
        acc[item.user_id].push(item)
        return acc
      },
      {} as Record<string, FoodItem[]>
    )

    const metrics: ProcessingMetrics[] = []

    // 3. Process each user
    for (const [userId, items] of Object.entries(itemsByUser)) {
      try {
        // Check if user has notifications enabled
        const { data: profile } = await supabaseAdmin
          .from('profiles')
          .select('notification_enabled, email')
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

        const hasPush = subscriptions && subscriptions.length > 0
        const hasEmail = !!profile.email

        // Skip users with no delivery method
        if (!hasPush && !hasEmail) {
          continue
        }

        // Build ingredient list and generate hash early so we can
        // check if this exact ingredient set was already notified
        const ingredients = buildIngredientList(items)

        if (ingredients.length === 0) {
          continue // No valid ingredients
        }

        const hash = await generateIngredientHash(ingredients)

        // Skip if user was already notified for this exact ingredient set.
        // Since expiry dates don't change unless the user updates them,
        // re-notifying for the same set would be redundant.
        const { data: alreadyNotified } = await supabaseAdmin
          .from('notification_log')
          .select('id')
          .eq('user_id', userId)
          .eq('notification_type', 'recipe_suggestion')
          .eq('ingredient_hash', hash)
          .limit(1)

        if (alreadyNotified && alreadyNotified.length > 0) {
          continue // Already notified for this ingredient set
        }

        // Check cache
        let recipes = await checkCache(supabaseAdmin, hash)
        let cacheHit = !!recipes
        let aiMetrics: Partial<ProcessingMetrics> = {}

        // If cache miss, call OpenAI
        if (!recipes) {
          try {
            const aiResult = await callOpenAI(ingredients)
            recipes = aiResult.recipes
            aiMetrics = {
              aiCallTimeMs: aiResult.timeMs,
              promptTokens: aiResult.usage.prompt_tokens,
              completionTokens: aiResult.usage.completion_tokens,
            }

            // Store in cache
            await storeInCache(
              supabaseAdmin,
              hash,
              ingredients,
              recipes,
              aiResult.promptText,
              aiResult.usage,
              aiResult.timeMs
            )
          } catch (aiError: any) {
            // AI failure: send fallback notification
            console.error(`OpenAI error for user ${userId}:`, aiError)

            let notificationMethod: 'fallback_push' | 'fallback_email' =
              'fallback_push'
            let sent = false

            if (hasPush) {
              const fallbackPayload = buildFallbackPayload(items)
              const { successCount } = await sendPushNotifications(
                supabaseAdmin,
                subscriptions!,
                fallbackPayload
              )
              sent = successCount > 0
            } else if (hasEmail) {
              notificationMethod = 'fallback_email'
              const html = buildFallbackEmailHtml(items)
              sent = await sendEmail(
                profile.email,
                '🍎 Use your expiring ingredients!',
                html
              )
            }

            if (sent) {
              const { error: logError } = await supabaseAdmin.from('notification_log').insert({
                user_id: userId,
                notification_type: 'recipe_suggestion',
                food_item_ids: items.map((i) => i.id),
                ingredient_hash: hash,
                status: 'sent',
              })
              if (logError) {
                console.error('Failed to insert fallback notification_log:', JSON.stringify(logError))
              }
            }

            metrics.push({
              userId,
              ingredientCount: ingredients.length,
              cacheHit: false,
              notificationMethod,
              error: `AI failed, sent fallback: ${aiError.message}`,
            })
            continue
          }
        }

        // Send notification with recipes
        let notificationMethod: 'push' | 'email' = 'push'
        let sent = false

        if (hasPush) {
          const payload = buildNotificationPayload(recipes, ingredients)
          const { successCount, results: pushResults } =
            await sendPushNotifications(
              supabaseAdmin,
              subscriptions!,
              payload
            )
          sent = successCount > 0

          metrics.push({
            userId,
            ingredientCount: ingredients.length,
            cacheHit,
            ...aiMetrics,
            notificationMethod: 'push',
            pushResults,
          })
        } else if (hasEmail) {
          notificationMethod = 'email'
          const html = buildRecipeEmailHtml(recipes, ingredients)
          sent = await sendEmail(
            profile.email,
            '🍳 Recipe ideas for your expiring food!',
            html
          )

          metrics.push({
            userId,
            ingredientCount: ingredients.length,
            cacheHit,
            ...aiMetrics,
            notificationMethod: 'email',
          })
        }

        // Log the notification
        if (sent) {
          const { error: logError } = await supabaseAdmin.from('notification_log').insert({
            user_id: userId,
            notification_type: 'recipe_suggestion',
            food_item_ids: items.map((i) => i.id),
            ingredient_hash: hash,
            status: 'sent',
          })
          if (logError) {
            console.error('Failed to insert notification_log:', JSON.stringify(logError))
          }
        }
      } catch (userError: any) {
        console.error(`Error processing user ${userId}:`, userError)
        metrics.push({
          userId,
          ingredientCount: 0,
          cacheHit: false,
          error: userError.message,
        })
      }
    }

    // Summary response with observability metrics
    return new Response(
      JSON.stringify({
        message: 'AI recipe suggestions processed',
        totalItems: expiringItems.length,
        usersProcessed: Object.keys(itemsByUser).length,
        totalAICalls: metrics.filter(
          (m) => !m.cacheHit && !m.error?.startsWith('AI failed')
        ).length,
        totalCacheHits: metrics.filter((m) => m.cacheHit).length,
        totalPushSent: metrics.filter((m) => m.notificationMethod === 'push')
          .length,
        totalEmailSent: metrics.filter((m) => m.notificationMethod === 'email')
          .length,
        totalFallbacks: metrics.filter((m) =>
          m.notificationMethod?.startsWith('fallback')
        ).length,
        totalErrors: metrics.filter(
          (m) => m.error && !m.error.startsWith('AI failed')
        ).length,
        executionTimeMs: Date.now() - startTime,
        results: metrics,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error: any) {
    console.error('Error in ai-recipe-suggestions:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
