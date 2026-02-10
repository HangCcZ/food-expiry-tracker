# 🍎 Food Expiry Tracker

A Progressive Web App (PWA) that helps you track food expiry dates and reduce waste with timely reminders.

## Features

- ✅ Track food items with expiry dates, quantities, and categories
- 📅 Visual categorization: Urgent (0-2 days), Soon (3-5 days), Safe (>5 days)
- 🔔 Push notifications for expiring items
- 🔐 Passwordless authentication via magic link
- 📱 Progressive Web App - installable on mobile and desktop
- ⚡ Real-time updates across devices
- 🎨 Clean, responsive UI with Tailwind CSS

## Tech Stack

- **Frontend:** Next.js 14 (App Router), React, TypeScript, Tailwind CSS
- **Backend:** Supabase (PostgreSQL, Auth, Edge Functions, Cron)
- **PWA:** Service Worker, Web Push API
- **Deployment:** Vercel (Frontend), Supabase (Backend)

## Project Structure

```
food-expiry-tracker/
├── app/                        # Next.js App Router pages
│   ├── auth/                   # Authentication pages
│   │   ├── login/              # Magic link login
│   │   └── callback/           # Auth callback handler
│   ├── layout.tsx              # Root layout
│   └── page.tsx                # Main dashboard
├── components/                 # React components
│   ├── AuthGuard.tsx           # Protected route wrapper
│   ├── Dashboard.tsx           # Main dashboard
│   ├── FoodItemCard.tsx        # Individual item display
│   ├── FoodItemForm.tsx        # Add/edit form
│   └── PushNotificationSetup.tsx # Notification setup
├── lib/                        # Utilities and hooks
│   ├── hooks/                  # Custom React hooks
│   ├── supabase/               # Supabase clients
│   └── utils/                  # Helper functions
├── public/                     # Static assets
│   ├── icons/                  # PWA icons
│   ├── manifest.json           # PWA manifest
│   └── sw.js                   # Service worker
├── supabase/                   # Supabase configuration
│   ├── functions/              # Edge Functions
│   │   └── send-expiry-reminders/  # Daily cron job
│   └── migrations/             # Database schema
└── types/                      # TypeScript types
```

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- A Supabase account (free tier works!)
- Basic understanding of Next.js and React

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Supabase

#### Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Wait for the project to be provisioned (~2 minutes)

#### Run Database Migration

1. In your Supabase project dashboard, go to **SQL Editor**
2. Click **New Query**
3. Copy the contents of `supabase/migrations/20240101000000_initial_schema.sql`
4. Paste and click **Run**

This creates:
- `profiles` table for user data
- `food_items` table for tracking food
- `push_subscriptions` table for notifications
- `notification_log` table for tracking sent notifications
- Row Level Security (RLS) policies

#### Configure Authentication

1. Go to **Authentication** → **Providers**
2. Enable **Email** provider
3. Disable **Confirm email** (for easier testing, enable in production)
4. Go to **Authentication** → **URL Configuration**
5. Add redirect URL: `http://localhost:3000/auth/callback`

### 3. Generate VAPID Keys

For push notifications, you need VAPID keys:

```bash
npx web-push generate-vapid-keys
```

This will output:
```
Public Key: BN...
Private Key: AA...
```

Save these for the next step.

### 4. Configure Environment Variables

Edit `.env.local` with your values:

```env
# From Supabase Dashboard → Settings → API
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-publishable-key  # Look for "Publishable Key"

# From Supabase Dashboard → Settings → API (keep secret!)
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key  # Look for "Service Role Key"

# From npx web-push generate-vapid-keys
NEXT_PUBLIC_VAPID_PUBLIC_KEY=BN...
VAPID_PRIVATE_KEY=AA...
VAPID_EMAIL=your-email@example.com
```

### 5. Generate PWA Icons

You need to create app icons. Use one of these methods:

**Option 1: Online Tool (Recommended)**
1. Visit [realfavicongenerator.net](https://realfavicongenerator.net/)
2. Upload a 512x512 image (food-related icon)
3. Download and extract to `public/icons/`

**Option 2: Use Emoji**
1. Create a simple PNG with the 🍎 emoji on a green background
2. Resize to all required sizes (see `public/icons/README.md`)

### 6. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 7. Test the App

1. Go to `http://localhost:3000`
2. You'll be redirected to the login page
3. Enter your email and click "Send Magic Link"
4. Check your email and click the link
5. You'll be redirected to the dashboard
6. Add a food item and test the functionality

## Deploying to Production

### Deploy Frontend to Vercel

1. Push your code to GitHub
2. Go to [vercel.com](https://vercel.com) and import your repository
3. Add environment variables (from Supabase Dashboard → Settings → API):
   - `NEXT_PUBLIC_SUPABASE_URL` - Project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Publishable Key
   - `NEXT_PUBLIC_VAPID_PUBLIC_KEY` - Your VAPID public key
4. Deploy!

### Configure Supabase for Production

#### Update Auth URLs

In Supabase Dashboard → Authentication → URL Configuration:
- Add your Vercel URL: `https://your-app.vercel.app/auth/callback`

#### Deploy Edge Function

Install Supabase CLI:

```bash
npm install -g supabase
```

Login and link your project:

```bash
supabase login
supabase link --project-ref your-project-ref
```

Deploy the Edge Function:

```bash
supabase functions deploy send-expiry-reminders
```

Set environment variables for the function:

```bash
supabase secrets set VAPID_PUBLIC_KEY=your-public-key
supabase secrets set VAPID_PRIVATE_KEY=your-private-key
supabase secrets set VAPID_EMAIL=your-email@example.com
```

#### Set Up Cron Job

1. In Supabase Dashboard → Database → Extensions
2. Enable `pg_cron` extension
3. Go to **SQL Editor** and run:

```sql
-- Schedule daily at 9 AM UTC
SELECT cron.schedule(
  'send-daily-expiry-reminders',
  '0 9 * * *',
  $$
  SELECT
    net.http_post(
      url:='https://your-project-ref.supabase.co/functions/v1/send-expiry-reminders',
      headers:=jsonb_build_object(
        'Content-Type','application/json',
        'Authorization', 'Bearer YOUR_SUPABASE_SERVICE_ROLE_KEY'
      )
    ) as request_id;
  $$
);
```

Replace `your-project-ref` and `YOUR_SUPABASE_SERVICE_ROLE_KEY`.

## PWA Installation

### Desktop (Chrome/Edge)

1. Visit your deployed app
2. Look for the install icon in the address bar
3. Click "Install"

### Mobile (iOS)

1. Open in Safari
2. Tap the Share button
3. Scroll down and tap "Add to Home Screen"

### Mobile (Android)

1. Open in Chrome
2. Tap the three dots menu
3. Tap "Add to Home screen"

## Development Workflow

### Incremental Sessions

The app was designed to be built in small, 1-2 hour sessions:

- **Session 1-2:** Project setup, dependencies, Supabase
- **Session 3:** Basic authentication flow
- **Session 4-5:** Food items CRUD
- **Session 6:** Dashboard with categorization
- **Session 7:** PWA setup
- **Session 8-9:** Push notifications
- **Session 10:** Cron job and reminders
- **Session 11:** Polish and refinements
- **Session 12:** Deploy to production

### Adding New Features

Some ideas for enhancement:
- **Statistics:** Track food waste over time
- **Recipes:** Suggest recipes based on expiring items
- **Barcode Scanning:** Auto-fill item details
- **Sharing:** Share food items with family/roommates
- **Categories:** Custom categories and icons
- **Reminders:** Custom reminder schedules

## Architecture Decisions

### Why Supabase?
- All-in-one: Auth, Database, Functions, Cron
- PostgreSQL with RLS for security
- Real-time subscriptions built-in
- Free tier is generous

### Why Next.js App Router?
- Server components for better performance
- File-based routing
- Great TypeScript support
- Easy Vercel deployment

### Why Web Push API?
- Native browser support
- No third-party dependencies
- Free (no cost per notification)
- Works offline

### Why Row Level Security (RLS)?
- Database-level security
- Can't be bypassed from client
- Automatic multi-tenancy

## Troubleshooting

### Push Notifications Not Working

1. Ensure you're using HTTPS (required for push notifications)
2. Check browser console for errors
3. Verify VAPID keys are correct
4. Test with the "Test" button in the notification banner

### Magic Link Not Received

1. Check spam folder
2. Verify email provider in Supabase settings
3. Check Supabase logs for email delivery errors

### Items Not Showing

1. Check browser console for errors
2. Verify RLS policies are applied
3. Check user is authenticated (useAuth hook)

### Service Worker Not Registering

1. Ensure you're on HTTPS or localhost
2. Clear browser cache and try again
3. Check `sw.js` is accessible at `/sw.js`

## License

MIT License - feel free to use this project for learning or production!

## Contributing

Contributions are welcome! Feel free to:
- Report bugs
- Suggest features
- Submit pull requests

---

Built with ❤️ using Next.js and Supabase
