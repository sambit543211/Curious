# Morning Edition

A phone-first daily briefing across India, World, Indian Markets, Stock Investing, AI & Tech, Psychology and Marketing (topic names and order live in `public/topics.js`). Current editions have five cards per topic. Earlier issues retain their original topics, and reading progress stays on the reader's device.

## V2 publication

The archive accepts the original editions and v2 separately. V2 requires sourced Top 3 links,
five cards in each active section, a market dashboard and four market cards, and five code-selected
stocks (two near their 52-week low, three quality picks; see below). Sundays omit Indian Markets. A Saturday or holiday
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

## Stock Investing: how the five stocks are chosen

Code chooses the stocks; the writer only explains them. The rules live in `lib/stock-selection.js` and
`public/investment-rules.js`; the writer must not pick, add, drop or reorder stocks.

**Inputs.** (1) A weekly fundamentals file in `data/fundamentals/` (format in `data/fundamentals/README.md`),
refreshed every Saturday for the Nifty 500 and checked with `npm run check-fundamentals -- <file>`. (2) NSE's daily
bhavcopy and adjusted 52-week high/low files for the previous session, downloaded automatically. P/E and P/B are
recomputed from that close. Run `npm run stock-input` at any time to see the day's selection without publishing.

**Every chosen stock** passes the quality screen (ROCE, debt, growth, cash flow, pledge, valuation, liquidity), has a
Buy or Wait verdict (never Avoid), comes from a different sector than the other four, and was not shown in the last
14 days, unless its verdict changed or it fell below its buy-below price (then it is labelled as a repeat).

- **Cards 1–2 · near the 52-week low (`slot: "dip"`):** within 10% of the 52-week low, at least 25% below the
  52-week high, latest-quarter profit not down more than 20% a year on, and promoters did not cut their holding by
  more than 2 points. Ranked by discount to fair value. The code labels the fall `sector-wide` (sector peers'
  median is 15%+ below their highs), `stock-specific` or `no-peers`. The writer must add `whyFell`: the actual
  reason, from news or filings.
- **Cards 3–5 · quality picks (`slot: "pick"`):** ranked by an equal-weight score of return on capital, 5-year
  profit growth and discount to fair value.
- **Mondays:** the cheapest Buy (against fair value) with a moat is flagged `weekly: true` (Buy of the week).
- **Too few qualify:** the code reports a `shortfall` reason; fill only those slots with `slot: "unavailable"` and
  that reason. Never loosen a rule or substitute a stock.

**Draft format.** `sections.investing` has exactly five cards in order: two `dip` cards then three `pick` cards,
each `{symbol, headline, summary, why, soWhat, take, watch, thesis[3], breakers[2], moat, moatWhy, sources, ...}`
plus `whyFell` on dip cards. `npm run publish-v2 -- draft.json` fills in every number from the data, re-checks the
selection and rejects a stock the code did not choose. A thesis change for an earlier pick goes in the draft's
top-level `stockEvents: [{pickDate, symbol, status: "Thesis broken" | "Exited", reason, sourceUrl}]`. The watchlist
and metric-lesson cards are retired; the Track Record page shows every position.

After the session, run `npm run update-closes -- YYYY-MM-DD`. Commit only the new dated file
under `public/market-closes/` if one was written. The build derives the pick ledger from the
published editions and calculates returns from the official NSE closes on the same dates.
A non-trading pick date has no invented entry price. For research published after the close, the ledger explicitly uses the next verified session close as its baseline and displays that baseline date; returns stay unavailable until it exists. The ledger is empty until the first screened
edition is published. Reading progress is stored on this device.

## Writing style

Each card has 80–170 words of prose (summary, why, soWhat, take, watch). Figures may be rounded ("about 27%") or written in lakh/crore, but must sit within 5% of a dated, cited figure.

Every card follows `docs/writing-guide.md`: plain words, start from the ground, explain every hard term,
and tell each story in order (what happened, why, why it matters, what next). Stock cards read as a simple
company profile: what it does, its growth, good signs, red flags, and whether it is cheap or expensive.

## Daily publication

Claude's scheduled Morning Edition task (steps in `docs/daily-run.md`) starts at **09:25 a.m. IST**, targeting publication by **10:00 a.m. IST** with a labelled late release when needed. It researches the briefing, saves one dated edition to the `main` branch, and pushes it. Vercel builds the archive index and deploys `main` to production. Each edition becomes available when that build is ready.

The publication path is `public/editions/YYYY-MM-DD.json`. Set `date` to the IST edition date and include the seven keys from `public/edition-format.js` in `sections`. Give each card a stable `id`, a `label`, a `headline`, a factual `summary`, documented causes in `why`, significance in `context`, a primary `source` and `sourceUrl`, a `sources` array of `{ label, url }` entries, and a bundled `image`. Stock cards additionally require `valuation` and `risk`. Supply `preparedAt` for the preparation time or `publishedAt` for a confirmed public release time. The 17 November edition shows the format. The archive index is generated at build time.

The homepage opens the latest edition. Past editions have shareable URLs such as `/?edition=2026-11-14`. The app reads the static files directly; `/api/editions` and `/api/edition?date=YYYY-MM-DD` return the same data for other clients. Opened editions can be read offline.

## Local development

Run `npm install`, `npm run build`, and `npm run check`. The build generates `public/editions/index.json` and `public/picks-ledger.json`; both are ignored by git, so run the build before `npm run dev`, then open http://localhost:4173 for a static preview. On Vercel, the Other framework preset runs `npm run build` and serves `public`.

On iPhone, open the production address in Safari, select **Share → Add to Home Screen**, then open the Home Screen icon.

## Frontend layout

The app is dark by default (light and automatic are in Settings) and is built to run from the iPhone Home Screen: full screen, safe-area aware, with a bottom tab bar (Today, Editions, Stocks, Settings), a floating Continue button and a full-screen story reader. Fonts are Newsreader (news text) and Inter (interface and figures), self-hosted under `public/fonts` with their OFL licences.

`public/app.js` is the entry point. It wires the modules in `public/js/`: `catalog.js` (loading editions), `state.js` (what is on screen), `progress.js` (reading progress on this device), `streak.js` (the daily reading streak), `views.js` (tabs and the condensing top bar), `home.js` (Today), `editions.js` (the calendar), `stocks.js` (picks and track record), `settings.js` (alerts), `reader.js` and `story-view.js` (the story reader) and `story.js` (what a story shows up front and under "More"). Older (pre-v2) editions are handled in `public/edition-format.js` and `story.js`; their files are left unchanged so saved reading progress keeps matching. All styles are in `public/style.css`. `/track-record.html` redirects to the Stocks tab.

## Optional morning alerts

Web Push alerts use Upstash Redis to store subscriptions. To turn them on, set `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `CRON_SECRET`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` and a `mailto:` `VAPID_SUBJECT` as Vercel production variables. The authorized `/api/refresh` endpoint sends the day's alert and requires the cron secret as a bearer token. Without these, Settings simply doesn't show the alerts option. The daily task publishes to GitHub independently of these credentials.

## Photo credits

The reader no longer shows photos; older editions still reference these illustrative images, which the build validates. News and research sources are linked on each card.

- Phuket Old Town, cropped and resized. [Lisa van Vliet on Unsplash](https://unsplash.com/photos/colorful-buildings-line-a-busy-street-wsh74QVKijI)
- Car assembly, cropped and resized. [Lenny Kuhne on Unsplash](https://unsplash.com/photos/gray-vehicle-being-fixed-inside-factory-using-robot-machines-jHZ70nRk7Ns)
- Male Trinidadian guppy by Amy E. Deacon, Hideyasu Shimadzu, Maria Dornelas, Indar W. Ramnarine and Anne E. Magurran, converted to JPEG. [Original photo](https://commons.wikimedia.org/wiki/File:Trinidadian_guppy_(Poecilia_reticulata)_male.png) · [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)
