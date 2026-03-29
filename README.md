# SerendipEatery

> Spin your next meal. Win a deal. Walk in.

Flash sales at food trucks and restaurants. Users spin a roulette wheel, win prizes, and auto-check-in via geofence when they arrive. Businesses pay per verified visit.

---

## Repo structure

```
serendipeatery/
├── apps/
│   ├── web/          → Next.js — marketing site, referral links, admin portal (Netlify)
│   ├── api/          → Fastify backend — spin engine, geofence, billing (Railway)
│   ├── consumer/     → React Native — user app (Expo)
│   └── business/     → React Native — business owner app (Expo)
├── packages/
│   ├── shared/       → TypeScript types shared across all apps
│   ├── ui/           → Shared UI components (future)
│   └── config/       → Shared ESLint/TS configs (future)
├── turbo.json
├── netlify.toml
└── package.json
```

---

## Quick start

### 1. Clone the repo

```bash
git clone https://github.com/YOUR_USERNAME/serendipeatery.git
cd serendipeatery
npm install
```

### 2. Set up environment variables

```bash
# Web app
cp apps/web/.env.example apps/web/.env.local

# API
cp apps/api/.env.example apps/api/.env
```

Fill in the values — see Environment Variables section below.

### 3. Run everything locally

```bash
# All apps simultaneously
npm run dev

# Just the web app (Netlify preview)
npm run web

# Just the API
npm run api

# Just the consumer app
npm run consumer
```

---

## Deploy to GitHub + Netlify

### Step 1 — Push to GitHub

```bash
# Create a new repo on GitHub first, then:
git init
git add .
git commit -m "feat: initial monorepo setup"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/serendipeatery.git
git push -u origin main
```

### Step 2 — Connect to Netlify

1. Go to [app.netlify.com](https://app.netlify.com)
2. Click **Add new site → Import an existing project**
3. Connect GitHub and select the `serendipeatery` repo
4. Netlify will auto-detect the `netlify.toml` settings:
   - **Base directory:** `apps/web`
   - **Build command:** `npm run build`
   - **Publish directory:** `.next`
5. Click **Deploy site**

### Step 3 — Set environment variables in Netlify

Go to **Site settings → Environment variables** and add:

```
NEXT_PUBLIC_API_URL=https://api.serendipeatery.railway.app
NEXT_PUBLIC_APP_SCHEME=serendipeatery
NEXT_PUBLIC_BRANCH_KEY=your_branch_io_key
```

### Step 4 — Custom domain (optional)

In Netlify: **Domain settings → Add custom domain → serendip.app**
Then update your DNS records to point to Netlify.

---

## Deploy API to Railway

1. Go to [railway.app](https://railway.app)
2. Click **New Project → Deploy from GitHub repo**
3. Select `serendipeatery` repo, set **Root directory** to `apps/api`
4. Add a **PostgreSQL** plugin (automatically adds `DATABASE_URL`)
5. Add a **Redis** plugin (automatically adds `REDIS_URL`)
6. Set environment variables (see below)
7. Railway auto-deploys on every push to `main`

---

## Mobile apps (Expo Go)

```bash
# Install Expo CLI
npm install -g expo-cli eas-cli

# Run consumer app
cd apps/consumer
npx expo start

# Run business app
cd apps/business
npx expo start
```

Scan the QR code with the **Expo Go** app on your phone. No App Store submission needed during development.

---

## Environment variables

### apps/web/.env.local

```env
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_APP_SCHEME=serendipeatery
NEXT_PUBLIC_BRANCH_KEY=your_branch_io_key
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
```

### apps/api/.env

```env
DATABASE_URL=postgresql://user:pass@localhost:5432/serendipeatery
REDIS_URL=redis://localhost:6379
CLERK_SECRET_KEY=sk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
GOOGLE_VISION_API_KEY=...
OPENAI_API_KEY=sk-...
FCM_SERVER_KEY=...
APNS_KEY_ID=...
APNS_TEAM_ID=...
APNS_KEY_PATH=./apns.p8
PORT=4000
NODE_ENV=development
```

### apps/consumer/.env + apps/business/.env

```env
EXPO_PUBLIC_API_URL=http://localhost:4000
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
EXPO_PUBLIC_BRANCH_KEY=...
```

---

## Tech stack

| Layer | Technology |
|-------|-----------|
| Web frontend | Next.js 14 (App Router) + Tailwind |
| Mobile | React Native + Expo SDK 51 |
| Animation | Reanimated 3 (roulette wheel physics) |
| API server | Node.js + Fastify + TypeScript |
| Database | PostgreSQL 16 + PostGIS |
| Cache / Queue | Redis + BullMQ |
| Auth | Clerk (11 social providers) |
| Payments | Stripe (subscriptions + usage billing) |
| Push notifications | Expo Notifications → FCM + APNs |
| Deep links | Branch.io (deferred referral attribution) |
| OCR | Google Vision API |
| AI suggestions | OpenAI GPT-4o |
| Hosting (web) | Netlify |
| Hosting (API) | Railway |
| Mobile testing | Expo Go |

---

## Build order

We build and troubleshoot section by section:

- [x] **Section 1** — Monorepo + Netlify config ← YOU ARE HERE
- [ ] **Section 2** — Database schema + Supabase
- [ ] **Section 3** — Auth (Clerk + 11 social logins)
- [ ] **Section 4** — API server (Fastify + Railway)
- [ ] **Section 5** — Spin wheel engine
- [ ] **Section 6** — Geofencing + visit state machine
- [ ] **Section 7** — Consumer app (onboarding + browse)
- [ ] **Section 8** — Business app (onboarding + dashboard)
- [ ] **Section 9** — Notification worker system
- [ ] **Section 10** — Loyalty + tier system
- [ ] **Section 11** — Referral system + Branch.io
- [ ] **Section 12** — Social sharing + share cards
- [ ] **Section 13** — Billing (Stripe)
- [ ] **Section 14** — Evidence paywall
- [ ] **Section 15** — Analytics + one-tap fixes
- [ ] **Section 16** — Admin portal
- [ ] **Section 17** — QA + troubleshoot each section

---

## Contributing

This is a private project. All code lives in this monorepo.

---

## License

Private — all rights reserved.
