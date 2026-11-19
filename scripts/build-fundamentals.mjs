import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { companyId, num, parseCompany, section, table, topRatios } from '../lib/screener.js';
import { fundamentalsGaps, nseUrls, parseBhavcopy } from '../lib/stock-input.js';
import { records, zippedCSV } from '../lib/nse-closes.js';
import { indianDay } from '../public/edition-format.js';

// Builds data/fundamentals/<date>.json for the Nifty 500 from Screener.in company pages and NSE files.
// Usage: npm run build-fundamentals -- [--date YYYY-MM-DD] [--symbols A,B] [--limit N] [--delay ms] [--cache dir]
// Requests go one at a time with a pause between them; pages are cached so an interrupted run resumes.

const arg = (name, fallback) => {
  const index = process.argv.indexOf('--' + name);
  return index > 0 ? process.argv[index + 1] : fallback;
};
const date = arg('date', indianDay());
const delay = Number(arg('delay', 1500));
const cacheDir = arg('cache', '/tmp/screener-cache/' + date);
const limit = Number(arg('limit', 0));
const only = arg('symbols', '')?.split(',').filter(Boolean) ?? [];
const UA = 'Mozilla/5.0 (X11; Linux x86_64) MorningEdition/1.0 (personal weekly screen)';
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const shift = (day, n) => new Date(Date.parse(day + 'T12:00:00Z') + n * 86400000).toISOString().slice(0, 10);
const NIFTY500 = 'https://nsearchives.nseindia.com/content/indices/ind_nifty500list.csv';

async function get(url, {json = false, binary = false, cache} = {}) {
  if (cache && existsSync(cache)) {
    const text = await readFile(cache, 'utf8');
    return json ? JSON.parse(text) : text;
  }
  for (let attempt = 1; attempt <= 3; attempt++) {
    const response = await fetch(url, {headers:{'User-Agent':UA, Accept:'*/*'}, signal:AbortSignal.timeout(30000)}).catch(() => null);
    await wait(delay);
    if (response?.status === 404) return null;
    if (response?.ok) {
      const body = binary ? await response.arrayBuffer() : await response.text();
      if (cache && !binary) await writeFile(cache, body);
      return json ? JSON.parse(body) : body;
    }
    await wait(delay * attempt * 4); // back off on errors or rate limits
  }
  throw new Error('Request failed three times: ' + url);
}

async function averageTradedValue(sessions = 10) {
  const totals = new Map();
  let found = 0;
  let latest = null;
  for (let back = 1; found < sessions && back <= 25; back++) {
    const day = shift(date, -back);
    const raw = await get(nseUrls(day).bhavcopy, {binary:true});
    if (!raw) continue;
    const rows = parseBhavcopy(zippedCSV(raw), day);
    for (const [symbol, row] of rows) totals.set(symbol, (totals.get(symbol) ?? 0) + row.turnover);
    latest ??= day;
    found++;
  }
  return {latest, sessions:found, values:new Map([...totals].map(([symbol, total]) => [symbol, total / found / 1e7]))};
}

await mkdir(cacheDir, {recursive:true});
const universe = records(await get(NIFTY500))
  .filter(row => row.Series === 'EQ' && (!only.length || only.includes(row.Symbol)))
  .slice(0, limit || undefined);
console.log('Universe: ' + universe.length + ' stocks · cache ' + cacheDir);
const traded = await averageTradedValue();
const tradedUrl = nseUrls(traded.latest).bhavcopy;

const screenerSource = {label:'Screener.in company pages, ' + date, url:'https://www.screener.in/'};
const stocks = [];
const skipped = [];
for (const [index, row] of universe.entries()) {
  const symbol = row.Symbol;
  const safe = symbol.replace(/[^A-Z0-9_-]/gi, '_');
  try {
    let url = 'https://www.screener.in/company/' + encodeURIComponent(symbol) + '/consolidated/';
    let html = await get(url, {cache:cacheDir + '/' + safe + '-c.html'});
    // Use the standalone page when the consolidated one has no figures of its own (no results or blank ratios).
    if (html && (!table(section(html, 'quarters')).rows.size || !Number.isFinite(num(topRatios(html)['Market Cap'])))) {
      url = 'https://www.screener.in/company/' + encodeURIComponent(symbol) + '/';
      html = await get(url, {cache:cacheDir + '/' + safe + '-s.html'});
    }
    if (!html) { skipped.push(symbol + ' (no Screener page)'); continue; }
    const id = companyId(html);
    const consolidated = url.includes('/consolidated/');
    const chart = id ? await get('https://www.screener.in/api/company/' + id + '/chart/?q=Price+to+Earning-Median+PE-EPS&days=1825' + (consolidated ? '&consolidated=true' : ''),
      {json:true, cache:cacheDir + '/' + safe + (consolidated ? '-pe.json' : '-pe-s.json')}) : null;
    const {metrics, dataDate} = parseCompany(html, chart);
    const quarters = table(section(html, 'quarters'));
    const financial = quarters.rows.has('Financing Profit') || quarters.rows.has('Revenue');
    const kind = financial ? (/bank/i.test(row['Company Name']) ? 'bank' : 'nbfc') : 'non-financial';
    if (traded.values.has(symbol)) metrics.avgDailyValue = Math.round(traded.values.get(symbol) * 100) / 100;
    if (!dataDate) { skipped.push(symbol + ' (no quarterly results)'); continue; }
    const pageSource = {label:'Screener.in: ' + row['Company Name'], url};
    const metricSources = Object.fromEntries(Object.keys(metrics).map(key => [key,
      key === 'avgDailyValue' ? {url:tradedUrl, asOf:traded.latest} : {url, asOf:date}]));
    stocks.push({symbol, name:row['Company Name'], sector:row.Industry, kind, dataDate, metrics, metricSources,
      sources:[pageSource, ...(metrics.avgDailyValue ? [{label:'NSE bhavcopy (10-session average traded value)', url:tradedUrl}] : [])]});
  } catch (error) {
    skipped.push(symbol + ' (' + error.message + ')');
  }
  if ((index + 1) % 25 === 0) console.log('  ' + (index + 1) + '/' + universe.length);
}

const file = {date, source:screenerSource, sources:[screenerSource, {label:'NSE Nifty 500 constituents', url:NIFTY500}], stocks};
const gaps = fundamentalsGaps(file);
const out = new URL('../data/fundamentals/' + date + '.json', import.meta.url);
await writeFile(out, JSON.stringify(file, null, 1) + '\n');
console.log('Wrote data/fundamentals/' + date + '.json · ' + stocks.length + ' stocks · ' + (stocks.length - gaps.length) + ' with every required metric · ' + skipped.length + ' skipped');
const missing = {};
for (const gap of gaps) for (const key of gap.missing) missing[key] = (missing[key] ?? 0) + 1;
console.log('Missing metric counts: ' + JSON.stringify(missing));
if (skipped.length) console.log('Skipped: ' + skipped.slice(0, 20).join('; '));
