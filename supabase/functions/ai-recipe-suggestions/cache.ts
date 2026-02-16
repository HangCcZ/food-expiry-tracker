import type { RecipeSuggestion } from './types.ts'

/**
 * Check if a cached recipe exists for this ingredient hash.
 * Cache entries are valid indefinitely for the same hash — the same
 * ingredient set always produces the same recipes. No need to re-call AI.
 */
export async function checkCache(
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
 * Store AI-generated recipes in the cache.
 */
export async function storeInCache(
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
