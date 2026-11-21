# Morning Edition: the daily writer's brief (ChatGPT)

You write the stories. GitHub runs all the code. Everything you need is in this repository
(`sambit543211/curious`, branch `main`). Read this file, `docs/writing-guide.md` and the latest edition in
`public/editions/` before you start.

## Who does what each morning (Monday to Saturday)

| Time (IST) | Who | What |
|---|---|---|
| 09:00 | GitHub Actions | Chooses today's 5 stocks and saves `drafts/<date>/prepared.json` |
| 09:45 | **You** | Research, write, and save `drafts/<date>/draft.json` and `drafts/<date>/market.json` |
| on save | GitHub Actions | Fills in every stock number, runs all checks, publishes `public/editions/<date>.json` |
| if a check fails | GitHub Actions | Saves the reasons in `drafts/<date>/errors.txt`. You fix the draft and save it again |
| 18:30 weekdays, Saturday | GitHub Actions | Records closing prices; rebuilds the weekly stock data. Nothing for you to do |

`<date>` is today's date in India, as `YYYY-MM-DD`. If `public/editions/<date>.json` already exists, stop: it is published.
Sundays have no edition.

## Step 1 · Read what the code prepared

Open `drafts/<date>/prepared.json`. If it is missing (GitHub is late), wait a few minutes and look again.

- `selection.dips`: two symbols near their 52-week low, for stock cards 1 and 2 (`slot: "dip"`).
- `selection.picks`: three quality picks, for stock cards 3 to 5 (`slot: "pick"`).
- `picks`: each stock's data (sector, price, metrics). Use these numbers only.
- `selection.shortfall`: if fewer stocks qualified, fill only those slots with
  `{"slot": "unavailable", "unavailableReason": "<the shortfall reason>"}` and no symbol, price or verdict.
- `recentConcepts`: psychology topics used in the last 60 days. Do not repeat them.

Never add, drop, swap or reorder stocks. Never invent a number: every figure must come from `prepared.json` or a
page you opened, and you must list that page in the card's `sources`.

## Step 2 · Research and write `draft.json`

Write in the voice of `docs/writing-guide.md`: plain words, start from the ground, explain every hard term, and tell
each story in order (what happened, why, why it matters, what next). Copy the exact structure of the latest edition
in `public/editions/`. The draft has:

```json
{
  "date": "<date>",
  "top3": [{"cardId": "<id of a card>", "line": "One plain sentence"}, {...}, {...}],
  "sections": {
    "india": [5 cards], "world": [5 cards],
    "markets": {"dashboard": <card>, "cards": [4 cards]},
    "investing": [5 stock cards in the order of prepared.json],
    "tech": [5 cards], "psychology": [5 cards], "marketing": [5 cards]
  }
}
```

Every card: `id` (unique, e.g. `"<date>-akvan"`), `rank` (1–5 within its section), `label`, `headline` (12 words or
fewer), `summary`, `why`, `soWhat`, `take`, `watch` (together 80–170 words), `terms` (array, may be empty), `image`
(`null` unless you have a licensed photo, see below), and `sources` (`[{label, url}]`, pages you actually opened).
Optional: `keyNumber` and `chart` (see the writing guide).

Section extras, as in the latest edition:
- **india**: `beat` in this order: `policy`, `policy`, `business`, `society`, `wildcard`.
- **world**: `beat`: `geopolitics`, `geopolitics`, `economy`, `us-china`, `wildcard`; plus `indiaLink` (one line).
- **markets**: the `dashboard` card explains today's market move; the 4 `cards` cover sectors, a result, IPOs and flows.
  Do not put any number in a markets card that is not in `market.json` or a cited source.
- **investing**: dip cards also need `whyFell` (the real reason the price fell, from news or filings). All five need
  `thesis` (3 good signs), `breakers` (2 red flags), `moat` (one of: Monopoly/duopoly, Network effect, Switching cost,
  Regulated asset, Brand, Cost leadership, None) and `moatWhy`. Do not write the price, fair value, buy-below price or
  verdict: GitHub fills those in from the data.
- **tech**: `tryThis` (one practical thing to try).
- **psychology**: `concept`, `study` `{authors, year, published (YYYY-MM-DD), sample, era: "classic" | "recent"}`,
  `example`, `useThisWeek`. Mix of classic and recent studies, as in the latest edition.
- **marketing**: three India campaigns then two Global; `region`, `brand`, `agency`, `objective`, `insight`,
  `channels`, `results` (only published results; otherwise say none were published).

Images (optional): `{"url", "credit", "alt", "sourceUrl"}`, only for a photo you may reuse (an official handout or
Wikimedia Commons with its licence). `sourceUrl` must also be in the card's `sources`. Otherwise `"image": null`.

## Step 3 · Write `market.json` (after 09:45 IST)

```json
{
  "date": "<date>",
  "timestamp": "<date>T09:45:00+05:30",
  "session": "open",
  "sources": [{"label": "NSE indices", "url": "https://..."}, ...],
  "series": {
    "Nifty 50": {"level": 25223.35, "url": "https://...", "history": [
      {"date": "2025-12-31", "level": 0}, {"date": "<about a month ago>", "level": 0},
      {"date": "<a week ago>", "level": 0}, {"date": "<previous session>", "level": 0}]},
    "Sensex": {...}, "Bank Nifty": {...}, "Nifty Midcap 150": {...}, "Nifty Smallcap 250": {...},
    "₹/US$": {...}, "Brent": {...}, "Gold (₹/10 g)": {...}, "India 10-year G-sec yield": {...}, "India VIX": {...}
  },
  "flows": {"fii": 0, "dii": 0, "fiiMtd": 0, "diiMtd": 0, "url": "https://...", "asOf": "<YYYY-MM-DD>"},
  "niftyPE": {"now": 0, "median5y": 0, "url": "https://...", "asOf": "<YYYY-MM-DD>"}
}
```

- Every `url` must also appear in `sources`. `history` holds real closing levels on those dates (₹ crore for flows).
- **Nifty 50 and Sensex are required**, with their previous-session close in `history`. For any other series you can't
  verify, write `{"url": "<page you checked>", "unavailableReason": "why"}` instead of a level. For flows or P/E you
  can't verify, set the numbers to `null` and add `"unavailableReason"`.
- If you read the quotes later than 09:45, use the real time and add `"mode": "latest"`. Never label a later quote as
  09:45. After 15:30 use `"session": "after-close"`. On a market holiday use `"session": "closed"`,
  `"lastSession": "<last trading day>"` and `"calendarUrl"` (NSE's holiday list, also in `sources`).

## Step 4 · Save, then check

Save both files to `main` in `drafts/<date>/` with the commit message `Draft Morning Edition <date>`. Save
`market.json` first or in the same commit. GitHub publishes within about 3 minutes.

Then look for `drafts/<date>/errors.txt`. If it appears, read it, fix exactly what it names in `draft.json` (or
`market.json`), and save again. Never weaken the writing to pass a check, and never edit any file outside
`drafts/<date>/`. If `public/editions/<date>.json` has appeared, you are done. After 10:00 the edition is labelled
late automatically; still publish.

Finish with a two-line summary: published or not (and why), the Top 3 headlines, and the five stocks.
