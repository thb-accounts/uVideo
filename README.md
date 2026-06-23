# SimpliChill

SimpliChill is a lightweight video platform for creators, coders, and community makers hosted at **https://simplichill.unrealcake8.site**.

> **Archive note:** SimpliChill evolved from the original HoloStem prototype.

## What SimpliChill includes

- A responsive, dark video homepage with category filters and search.
- A separate vertical Shorts feed at `/shorts`.
- Individual video pages with likes, comments, sharing, creator channels, subscriptions, and recommendations.
- Authenticated creator profiles, settings, moderation tools, and uploads.
- Cloudinary file uploads with direct MP4 fallback.
- Supabase-backed videos, profiles, social data, and moderation.

SimpliChill should remain deployed on its own domain.

## Routes

| Route | Purpose |
| --- | --- |
| `/` | SimpliChill homepage and search results |
| `/shorts` | Optional vertical Shorts feed |
| `/video/:id` | Video watch page |
| `/upload` | Authenticated creator upload flow |
| `/u/:username` | Public creator channel |
| `/profile` | Authenticated profile management |
| `/settings` | Account and viewing settings |
| `/auth` | Sign in and registration |

The legacy `/dashboard` URL redirects to the new homepage.

## Local development

1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy `.env.example` to `.env` and add the desired Supabase/Cloudinary configuration.
3. Start the Vite app:
   ```bash
   npm run dev
   ```
4. To run the optional Express API alongside Vite:
   ```bash
   npm run dev:full
   ```

Without Supabase environment variables, the frontend uses a small SimpliChill demo catalog so the interface can still be previewed.

## Data and uploads

The existing Supabase migration filenames are intentionally retained for compatibility. Run `supabase/001_holostem_schema.sql` in Supabase, then optionally run `supabase/002_storage_policies.sql` for the public `videos` bucket. Existing `user_follows` database naming is also retained internally, while the UI presents the feature as **Subscriptions**.

For uploads, configure Bunny Stream as the primary provider and Cloudinary as the direct-browser fallback using the variables documented in `.env.example`. Authenticated creators upload local video bytes directly to Bunny Stream via TUS; if Bunny fails before accepting the upload, the browser falls back to a signed direct Cloudinary upload. Raw video bytes must not pass through Express or serverless routes.

## Production deployment

The repository includes `vercel.json` and can be deployed directly to Vercel:

1. Import the GitHub repository into Vercel.
2. Configure the Supabase, auth redirect, and Cloudinary environment variables from `.env.example`.
3. Build with `npm run build` and use Vite's default `dist` output.
4. Add **simplichill.unrealcake8.site** as the production custom domain.
5. Point the domain's DNS record to Vercel and redeploy after environment variables are saved.
6. Set the production auth redirect URL to `https://simplichill.unrealcake8.site` in Supabase.

Deploy this project only on its configured SimpliChill host.
