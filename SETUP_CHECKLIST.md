# SerendipEatery — Setup Checklist

Do these in order. Each step tells you exactly what to do and which env vars to fill in.

---

## 1. Supabase (Database)

1. Go to [supabase.com](https://supabase.com) and create a free account
2. Click **New Project**, name it `serendipeatery`, pick a region close to your users
3. Wait for the project to provision (~2 minutes)
4. Go to **Settings → API** and copy these three values:
   - `Project URL` → **SUPABASE_URL**
   - `anon public` key → **SUPABASE_ANON_KEY**
   - `service_role` key → **SUPABASE_SERVICE_ROLE_KEY**
5. Go to **Database → Extensions**, enable **PostGIS** (search for it and toggle on)
6. Go to **SQL Editor** and run each migration file in order:
   - `supabase/migrations/20240101000000_initial_schema.sql`
   - `supabase/migrations/20240103000000_loyalty_functions.sql`
   - `supabase/migrations/20240104000000_referral_functions.sql`
   - `supabase/migrations/20240105000000_evidence_functions.sql`
   - `supabase/migrations/20240110000000_final_schema_updates.sql`
   - `supabase/migrations/20240111000000_security.sql`
7. Go to **Storage** and create a bucket called `share-cards` (set to public)

**Env vars to fill in now:**
```
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

---

## 2. Clerk (Auth)

1. Go to [clerk.com](https://clerk.com) and create a free account
2. Create an application called `SerendipEatery`
3. In the setup wizard, enable **Email** and **Google** sign-in methods
4. Go to **API Keys** and copy:
   - `Publishable key` → **NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY** and **EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY** (same key for both)
   - `Secret key` → **CLERK_SECRET_KEY**
5. Go to **Users**, sign up as yourself, then copy your **User ID** (starts with `user_`)
   - This goes in **ADMIN_USER_IDS**
6. Go to **JWT Templates** → Create template → Supabase:
   - This lets Clerk tokens work with Supabase RLS (optional for now, needed later)

**Env vars to fill in now:**
```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...  (same as NEXT_PUBLIC)
ADMIN_USER_IDS=user_xxxxxxxxxxxx
```

---

## 3. Stripe (Payments — web only)

1. Go to [stripe.com](https://stripe.com) and create an account
2. Stay in **Test mode** (toggle in top-right)
3. Go to **Developers → API Keys** and copy:
   - `Publishable key` → **NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY**
   - `Secret key` → **STRIPE_SECRET_KEY**
4. Create three products in **Products → Add Product**:
   - **Starter**: $29/month recurring → copy the Price ID → **STRIPE_PRICE_STARTER**
   - **Growth**: $79/month recurring → copy the Price ID → **STRIPE_PRICE_GROWTH**
   - **Pro**: $5,940 one-time payment → copy the Price ID → **STRIPE_PRICE_PRO**
5. Go to **Developers → Webhooks → Add endpoint**:
   - URL: `https://your-web-domain.com/api/stripe/webhook`
   - Events to listen for: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`
   - Copy the **Signing secret** → **STRIPE_WEBHOOK_SECRET**
6. For local testing, install the Stripe CLI and run:
   ```bash
   stripe listen --forward-to localhost:3000/api/stripe/webhook
   ```
   It will print a webhook secret for local use.

**Env vars to fill in now:**
```
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_STARTER=price_...
STRIPE_PRICE_GROWTH=price_...
STRIPE_PRICE_PRO=price_...
```

---

## 4. Expo (Mobile Push Notifications)

1. Go to [expo.dev](https://expo.dev) and create a free account
2. Install Expo CLI: `npm install -g expo-cli eas-cli`
3. Log in: `eas login`
4. Push notifications work automatically in Expo Go for development
5. For production builds, you'll need:
   - **Android**: Upload your Firebase `google-services.json` to Expo (EAS Build handles FCM)
   - **iOS**: Expo handles APNs certificates automatically via EAS Build
6. No env vars needed for push — Expo Push API uses the project ID from `app.json`

**No env vars needed for this step.**

---

## 5. Railway (API + Worker Deployment)

1. Go to [railway.app](https://railway.app) and create an account (connect GitHub)
2. **API service**:
   - New Project → Deploy from GitHub → select `serendipeatery`
   - Set root directory to `apps/api`
   - Add all env vars from steps 1-2 above (Supabase + Clerk)
   - Also set: `PORT=4000`, `HOST=0.0.0.0`, `ADMIN_USER_IDS=user_xxx`
   - After deploy, copy the public URL → this is your **API URL**
3. **Worker service** (same project, new service):
   - New Service → Deploy from GitHub → set root directory to `apps/worker`
   - Add a **Redis** plugin (click Add → Database → Redis)
   - Railway auto-sets `REDIS_URL`
   - Add: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
4. **Update CORS origins** in the API service env vars:
   - `CLERK_WEB_URL=https://your-netlify-domain.netlify.app`

**Env vars to fill in now (on Railway):**
```
# API service
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
CLERK_SECRET_KEY=...
ADMIN_USER_IDS=...
PORT=4000
HOST=0.0.0.0
CLERK_WEB_URL=https://your-web-domain.com

# Worker service
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
REDIS_URL=(auto-set by Railway Redis plugin)
```

---

## 6. Netlify (Web Deployment)

1. Go to [netlify.com](https://netlify.com) and connect your GitHub
2. Import the `serendipeatery` repo
3. Build settings:
   - Base directory: `apps/web`
   - Build command: `npm run build`
   - Publish directory: `apps/web/.next`
4. Add env vars from steps 1-3 (Supabase, Clerk, Stripe)
5. Also add:
   - `NEXT_PUBLIC_API_URL=https://your-railway-api-url.up.railway.app`
   - `ADMIN_USER_IDS=user_xxx`
6. Deploy, then update the Stripe webhook URL with your Netlify domain

**Env vars to fill in now (on Netlify):**
```
SUPABASE_URL=...
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=...
CLERK_SECRET_KEY=...
STRIPE_SECRET_KEY=...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=...
STRIPE_WEBHOOK_SECRET=...
STRIPE_PRICE_STARTER=...
STRIPE_PRICE_GROWTH=...
STRIPE_PRICE_PRO=...
NEXT_PUBLIC_API_URL=https://your-api.up.railway.app
ADMIN_USER_IDS=user_xxx
```

---

## 7. Local Development (.env files)

Copy the values you collected above into each app's env file:

```bash
# API
apps/api/.env
→ SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, CLERK_SECRET_KEY, ADMIN_USER_IDS

# Web
apps/web/.env.local
→ All Supabase + Clerk + Stripe vars, ADMIN_USER_IDS, NEXT_PUBLIC_API_URL=http://localhost:4000

# Consumer mobile
apps/consumer/.env
→ EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY, EXPO_PUBLIC_API_URL=http://localhost:4000

# Business mobile
apps/business/.env
→ EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY, EXPO_PUBLIC_API_URL=http://localhost:4000

# Worker
apps/worker/.env
→ SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, REDIS_URL=redis://localhost:6379
```

---

## 8. Verify Everything Works

1. Start the API: `cd apps/api && npm run dev` → should see "API listening on 0.0.0.0:4000"
2. Hit health check: `curl http://localhost:4000/health` → should return `{"ok":true,"ts":...}`
3. Start the web app: `cd apps/web && npm run dev` → open http://localhost:3000
4. Sign up via Clerk → should redirect to /dashboard
5. Start consumer app: `cd apps/consumer && npx expo start` → scan QR with Expo Go
6. Start business app: `cd apps/business && npx expo start` → scan QR with Expo Go

---

## Optional: Branch.io (Deep Links)

Only needed if you want referral deep links to work:

1. Go to [branch.io](https://branch.io) and create a free account
2. Create an app, get your **Branch Key**
3. Set `EXPO_PUBLIC_BRANCH_KEY=key_live_...` in consumer app env

---

## Quick Reference: All Env Vars

| Variable | Where to get it | Used by |
|----------|----------------|---------|
| SUPABASE_URL | Supabase → Settings → API | api, web, worker |
| SUPABASE_ANON_KEY | Supabase → Settings → API | web |
| SUPABASE_SERVICE_ROLE_KEY | Supabase → Settings → API | api, web, worker |
| NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY | Clerk → API Keys | web |
| CLERK_SECRET_KEY | Clerk → API Keys | api, web |
| EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY | Clerk → API Keys (same as NEXT_PUBLIC) | consumer, business |
| STRIPE_SECRET_KEY | Stripe → API Keys | web |
| NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY | Stripe → API Keys | web |
| STRIPE_WEBHOOK_SECRET | Stripe → Webhooks | web |
| STRIPE_PRICE_STARTER | Stripe → Products | web |
| STRIPE_PRICE_GROWTH | Stripe → Products | web |
| STRIPE_PRICE_PRO | Stripe → Products | web |
| REDIS_URL | Railway Redis plugin or local | worker |
| ADMIN_USER_IDS | Clerk → Users → your user ID | api, web |
| EXPO_PUBLIC_API_URL | Your Railway API URL or localhost:4000 | consumer, business |
| NEXT_PUBLIC_API_URL | Your Railway API URL or localhost:4000 | web |
