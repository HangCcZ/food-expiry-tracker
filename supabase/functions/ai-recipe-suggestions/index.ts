import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

import type { FoodItem, ProcessingMetrics } from './types.ts'
import { buildIngredientList, generateIngredientHash } from './helpers.ts'
import { checkCache, storeInCache } from './cache.ts'
import { callOpenAI } from './openai.ts'
import {
  webpush,
  sendPushNotifications,
  sendEmail,
  buildNotificationPayload,
  buildFallbackPayload,
  buildRecipeEmailHtml,
  buildFallbackEmailHtml,
} from './notifications.ts'

// ============================================
// CORS
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

// ============================================
// MAIN HANDLER
// ============================================

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
      return await handleSingleMode(req, supabaseAdmin, authHeader, corsHeaders, startTime, body)
    }

    return await handleBatchMode(supabaseAdmin, authHeader, serviceRoleKey, corsHeaders, startTime)
  } catch (error: any) {
    console.error('Error in ai-recipe-suggestions:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

// ============================================
// SINGLE-USER MODE (frontend-triggered)
// ============================================

async function handleSingleMode(
  req: Request,
  supabaseAdmin: any,
  authHeader: string,
  corsHeaders: Record<string, string>,
  startTime: number,
  body: Record<string, any>
) {
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

  // Rate limit: max 3 recipe requests per user per day
  const todayMidnight = new Date()
  todayMidnight.setHours(0, 0, 0, 0)

  const { count: requestCount, error: rateLimitError } = await supabaseAdmin
    .from('notification_log')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('notification_type', 'recipe_suggestion_single')
    .gte('sent_at', todayMidnight.toISOString())

  if (!rateLimitError && requestCount !== null && requestCount >= 3) {
    return new Response(
      JSON.stringify({ error: 'Daily limit reached. You can request up to 3 recipe suggestions per day.' }),
      {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }

  // Query this user's expiring items within the requested range
  const days = Math.min(30, Math.max(1, parseInt(body.expiryDays) || 3))
  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]
  const rangeEnd = new Date()
  rangeEnd.setDate(rangeEnd.getDate() + days)

  let query = supabaseAdmin
    .from('food_items')
    .select('id, name, expiry_date, category, user_id')
    .eq('user_id', userId)
    .eq('status', 'active')

  // If specific item IDs are provided, use those instead of date range
  if (Array.isArray(body.itemIds) && body.itemIds.length > 0) {
    query = query.in('id', body.itemIds)
  } else {
    query = query.gte('expiry_date', todayStr).lte('expiry_date', rangeEnd.toISOString().split('T')[0])
  }

  const { data: userItems, error: userItemsError } = await query.order('expiry_date', { ascending: true })

  if (userItemsError) {
    throw new Error(`Failed to fetch items: ${userItemsError.message}`)
  }

  if (!userItems || userItems.length === 0) {
    const message = Array.isArray(body.itemIds) && body.itemIds.length > 0
      ? 'No matching items found'
      : `No items expiring in the next ${days} day${days > 1 ? 's' : ''}`
    return new Response(
      JSON.stringify({ recipes: [], ingredients: [], cached: false, message }),
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
  const cached = !!recipes

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

  // Log request for rate limiting
  await supabaseAdmin.from('notification_log').insert({
    user_id: userId,
    notification_type: 'recipe_suggestion_single',
    food_item_ids: userItems.map((i: FoodItem) => i.id),
    ingredient_hash: hash,
    status: 'sent',
  })

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

async function handleBatchMode(
  supabaseAdmin: any,
  authHeader: string,
  serviceRoleKey: string,
  corsHeaders: Record<string, string>,
  startTime: number
) {
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
      await processUserBatch(supabaseAdmin, userId, items as FoodItem[], metrics)
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
}

/**
 * Process a single user in batch mode: generate/fetch recipes, send notifications.
 */
async function processUserBatch(
  supabaseAdmin: any,
  userId: string,
  items: FoodItem[],
  metrics: ProcessingMetrics[]
) {
  // Check if user has notifications enabled
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('notification_enabled, email')
    .eq('id', userId)
    .single()

  if (!profile?.notification_enabled) {
    return // Skip users who disabled notifications
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
    return
  }

  // Build ingredient list and generate hash early so we can
  // check if this exact ingredient set was already notified
  const ingredients = buildIngredientList(items)

  if (ingredients.length === 0) {
    return // No valid ingredients
  }

  const hash = await generateIngredientHash(ingredients)

  // Skip if user was already notified for this exact ingredient set
  const { data: alreadyNotified } = await supabaseAdmin
    .from('notification_log')
    .select('id')
    .eq('user_id', userId)
    .eq('notification_type', 'recipe_suggestion')
    .eq('ingredient_hash', hash)
    .limit(1)

  if (alreadyNotified && alreadyNotified.length > 0) {
    return // Already notified for this ingredient set
  }

  // Check cache
  let recipes = await checkCache(supabaseAdmin, hash)
  const cacheHit = !!recipes
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
      await sendFallbackNotification(supabaseAdmin, userId, items, hash, subscriptions, hasPush, hasEmail, profile, metrics, ingredients)
      return
    }
  }

  // Send notification with recipes
  let sent = false

  if (hasPush) {
    const payload = buildNotificationPayload(recipes, ingredients)
    const { successCount, results: pushResults } =
      await sendPushNotifications(supabaseAdmin, subscriptions!, payload)
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
}

/**
 * Send fallback notification when AI fails in batch mode.
 */
async function sendFallbackNotification(
  supabaseAdmin: any,
  userId: string,
  items: FoodItem[],
  hash: string,
  subscriptions: any,
  hasPush: boolean,
  hasEmail: boolean,
  profile: any,
  metrics: ProcessingMetrics[],
  ingredients: string[]
) {
  let notificationMethod: 'fallback_push' | 'fallback_email' = 'fallback_push'
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
    error: `AI failed, sent fallback`,
  })
}
