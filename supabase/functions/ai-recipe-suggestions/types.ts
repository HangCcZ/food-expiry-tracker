export interface FoodItem {
  id: string
  name: string
  expiry_date: string
  category: string
  user_id: string
}

export interface PushSubscription {
  endpoint: string
  p256dh: string
  auth: string
}

export interface RecipeSuggestion {
  title: string
  description: string
  steps: string[]
  ingredients_used: string[]
}

export interface ProcessingMetrics {
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
