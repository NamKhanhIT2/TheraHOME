# TheraHOME

Companion software for TheraHOME's physical rehab devices (neck/back
support). Two apps sharing one Supabase backend:

- **`TheraHOME APP/`** — the patient-facing mobile app (Expo / React
  Native). Onboarding, device activation, a guided daily program, Store,
  Community, chat, notifications.
- **`TheraHOME-WEB/`** — the Admin/CSKH dashboard (Next.js). Manages the
  program roadmap, store catalog, community moderation, notifications, and
  TheraHOME-issued accounts.

Each app has its own `README`-equivalent context in its `CLAUDE.md` file,
including setup steps, architecture notes, and manual configuration still
required (Google/Apple sign-in, push notification credentials, Shopify
webhook secret).

## Getting started

```bash
cd "TheraHOME APP" && npm install && npx expo start
cd TheraHOME-WEB && npm install && npm run dev
```

`TheraHOME-WEB/` has no space in its name on purpose — Vercel derives
serverless function names from the deployment path, and a space there
breaks the build ("Serverless Function has an invalid name"). When
importing on Vercel, set **Root Directory** to `TheraHOME-WEB`.

Both need their own `.env`/`.env.local` with the Supabase project URL and
publishable key — copy `.env.example`/`.env.local.example` and fill in the
real values from the Supabase project dashboard (Settings → API). Neither
file is committed.
