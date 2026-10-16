# ECOWATCH---OneEarth-NextGen-Innovators-2026-Project
## City heat & satellite (Heat map tab)

Select a country and city to see modelled weather, Copernicus Sentinel-3 land-surface temperature as a heat map, and deterministic heat advisories. This needs the backend in [`backend/`](backend/README.md) (Node API + Python geospatial worker). Setup, CDSE credentials, tests and licensing notes are in that README.

## Accounts and AI assistant setup

1. Copy `.env.example` to `.env` and fill in `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` and `EXPO_PUBLIC_ECOWATCH_API_URL`. Restart Expo after changing `.env`.
2. The AI assistant talks to the EcoWatch backend, which holds the OpenRouter key. Put `OPENROUTER_API_KEY` in `backend/api/.env` and start the API (`cd backend/api && npm install && npm run dev`). The key is never bundled into the app. See [`backend/README.md`](backend/README.md).
3. In the Supabase dashboard, open **SQL Editor**, paste [`supabase/schema.sql`](supabase/schema.sql) and run it. This creates the `profiles` table (filled automatically on sign-up) and the `ai_messages` table that stores each signed-in user's AI chat history. Row-level security limits every row to its owner.
4. Optional, for instant registration: **Authentication > Sign In / Providers > Email**, turn off **Confirm email**. When it stays on, new users must click the emailed link before they can sign in, and Supabase's built-in mailer only sends a few emails per hour.

The Profile tab shows a live diagnostic for both services. Guests can use every feature; their AI chats are simply not saved.
