import type { RecipeSuggestion } from './types.ts'

/**
 * Call OpenAI gpt-5-mini to generate recipe suggestions.
 * Uses the Responses API (/v1/responses) which is the modern endpoint.
 */
export async function callOpenAI(ingredients: string[]): Promise<{
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
  let content: string | null = null

  // Try output_text convenience field first
  if (result.output_text) {
    content = result.output_text
  }

  // Walk the output array looking for text content
  if (!content && Array.isArray(result.output)) {
    for (const item of result.output) {
      if (Array.isArray(item.content)) {
        for (const block of item.content) {
          if (block.text) {
            content = block.text
            break
          }
        }
      }
      if (!content && item.text) {
        content = item.text
      }
      if (content) break
    }
  }

  if (!content) {
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
