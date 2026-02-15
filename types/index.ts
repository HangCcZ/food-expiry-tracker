// Database types matching our Supabase schema

export interface Profile {
  id: string
  email: string
  notification_enabled: boolean
  created_at: string
  updated_at: string
}

export interface FoodItem {
  id: string
  user_id: string
  name: string
  quantity?: string | null
  category?: string | null
  expiry_date: string
  status: 'active' | 'used' | 'tossed'
  notes?: string | null
  added_date: string
  created_at: string
  updated_at: string
}

export interface PushSubscription {
  id: string
  user_id: string
  endpoint: string
  p256dh: string
  auth: string
  user_agent?: string | null
  is_active: boolean
  created_at: string
  updated_at: string
  last_used_at?: string | null
}

export interface NotificationLog {
  id: string
  user_id: string
  notification_type: string
  food_item_ids: string[]
  sent_at: string
  status: 'sent' | 'failed' | 'delivered'
  error_message?: string | null
  created_at: string
}

// Form types
export interface FoodItemFormData {
  name: string
  quantity?: string
  category?: string
  expiry_date: string
  notes?: string
}

// Categorized food items for dashboard
export interface CategorizedItems {
  urgent: FoodItem[] // 0-2 days
  soon: FoodItem[] // 3-5 days
  safe: FoodItem[] // > 5 days
}

// Categories for food items
export const FOOD_CATEGORIES = [
  'Dairy',
  'Meat',
  'Seafood',
  'Vegetables',
  'Fruits',
  'Grains',
  'Bakery',
  'Frozen',
  'Beverages',
  'Condiments',
  'Other',
] as const

export type FoodCategory = (typeof FOOD_CATEGORIES)[number]

// Quantity units
export const QUANTITY_UNITS = [
  'g',
  'kg',
  'oz',
  'lb',
  'ml',
  'L',
  'cup',
  'tbsp',
  'tsp',
  'piece',
  'pack',
  'bottle',
  'can',
] as const

export type QuantityUnit = (typeof QUANTITY_UNITS)[number]

// AI Recipe Suggestion types

export interface RecipeSuggestion {
  title: string
  description: string
  steps: string[]
  ingredients_used: string[]
}

export interface RecipeCache {
  id: string
  ingredient_hash: string
  ingredients: string[]
  recipes: RecipeSuggestion[]
  prompt_text?: string | null
  model: string
  prompt_tokens?: number | null
  completion_tokens?: number | null
  total_tokens?: number | null
  generation_time_ms?: number | null
  created_at: string
  expires_at: string
}
