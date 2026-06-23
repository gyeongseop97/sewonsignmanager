# Sewon Sign Manager - Supabase/R2 version

## Required Vercel Environment Variables

- SUPABASE_URL
- SUPABASE_PUBLISHABLE_KEY
- CLOUDFLARE_ACCOUNT_ID
- R2_BUCKET_NAME
- R2_ACCESS_KEY_ID
- R2_SECRET_ACCESS_KEY

## Files

- index.html: UI
- app.js: Supabase REST API based client
- api/config.js: exposes public Supabase config to the browser
- api/upload-signature.js: uploads signature PNG to Cloudflare R2
- api/r2-file.js: private R2 image proxy
- sql/schema.sql: Supabase table schema

## Admin login

- ID: admin
- Password: 1234

Change these constants in app.js before real operation.
