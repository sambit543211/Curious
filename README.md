# Morning Edition

A phone-first daily briefing across India, World, Indian Markets, Stock Investing, AI & Tech, Psychology and Marketing (topic names and order live in `public/topics.js`). Current editions have five cards per topic. Earlier issues retain their original topics, and reading progress stays on the reader's device.

## V2 publication

The archive accepts the original editions and v2 separately. V2 requires sourced Top 3 links,
five cards in each active section, a market dashboard and four market cards, and three screened
picks, a watchlist and a metric lesson. Sundays omit Indian Markets. A Saturday or holiday
dashboard needs an exchange calendar source and shows the last session close.

Run the 09:00 research preparation with `MORNING_PREPARE_STAGE=draft npm run prepare-v2 -- YYYY-MM-DD`.
After 09:45 use `MORNING_PREPARE_STAGE=market npm run prepare-v2 -- YYYY-MM-DD` for the dashboard.
The fundamentals source returns `{ date, stocks, facts }`. Every stock supplies a symbol, sector,
kind, closing price and quote date, metric values, data date, sources, and a dated `metricSources`
entry for its price and each value. The market source returns `{ date, timestamp, session, series,
flows, niftyPE, sources, facts }`, with sourced price levels and dated historic closes for each
indicator. Closed non-trading sessions additionally supply `lastSession` and `calendarUrl`. For a delayed or catch-up observation, set `mode: "latest"` and its real same-day `timestamp`; use `session: "after-close"` after 15:30 IST. Never relabel a current quote as 09:45. Nifty and Sensex levels and previous closes remain mandatory. Other indicators and unverified historical comparisons may be absent: use a sourced series with `unavailableReason` and no level, or null flow/valuation fields with an explicit reason. The dashboard displays gaps and mixed quote conventions. Missing secondary fields do not suppress the whole briefing. The source may be a
dated local JSON file or an HTTPS endpoint configured in the task environment. Financial fact records
use `{ value, url, asOf }`.

Use the screened output as the writer's input. `npm run publish-v2 -- draft.json` pulls the data
again, computes the financial fields, validates the editorial and numerical checklist, and writes
a dated edition with its actual publication time. The target remains 09:50–10:00 IST; a later same-day release is explicitly labelled `publicationMode: "late"` rather than blocked or backdated. Optionally pass two positional JSON file
paths after the draft for the fundamentals and market inputs. Commit only the validated dated edition.
If fewer than three eligible stocks can be verified, the fundamentals input must document `unavailableReason`. Fill remaining editorial stock slots with `slot: "unavailable"` and the precise reason, sources and useful non-numerical context; never attach a symbol, price, metrics or verdict to an unavailable slot. If none pass, the metric lesson uses `exampleMetric: null`. All other editorial checks still apply. Keep credentials and raw provider exports outside the repository. The published cards include
their primary links and provenance.

After the session, run `npm run update-closes -- YYYY-MM-DD`. Commit only the new dated file
under `public/market-closes/` if one was written. The build derives the pick ledger from the
published editions and calculates returns from the official NSE closes on the same dates.
A non-trading pick date has no invented entry price. For research published after the close, the ledger explicitly uses the next verified session close as its baseline and displays that baseline date; returns stay unavailable until it exists. The ledger is empty until the first screened
edition is published. Reading progress is stored on this device.

## Daily publication

The Morning Edition task in ChatGPT starts at **09:00 a.m. IST**, targeting publication by **10:00 a.m. IST** with a labelled late release when needed. It researches the briefing, saves one dated edition to the `main` branch, and delivers the briefing in ChatGPT. Vercel builds the archive index and deploys `main` to production. Each edition becomes available when that build is ready.

The publication path is `public/editions/YYYY-MM-DD.json`. Set `date` to the IST edition date and include the seven keys from `public/edition-format.js` in `sections`. Give each card a stable `id`, a `label`, a `headline`, a factual `summary`, documented causes in `why`, significance in `context`, a primary `source` and `sourceUrl`, a `sources` array of `{ label, url }` entries, and a bundled `image`. Stock cards additionally require `valuation` and `risk`. Supply `preparedAt` for the preparation time or `publishedAt` for a confirmed public release time. The 17 November edition shows the format. The archive index is generated at build time.

The homepage opens the latest edition. Past editions have shareable URLs such as `/?edition=2026-11-14`. The app reads the static files directly; `/api/editions` and `/api/edition?date=YYYY-MM-DD` return the same data for other clients. Opened editions can be read offline.

## Local development

Run `npm install`, `npm run build`, and `npm run check`. The build generates `public/editions/index.json` and `public/picks-ledger.json`; both are ignored by git, so run the build before `npm run dev`, then open http://localhost:4173 for a static preview. On Vercel, the Other framework preset runs `npm run build` and serves `public`.

On iPhone, open the production address in Safari, select **Share → Add to Home Screen**, then open the Home Screen icon.

## Frontend layout

`public/app.js` is the entry point. It wires the modules in `public/js/`: `catalog.js` (loading editions), `state.js` (what is on screen), `progress.js` (reading progress on this device), `home.js` (the edition page), `reader.js` and `story-view.js` (the story reader), `story.js` (what a story shows up front and under "More"), `archive.js` and `settings.js`. Older (pre-v2) editions are handled in `public/edition-format.js` and `story.js`; their files are left unchanged so saved reading progress keeps matching. All styles are in `public/style.css`.

## Optional morning alerts

Web Push alerts use Upstash Redis to store subscriptions. To turn them on, set `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `CRON_SECRET`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` and a `mailto:` `VAPID_SUBJECT` as Vercel production variables. The authorized `/api/refresh` endpoint sends the day's alert and requires the cron secret as a bearer token. Without these, Settings simply doesn't show the alerts option. The daily ChatGPT task publishes to GitHub independently of these credentials.

## Photo credits

The reader no longer shows photos; older editions still reference these illustrative images, which the build validates. News and research sources are linked on each card.

- Phuket Old Town, cropped and resized. [Lisa van Vliet on Unsplash](https://unsplash.com/photos/colorful-buildings-line-a-busy-street-wsh74QVKijI)
- Car assembly, cropped and resized. [Lenny Kuhne on Unsplash](https://unsplash.com/photos/gray-vehicle-being-fixed-inside-factory-using-robot-machines-jHZ70nRk7Ns)
- Male Trinidadian guppy by Amy E. Deacon, Hideyasu Shimadzu, Maria Dornelas, Indar W. Ramnarine and Anne E. Magurran, converted to JPEG. [Original photo](https://commons.wikimedia.org/wiki/File:Trinidadian_guppy_(Poecilia_reticulata)_male.png) · [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)
