# Daily run (Claude scheduled tasks)

Claude publishes Morning Edition on a schedule. Each run starts in a fresh session, so this file and
README.md are the whole brief. The owner (GitHub sambit543211) asked Claude to run and push these jobs.

## Morning edition · Monday to Saturday, starts 09:25 IST, publish by 10:00 IST

1. Clone `sambit543211/curious` (push access), `npm install`, `npm run build`, `npm run check`.
   If an edition for today's IST date is already in `public/editions/`, stop: it was published.
2. `MORNING_PREPARE_STAGE=draft node scripts/prepare-v2.mjs <date> > /tmp/prepared.json`.
   Its `selection` lists the stocks the code chose: `dips` → cards 1–2, `picks` → cards 3–5, in that order.
   Never add, drop, swap or reorder stocks; use `slot: "unavailable"` with the given `shortfall` reason
   for empty slots.
3. Research and write the draft (`/tmp/draft.json`) in the shape of `scripts/check-v2.mjs`'s draft and
   the latest edition in `public/editions/`: Top 3, then India, World, Indian Markets (4 cards), Stock
   Investing (5), AI & Tech, Psychology, Marketing, 5 cards each. Write every card in the voice of docs/writing-guide.md (plain words, start from the ground, explain
   every hard term, stock cards as a simple company profile) and follow the rules in
   README.md: primary sources first, 80–170 words of prose per card (rounded figures are fine), a `why` that adds background, a
   concrete `soWhat`, one arguable `take`, a specific `watch`, banned phrases avoided, technical terms
   explained. Use web search and fetch; open every page you cite. Dip cards need `whyFell` from news or
   filings. Indian Markets is omitted on Sundays.
4. After 09:45 IST, build the market snapshot (`/tmp/market.json`) in the README's market format from
   sourced quotes (Nifty 50, Sensex, previous closes mandatory; other rows may carry `unavailableReason`).
   Never relabel a later quote as 09:45; use `mode: "latest"` with its real timestamp.
5. `node scripts/publish-v2.mjs /tmp/draft.json "" /tmp/market.json`. Fix the draft until it passes;
   never weaken a check or edit selection code. Then `npm run build && npm run check`.
6. Commit only `public/editions/<date>.json` as "Publish Morning Edition <date>" and push to `main`.
   After 10:00 the edition is labelled late automatically; still publish.
7. If something blocks publishing (a source down, a check you cannot satisfy honestly), do not
   publish a weaker edition: leave a note for the owner explaining what failed.

## Closing prices · Monday to Friday, 16:20 IST

Clone, `npm install`, `npm run update-closes -- <date>`. If it wrote a file under
`public/market-closes/`, commit only that file ("Record NSE closes <date>") and push to `main`.

## Weekly fundamentals · Saturday, 11:10 IST

Build `data/fundamentals/<date>.json` for the Nifty 500 (constituents:
https://nsearchives.nseindia.com/content/indices/ind_nifty500list.csv) in the format of
`data/fundamentals/README.md` with `npm run build-fundamentals` (Screener.in company pages + NSE files,
one request at a time; takes ~35 minutes, so run it in chunks of under 10 minutes with the same `--cache`
directory, e.g. `timeout 570 npm run build-fundamentals -- --cache /tmp/sc`, repeating until it prints
"Wrote"). Never estimate a number; pledge is not on Screener's public pages and shows as "not checked". Run `npm run check-fundamentals -- <file>`;
commit only that file and push. Report how many stocks are complete.

Never commit secrets, never force-push, never rewrite earlier editions.
