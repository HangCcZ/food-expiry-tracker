# Food Expiry Tracker

## Project Overview
PWA that tracks food expiry dates and sends AI-powered recipe suggestions using expiring ingredients.

## Tech Stack
- **Frontend**: Next.js (App Router), React 19, Tailwind CSS 4, TypeScript
- **Backend**: Supabase (Postgres, Auth, Edge Functions, Realtime)
- **AI**: OpenAI gpt-5-mini via Responses API
- **Notifications**: web-push (VAPID) + Resend email fallback
- **Deployment**: Vercel (frontend), Supabase (Edge Functions)
- **CI**: GitHub Actions (lint, test, type-check, build)

## Key Commands
```bash
npm run dev          # Start dev server
npm run build        # Production build
npm run lint         # ESLint
npm test             # Vitest (49 tests)
npx tsc --noEmit     # Type check
```

## Project Structure
```
app/                          # Next.js App Router pages
  auth/login/page.tsx         # Magic link login
  auth/callback/route.ts      # Auth callback handler
  error.tsx                   # Error boundary
  global-error.tsx            # Global error boundary
  page.tsx                    # Main page (AuthGuard + Dashboard)
components/
  Dashboard.tsx               # Main dashboard with collapsible categories
  FoodItemForm.tsx            # Add/edit form with validation
  FoodItemCard.tsx            # Individual food item card
  AuthGuard.tsx               # Auth wrapper
  PushNotificationSetup.tsx   # Push notification opt-in
  RecipeSuggestions.tsx        # AI recipe suggestions UI
lib/
  hooks/useAuth.ts            # Auth state hook
  hooks/useFoodItems.ts       # CRUD hook with realtime
  supabase/client.ts          # Browser Supabase client
  supabase/server.ts          # Server Supabase client
  utils/dateHelpers.ts        # Date calculations and formatting
  utils/validation.ts         # Form validation
  utils/pushNotifications.ts  # Push notification helpers
middleware.ts                 # Supabase session refresh
types/index.ts                # All TypeScript interfaces
supabase/
  functions/
    ai-recipe-suggestions/    # Modular Edge Function
      index.ts                # Main handler (single + batch mode)
      types.ts                # Shared interfaces
      helpers.ts              # Ingredient list + hash
      cache.ts                # Recipe cache read/write
      openai.ts               # OpenAI Responses API call
      notifications.ts        # Push + email sending
    send-expiry-reminders/    # Daily expiry reminder function
```

## Architecture Decisions
- **Recipe cache**: Same ingredient hash = same recipes forever (no time-based expiry)
- **Idempotency**: `notification_log.ingredient_hash` prevents re-notifying for same ingredients
- **Push-first, email fallback**: Try push notification, fall back to Resend email
- **AI failure**: Sends generic fallback notification instead of failing silently
- **Rate limiting**: Max 3 recipe requests/user/day via notification_log counting

## OpenAI gpt-5-mini API
- Use **Responses API** (`/v1/responses`), NOT Chat Completions
- Request: `{ model, instructions, input, max_output_tokens: 16000 }`
- Response: use `result.output_text` or walk `result.output[].content[].text`
- `temperature` not supported, `max_output_tokens` covers reasoning + visible output

## Important Patterns
- Edge Functions use **Deno runtime** — imports need `.ts` extension, use `npm:` and `https://esm.sh/` specifiers
- Edge Functions are **excluded from ESLint** (can't lint Deno imports in Node context)
- Service worker uses **network-only** for API/Supabase requests (cache-first for static assets)
- Date strings (`YYYY-MM-DD`) must use `+ 'T00:00:00'` when creating Date objects to avoid UTC timezone bugs
- Auth uses Supabase magic link (passwordless)
- CORS on Edge Functions uses `ALLOWED_ORIGINS` env var (comma-separated)

## Supabase CLI
- Use `npx supabase` (not global install)
- Deploy Edge Function: `npx supabase functions deploy ai-recipe-suggestions --no-verify-jwt`
- Secrets set via Supabase Dashboard UI, not CLI

## Testing
- Vitest with fake timers for date-dependent tests
- Tests in `lib/utils/__tests__/`
- Path alias `@/*` resolved via vitest.config.ts
