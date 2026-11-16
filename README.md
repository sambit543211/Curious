# Morning Edition

A phone-first daily briefing across India, World, Indian Markets, AI & Tech, Mind & Evolution, and Marketing World. Each edition has five illustrated cards per topic. The archive retains each issue, and reading progress stays on the reader's device.

## Daily publication

The Morning Edition task in ChatGPT starts at **10:05 a.m. IST**. It researches the briefing, saves one dated edition to the `main` branch, and delivers the briefing in ChatGPT. Vercel builds the archive index and deploys `main` to production. Each edition becomes available when that build is ready.

The publication path is `public/editions/YYYY-MM-DD.json`. Set `date` to the edition's IST date and include the six keys from `public/edition-format.js` in `sections`. A card has `label`, `headline`, `summary`, `context`, `source`, `sourceUrl`, and `image`. The image is a bundled path such as `/images/india.jpg`. The 14 November edition shows the format. The archive index is generated at build time. Add a new dated file without editing the index or earlier editions.

The homepage opens the latest edition. Past editions have shareable URLs such as `/?edition=2026-11-14`. `/api/editions` lists available dates and `/api/edition?date=YYYY-MM-DD` returns a specific edition. Opened editions can be read offline.

## Local development

Run `npm install`, `npm run build`, and `npm run check`. Run `npm run dev` and open http://localhost:4173 for a static preview. On Vercel, the Other framework preset runs `npm run build` and serves `public`.

On iPhone, open the production address in Safari, select **Share → Add to Home Screen**, then open the Home Screen icon.

## Optional server-side integration

The app can also read editions from an Upstash archive when `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are configured. This backend is used for direct Web Push subscribers. To turn on app-native notifications through the existing research and notification endpoint, set the Redis values, `OPENAI_API_KEY`, `CRON_SECRET`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` and a `mailto:` `VAPID_SUBJECT` as Vercel production variables. The authorized `/api/refresh` endpoint requires the cron secret as a bearer token. The daily ChatGPT task publishes to GitHub independently of these credentials.

## Photo credits

Stock photos are illustrative. News and research sources are linked on each card.

- Phuket Old Town, cropped and resized. [Lisa van Vliet on Unsplash](https://unsplash.com/photos/colorful-buildings-line-a-busy-street-wsh74QVKijI)
- Car assembly, cropped and resized. [Lenny Kuhne on Unsplash](https://unsplash.com/photos/gray-vehicle-being-fixed-inside-factory-using-robot-machines-jHZ70nRk7Ns)
- Male Trinidadian guppy by Amy E. Deacon, Hideyasu Shimadzu, Maria Dornelas, Indar W. Ramnarine and Anne E. Magurran, converted to JPEG. [Original photo](https://commons.wikimedia.org/wiki/File:Trinidadian_guppy_(Poecilia_reticulata)_male.png) · [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)
