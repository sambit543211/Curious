# Weekly fundamentals

One file per week, named `YYYY-MM-DD.json` (the date it was collected). The morning step uses the newest file
dated on or before the edition, and refuses one older than 10 days. Prices, P/E, P/B and 52-week ranges are NOT
taken from this file: they come from NSE's daily files.

```json
{
  "date": "2026-11-21",
  "source": {"label": "Screener.in export: Nifty 500, 21 Nov 2026", "url": "https://www.screener.in/..."},
  "sources": [{"label": "Screener.in export: Nifty 500, 21 Nov 2026", "url": "https://www.screener.in/..."}],
  "stocks": [
    {"symbol": "POLYCAB", "sector": "Cables", "kind": "non-financial", "dataDate": "2026-09-30",
     "metrics": {"roce5y": 28.4, "de": 0.02, "salesCagr5y": 26.86, "profitCagr5y": 25.04, "ocfPositiveYears": 5,
                 "eps": 209.56, "peMedian5y": 45.33, "divYield": 0.64, "promoterHolding": 61.44, "pledge": 0,
                 "marketCap": 110131, "avgDailyValue": 272.17, "profitYoY": 18.2, "promoterChange": -0.1}}
  ]
}
```

- `kind`: `non-financial`, `bank` or `nbfc`. Banks and NBFCs need `roa, grossNpa, car, bvps, pbMedian5y` instead of `roce5y, de, salesCagr5y, ocfPositiveYears, eps, peMedian5y`.
- `profitYoY`: latest quarter's net profit vs the same quarter a year earlier, in %. `promoterChange`: change in promoter holding over the last quarter, in percentage points.
- `dataDate`: the quarter-end the figures belong to. A metric can carry its own `metricSources[key] = {url, asOf}`; otherwise the file's `source` is used.
- Check a file before committing: `npm run check-fundamentals -- data/fundamentals/2026-11-21.json`.
