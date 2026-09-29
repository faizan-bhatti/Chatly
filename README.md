# Chatly

Private one-to-one messaging built with React 18, Vite, TypeScript, Tailwind CSS, React Router, Zustand, and Supabase.

## Local setup

1. Install Node.js 20.19+ or 22.12+ and run `npm ci`.
2. Copy `.env.example` to `.env.local` and set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from your Supabase project's API settings. Use only the public anon/publishable key in the browser; never use a service-role key.
3. Initialize and link the Supabase CLI, then apply the migrations:

   ```powershell
   npx supabase init
   npx supabase login
   npx supabase link --project-ref YOUR_PROJECT_REF
   npx supabase db push
   ```

4. In Supabase Auth, enable email/password and phone sign-in. Configure an SMS provider before testing phone OTP. Set the production site's redirect URL under Auth URL configuration.
5. Run `npm run dev` and open the printed local URL.

Email confirmation behavior is controlled by the Supabase Auth email-confirmation setting. The profile row is created by the database trigger after Auth creates the user.

## Checks

```powershell
npm run lint
npm test
npm run build
```

## Vercel

Import this repository as a Vite project. The build command is `npm run build`, the output directory is `dist`, and `vercel.json` provides the React Router fallback. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as Vercel environment variables for Preview and Production, then add each deployment domain to Supabase Auth's allowed redirect URLs. Keep all service-role credentials in server-side secret storage only; this app does not need them.
