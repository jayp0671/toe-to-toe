# Staging setup (P0.7)

Staging is the Supabase project `t2t-staging` plus the Cloudflare Pages preview alias
`https://staging.<pages-project>.pages.dev` (docs/PLAN.md Appendix A12). Every push to `main` runs
`.github/workflows/deploy.yml`. That workflow applies migrations, deploys the Edge Functions, then
builds and uploads the web app.

Until every value below exists, the workflow skips the deploy and leaves a notice that lists what's
missing. It doesn't fail. Everything here is free tier. Never paste a secret into a file in this repo.

## 1. Supabase: create `t2t-staging`

1. In https://supabase.com/dashboard, click **New project**. Name it `t2t-staging`, pick the Free plan
   and a US East region. Generate a strong **database password** and save it in your password
   manager, because you'll need it in step 4.
2. Copy the **project ref** from **Project Settings → General → Project ID**. It's the part before
   `.supabase.co`.
3. Copy the **anon (public) key** from **Project Settings → API Keys**. This key is public by design
   (A9). If the dashboard only shows the new key format, use the **publishable** key.
4. **Authentication → Sign In / Providers → Email**: keep Email enabled, turn **Confirm email** off
   and set **Email OTP length** to 6. Under **Email OTP Expiration**, 3600 seconds matches local.
5. **Authentication → Emails → Templates**: the debug page signs in with a 6-digit code, not a
   link. Edit **both** of these templates so the email shows the code:
   - **Magic Link** (sent to existing users), body for example
     `<p>Your Toe to Toe code is <strong>{{ .Token }}</strong></p>`
   - **Confirm signup** (sent the first time an email signs in), with the same body.

   Remove `{{ .ConfirmationURL }}` from both.
6. **Authentication → URL Configuration**: set **Site URL** to
   `https://staging.<pages-project>.pages.dev` (from step 2.1).
7. Your account's **access token**: open https://supabase.com/dashboard/account/tokens, click
   **Generate new token** and name it `github-deploy`. Copy it.

The built-in email sender is rate-limited to a few emails per hour per project. That covers four
testers signing in once, but repeated code requests can hit the limit. Wait and try again.

## 2. Cloudflare Pages: create the project

1. In https://dash.cloudflare.com, open **Workers & Pages → Create → Pages → Upload assets** (Direct
   Upload, not Git). Name the project `toe-to-toe`, or any name you like, as long as it matches
   `CLOUDFLARE_PAGES_PROJECT` below. When it asks for files, upload any placeholder folder. The
   first real deploy replaces it.
2. Keep the production branch as `main`. Staging uploads use branch `staging`, so they get the preview
   alias `staging.<project>.pages.dev`. Production (tags, P1.7) uses `main`.
3. Copy your **Account ID** from the right sidebar of **Workers & Pages**.
4. **My Profile → API Tokens → Create Token → Custom token**: name it `github-pages-deploy` and give
   it the permission **Account → Cloudflare Pages → Edit** for your account only. Copy the token.

## 3. GitHub: the `staging` environment

In https://github.com/jayp0671/toe-to-toe, open **Settings → Environments → New environment** and
name it `staging`. Optionally, set **Deployment branches and tags** to **Selected branches** →
`main`. Then add:

**Environment secrets** (Settings → Environments → staging → Add environment secret)

| Name                    | Value                                        |
| ----------------------- | -------------------------------------------- |
| `SUPABASE_ACCESS_TOKEN` | the Supabase access token (1.7)              |
| `SUPABASE_DB_PASSWORD`  | the `t2t-staging` database password (1.1)    |
| `CLOUDFLARE_API_TOKEN`  | the Cloudflare Pages token (2.4)             |

**Environment variables** (same page → Add environment variable). These are public values.

| Name                       | Value                                            |
| -------------------------- | ------------------------------------------------ |
| `SUPABASE_PROJECT_REF`     | the `t2t-staging` project ref (1.2)              |
| `SUPABASE_ANON_KEY`        | the anon / publishable key (1.3)                 |
| `CLOUDFLARE_ACCOUNT_ID`    | the Cloudflare account ID (2.3)                  |
| `CLOUDFLARE_PAGES_PROJECT` | the Pages project name (2.1), e.g. `toe-to-toe`  |

The web build gets `VITE_SUPABASE_URL = https://<SUPABASE_PROJECT_REF>.supabase.co` and
`VITE_SUPABASE_ANON_KEY`. Edge Functions get `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` from
Supabase itself, so the service role key isn't needed for P0.7. It becomes a GitHub secret with the
smoke tests and backups (P1.7, A9), along with `SMOKE_SYNC_KEY`.

## 4. Optional: the Shortcut update link

To give outdated Shortcuts the update link in the 426 response (shortcut/BUILD.md), set the function
secret once:

```sh
pnpm exec supabase secrets set SHORTCUT_URL=<iCloud link> --remote=<t2t-staging ref>
```

## 5. Deploy

Push to `main`, or run **Actions → deploy → Run workflow**. The `deploy-staging` job's summary links
to `https://staging.<project>.pages.dev`.

## 6. Add each tester's profile (Phase 0 only)

Phase 0 has no sign-up flow yet. Crews and invites come in Phase 1. A tester signs in once on
`/debug`, sees "No player profile for this email yet", and then you run this in the staging
**SQL Editor**:

```sql
-- One line per tester. dev_note marks Watch wearers vs phone-only for the P0.8 sync report.
insert into public.users (id, email, display_name, username, default_tz, dev_note)
select id, email, v.display_name, v.username, v.tz, v.note
from auth.users
join (values
  ('tester@example.com', 'Jay', 'jay', 'America/New_York', 'Watch wearer')
) as v (email, display_name, username, tz, note) using (email);
```

After that the tester taps **Refresh**, then **Generate sync key**, pastes the key into the Shortcut
and syncs. Their counted steps and last sync time appear on the page. Each morning they type
yesterday's Health number into **Health says \_\_\_ steps**.

## Local equivalent

```sh
pnpm exec supabase start -x studio,imgproxy,vector,logflare
pnpm exec supabase status   # API URL and anon/publishable key
```

Put `VITE_SUPABASE_URL=http://127.0.0.1:54321` and `VITE_SUPABASE_ANON_KEY=<key>` in the repo-root
`.env.local`, then run `pnpm --filter @t2t/web dev` and open http://localhost:5173/debug. Sign in as
a seeded player, for example `jay@toe-to-toe.test`. The code arrives in the local mail catcher at
http://127.0.0.1:54324. For **Generate sync key**, also run `pnpm exec supabase functions serve`.
