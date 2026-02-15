# Frontend Recipe Suggestions - Implementation Plan

## Overview
Add a UI component so users can manually trigger AI recipe suggestions for their expiring food and view them inline in the app.

## Changes Required

### 1. Modify Edge Function — Add single-user mode
**File:** `supabase/functions/ai-recipe-suggestions/index.ts`

- Parse request body for `{ mode: 'single' }`
- When `mode === 'single'`:
  - Extract user ID from the JWT in the Authorization header (using `supabaseAdmin.auth.getUser()`)
  - Query only that user's expiring food items (0-3 days)
  - Build ingredient list, hash, check cache, call AI if needed, store cache
  - **Return recipes in the response body** (no push notification needed — user is already in the app)
  - Skip idempotency check (user explicitly asked for suggestions)
- When no mode specified: existing batch/cron behavior unchanged

### 2. Create RecipeSuggestions component
**File:** `components/RecipeSuggestions.tsx` (new)

- **Trigger button:** "Get Recipe Ideas" with cooking emoji, styled like existing Dashboard cards
- **Loading state:** Spinner + "Generating recipes..." message (AI takes ~15-20s)
- **Recipe cards:** 3 cards in a grid showing title, description, and ingredients used
- **Empty state:** Message when user has no expiring items
- **Error state:** Friendly error message with retry button
- Calls `supabase.functions.invoke('ai-recipe-suggestions', { body: { mode: 'single' } })`
- Styling: matches existing green theme, card borders, Tailwind patterns

### 3. Add component to page
**File:** `app/page.tsx`

- Render `RecipeSuggestions` between `PushNotificationSetup` and `Dashboard`

## Flow
1. User clicks "Get Recipe Ideas" button
2. Frontend calls Edge Function with `mode: 'single'`
3. Edge Function verifies JWT, queries user's expiring items
4. Checks recipe_cache for existing suggestions (same ingredient hash)
5. If cache miss → calls OpenAI gpt-5-mini → stores in cache
6. Returns `{ recipes: [...], ingredients: [...], cached: boolean }` to frontend
7. Frontend renders 3 recipe cards

## Files Modified
- `supabase/functions/ai-recipe-suggestions/index.ts` — add single-user mode
- `components/RecipeSuggestions.tsx` — new component
- `app/page.tsx` — add RecipeSuggestions to page
