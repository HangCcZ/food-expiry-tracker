import type { FoodItem } from './types.ts'

/**
 * Build a normalized, deduplicated, sorted ingredient list from food items.
 */
export function buildIngredientList(items: FoodItem[]): string[] {
  const normalized = items.map((item) => item.name.trim().toLowerCase())
  const unique = [...new Set(normalized)]
  unique.sort()
  return unique
}

/**
 * Generate a deterministic SHA-256 hash of the ingredient list.
 * Uses the Web Crypto API (natively available in Deno).
 */
export async function generateIngredientHash(ingredients: string[]): Promise<string> {
  const canonical = ingredients.join('|')
  const encoder = new TextEncoder()
  const data = encoder.encode(canonical)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}
