'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { RecipeSuggestion } from '@/types'

const EXPIRY_DAY_OPTIONS = [1, 2, 3, 5, 7] as const

interface RecipeSuggestionsProps {
  selectedItemIds?: string[]
  onDismiss?: () => void
}

export default function RecipeSuggestions({ selectedItemIds, onDismiss }: RecipeSuggestionsProps = {}) {
  const [recipes, setRecipes] = useState<RecipeSuggestion[] | null>(null)
  const [ingredients, setIngredients] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cached, setCached] = useState(false)
  const [expiryDays, setExpiryDays] = useState(3)

  const handleGetRecipes = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const supabase = createClient()

      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      if (sessionError || !session) {
        throw new Error('Please sign in to get recipe suggestions')
      }

      const requestBody: Record<string, unknown> = { mode: 'single', expiryDays }
      if (selectedItemIds && selectedItemIds.length > 0) {
        requestBody.itemIds = selectedItemIds
      }

      const { data, error: fnError } = await supabase.functions.invoke(
        'ai-recipe-suggestions',
        { body: requestBody }
      )

      if (fnError) {
        // Extract actual error body from non-2xx responses
        let message = 'Failed to get recipe suggestions'
        try {
          if (fnError.context && typeof fnError.context.json === 'function') {
            const body = await fnError.context.json()
            message = body.error || message
          }
        } catch { /* use default message */ }
        throw new Error(message)
      }

      if (data.error) {
        throw new Error(data.error)
      }

      setRecipes(data.recipes)
      setIngredients(data.ingredients || [])
      setCached(data.cached || false)

      if (data.recipes.length === 0) {
        setError(data.message || 'No expiring items to make recipes from')
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [expiryDays, selectedItemIds])

  // Auto-trigger when selectedItemIds are provided (multi-select mode)
  useEffect(() => {
    if (selectedItemIds && selectedItemIds.length > 0) {
      handleGetRecipes()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Initial state — compact trigger
  if (!recipes && !loading && !error) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-900">AI Recipe Ideas</p>
              <p className="text-xs text-gray-500 truncate">Suggestions based on your expiring ingredients</p>
            </div>
          </div>
          <button
            onClick={handleGetRecipes}
            className="px-3 py-1.5 bg-orange-600 text-white text-xs font-medium rounded-lg hover:bg-orange-700 shrink-0"
          >
            Get Ideas
          </button>
        </div>
        <div className="flex items-center gap-2 mt-2 ml-11">
          <span className="text-xs text-gray-500">Expiring in:</span>
          <div className="flex gap-1">
            {EXPIRY_DAY_OPTIONS.map((d) => (
              <button
                key={d}
                onClick={() => setExpiryDays(d)}
                className={`px-2 py-0.5 text-xs rounded-full transition-colors ${
                  expiryDays === d
                    ? 'bg-orange-600 text-white'
                    : 'bg-orange-50 text-orange-600 hover:bg-orange-100'
                }`}
              >
                {d}d
              </button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // Loading state
  if (loading) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
        <div className="flex flex-col items-center justify-center gap-2">
          <div className="w-8 h-8 border-3 border-orange-200 border-t-orange-600 rounded-full animate-spin"></div>
          <p className="text-sm text-gray-600 font-medium">
            Generating recipe ideas...
          </p>
          <p className="text-xs text-gray-400">
            This may take 15-20 seconds
          </p>
        </div>
      </div>
    )
  }

  // Error state
  if (error && (!recipes || recipes.length === 0)) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center shrink-0">
            <svg className="w-4 h-4 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-900">AI Recipe Ideas</p>
            <p className="text-xs text-red-500 truncate">{error}</p>
          </div>
        </div>
        <button
          onClick={handleGetRecipes}
          className="px-3 py-1.5 bg-orange-600 text-white text-xs font-medium rounded-lg hover:bg-orange-700 shrink-0"
        >
          Retry
        </button>
      </div>
    )
  }

  // Recipes loaded
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-orange-50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-orange-800">
            {selectedItemIds ? `Recipe Ideas (${selectedItemIds.length} items)` : 'Recipe Ideas'}
          </span>
          {cached && (
            <span className="text-[10px] font-medium text-orange-500 bg-orange-100 px-1.5 py-0.5 rounded">
              cached
            </span>
          )}
          {ingredients.length > 0 && (
            <span className="text-xs text-orange-600 hidden sm:inline">
              using {ingredients.join(', ')}
            </span>
          )}
        </div>
        <button
          onClick={() => {
            setRecipes(null)
            setError(null)
            setCached(false)
            onDismiss?.()
          }}
          className="text-xs text-orange-500 hover:text-orange-700"
        >
          Dismiss
        </button>
      </div>

      {/* Recipe cards */}
      <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-3">
        {recipes!.map((recipe, i) => (
          <div
            key={i}
            className="border border-gray-150 rounded-lg p-3 flex flex-col bg-gray-50"
          >
            <h4 className="font-semibold text-sm text-gray-900 mb-1">{recipe.title}</h4>
            <p className="text-xs text-gray-500 mb-2">{recipe.description}</p>

            {recipe.steps && recipe.steps.length > 0 && (
              <ol className="text-xs text-gray-600 space-y-1 mb-2 flex-1">
                {recipe.steps.map((step, j) => (
                  <li key={j} className="flex gap-1.5">
                    <span className="text-orange-400 font-semibold shrink-0">
                      {j + 1}.
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            )}

            <div className="flex flex-wrap gap-1 mt-auto pt-2 border-t border-gray-200">
              {recipe.ingredients_used.map((ing, j) => (
                <span
                  key={j}
                  className="text-[10px] bg-orange-50 text-orange-600 px-1.5 py-0.5 rounded"
                >
                  {ing}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
