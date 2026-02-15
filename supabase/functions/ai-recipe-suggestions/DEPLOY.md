# AI Recipe Suggestions - Deployment Guide

## Prerequisites

- Supabase CLI installed and linked to your project
- OpenAI API key (https://platform.openai.com/api-keys)
- Resend API key (https://resend.com/api-keys) for email fallback

## Step 1: Run Database Migration

In Supabase SQL Editor, run the contents of:

```
supabase/migrations/20240201000000_recipe_cache.sql
```

This creates the `recipe_cache` table for caching AI-generated recipes.

## Step 2: Set Secrets

```bash
supabase secrets set OPENAI_API_KEY=sk-your-openai-key
supabase secrets set RESEND_API_KEY=re_your-resend-key
supabase secrets set RESEND_FROM_EMAIL="Food Tracker <noreply@yourdomain.com>"
```

The following secrets should already be set from the expiry reminders setup:

- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_EMAIL`

## Step 3: Deploy the Edge Function

```bash
supabase functions deploy ai-recipe-suggestions
```

## Step 4: Schedule Daily Cron Job

Run in Supabase SQL Editor (replace `your-project-ref` and `YOUR_SERVICE_ROLE_KEY`):

```sql
SELECT cron.schedule(
  'send-daily-recipe-suggestions',
  '30 9 * * *',
  $$
  SELECT
    net.http_post(
      url:='https://your-project-ref.supabase.co/functions/v1/ai-recipe-suggestions',
      headers:=jsonb_build_object(
        'Content-Type','application/json',
        'Authorization', 'Bearer W2OzRBdx7YWiQUSE'
      )
    ) as request_id;
  $$
);
```

This runs at 9:30 AM UTC daily (30 min after the expiry reminders cron at 9:00 AM).

## Step 5: Test Manually

```bash
curl -X POST https://your-project-ref.supabase.co/functions/v1/ai-recipe-suggestions \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json"
```

Expected response includes: `usersProcessed`, `totalAICalls`, `totalCacheHits`, `executionTimeMs`.

## Optional: Cache Cleanup Cron

Cleans up expired recipe cache entries weekly (Sundays 3 AM UTC):

```sql
SELECT cron.schedule(
  'cleanup-expired-recipe-cache',
  '0 3 * * 0',
  $$
  DELETE FROM recipe_cache WHERE expires_at < NOW();
  $$
);
```

## Troubleshooting

- **No notifications sent**: Check that test users have `notification_enabled = true` in `profiles` and either active push subscriptions or a valid email.
- **OpenAI errors**: Check Supabase function logs. The function sends a fallback notification on AI failure, so users still get alerted.
- **Duplicate notifications**: The function checks `notification_log` for `recipe_suggestion` entries sent today. Safe to invoke multiple times.
