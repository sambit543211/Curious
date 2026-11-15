# Morning Edition

A phone-first personal briefing. India, World, Indian Markets, AI & Tech, Mind & Evolution, and Marketing World each contain five illustrated stories. Marketing World covers three India campaigns and two campaigns from elsewhere. The reader shows a headline, a short explanation, context and the source. The archive keeps each published issue by date. Use Older, Newer or the date picker to browse it. Reading progress is stored per edition and device.

## Preview on your computer

Run `npm run dev` and open http://localhost:4173. The 14 and 15 November 2026 editions are included. Run `npm install` and `npm run check` to verify the source bundle. The static server only serves the reader and those two editions.

## Deploy

1. Push this directory to a new private GitHub repository, keeping `.github/workflows/briefing.yml` on the default branch.
2. Import that repository into Vercel. Use the Other framework preset and the repository root. `vercel.json` sets `public` as the static output directory and keeps the Node functions under `/api`.
3. Create an Upstash Redis database. Add its `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` to Vercel Production along with `OPENAI_API_KEY` and a random `CRON_SECRET` (for example, use `openssl rand -hex 32` locally). See `.env.example` for all variable names. The OpenAI project requires API billing and access to web search. The default model is `gpt-5-mini`.
4. For a 10:05 a.m. IST GitHub Actions trigger with a 10:20 a.m. retry, set the repository variable `BRIEFING_URL` to the Vercel production origin and the repository secret `CRON_SECRET` to the same value used on Vercel. Use the origin that GitHub Actions can reach. If the project has deployment protection, use Vercel's automation bypass with a protected GitHub secret and pass the documented header in the workflow.
5. Redeploy after adding Vercel variables. Trigger **Publish Morning Edition** manually in GitHub Actions. The refresh should return the IST edition date and delivery counts. Confirm that `/api/edition` returns that date with all six sections and that the reader shows the edition. The two included editions are always readable. After a second publication, confirm the previous date is still listed at `/api/editions` and loads at `/api/edition?date=YYYY-MM-DD`.
6. Both the Vercel Cron Job and GitHub Actions target **10:05 a.m. IST**. Vercel Hobby cron may invoke the job later within the scheduled UTC hour. GitHub Actions can delay scheduled runs. The edition appears after research and validation finish. Failed validation leaves the archive intact. A date-specific lock prevents simultaneous jobs from publishing twice, and a same-day retry can finish pending notifications.

## iPhone notifications

Run `npx web-push generate-vapid-keys` and add the resulting `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` to Vercel Production. Set `VAPID_SUBJECT` to a contact address with the `mailto:` prefix. Keep the same VAPID keys across releases and keep the private key out of Git. Redeploy.

On iOS 16.4 or later, open production in Safari, select **Share → Add to Home Screen**, launch the Home Screen icon, then select **Install & alerts → Enable notifications**. Trigger the regular workflow and check on the device after a new edition is published. Reading progress lives on each device.

The reader includes a service worker that caches bundled assets and editions previously opened while online for offline reading. Stock photographs are illustrative and sourced from [Unsplash](https://unsplash.com/license). News and research sources are linked on each card.
