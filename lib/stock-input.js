import { readFile, readdir } from 'node:fs/promises';
import { isDay, nonEmpty, sourceLink, validSources } from '../public/edition-format.js';
import { csvFields, records, zippedCSV } from './nse-closes.js';

// Builds the daily stock input: the latest weekly fundamentals file (data/fundamentals/YYYY-MM-DD.json)
// merged with the previous NSE session's closing prices and adjusted 52-week high/low.
// Fundamentals change once a quarter, so they are refreshed weekly; prices and 52-week ranges come from NSE daily.

const domain = 'https://nsearchives.nseindia.com';
export const MAX_FUNDAMENTALS_AGE_DAYS = 10;
const fundamentalsDir = new URL('../data/fundamentals/', import.meta.url);

export const nseUrls = date => {
  const [y, m, d] = date.split('-');
  return {
    bhavcopy:domain + '/content/cm/BhavCopy_NSE_CM_0_0_0_' + y + m + d + '_F_0000.csv.zip',
    range:domain + '/content/CM_52_wk_High_low_' + d + m + y + '.csv'
  };
};

const daysBetween = (later, earlier) => (Date.parse(later) - Date.parse(earlier)) / 86400000;
const shift = (date, days) => new Date(Date.parse(date + 'T12:00:00Z') + days * 86400000).toISOString().slice(0, 10);
const number = text => {
  const value = Number(String(text ?? '').trim().replaceAll(',', ''));
  return Number.isFinite(value) && value > 0 ? value : null;
};

export function parseBhavcopy(csv, date) {
  return new Map(records(csv)
    .filter(row => row.TradDt === date && row.SctySrs === 'EQ' && number(row.ClsPric))
    .map(row => [row.TckrSymb, {close:number(row.ClsPric), turnover:Number(row.TtlTrfVal) || 0}]));
}

export function parseRange(csv, date) {
  const lines = csv.replace(/^﻿/, '').split(/\r?\n/);
  const [y, m, d] = date.split('-');
  const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
  const effective = 'Effective for ' + d + '-' + months[Number(m) - 1][0] + months[Number(m) - 1].slice(1).toLowerCase() + '-' + y;
  if (!lines.slice(0, 3).some(line => line.includes(effective))) throw new Error('52-week file is not for ' + date);
  const headerAt = lines.findIndex(line => /SYMBOL/i.test(line) && /52/.test(line));
  if (headerAt < 0) throw new Error('52-week file header not found');
  const header = csvFields(lines[headerAt]).map(name => name.trim());
  const col = test => header.findIndex(test);
  const symbol = col(name => /^symbol$/i.test(name));
  const series = col(name => /^series$/i.test(name));
  const high = col(name => /high/i.test(name) && !/date|dt/i.test(name));
  const low = col(name => /low/i.test(name) && !/date|dt/i.test(name));
  if ([symbol, series, high, low].some(index => index < 0)) throw new Error('52-week file columns not recognised');
  const out = new Map();
  for (const line of lines.slice(headerAt + 1).filter(Boolean)) {
    const fields = csvFields(line);
    if (fields[series]?.trim() !== 'EQ') continue;
    const h = number(fields[high]);
    const l = number(fields[low]);
    if (h && l) out.set(fields[symbol].trim(), {high52:h, low52:l});
  }
  return out;
}

async function fetchText(url, zipped) {
  const response = await fetch(url, {signal:AbortSignal.timeout(20000), headers:{Accept:'*/*', 'User-Agent':'Mozilla/5.0'}});
  if (response.status === 404) return null;
  if (!response.ok) throw new Error('NSE request returned ' + response.status + ' for ' + url);
  return zipped ? zippedCSV(await response.arrayBuffer()) : response.text();
}

// The latest NSE session strictly before the edition date (skips weekends and holidays).
export async function previousSession(date, fetcher = fetchText) {
  for (let back = 1; back <= 7; back++) {
    const session = shift(date, -back);
    const urls = nseUrls(session);
    const bhav = await fetcher(urls.bhavcopy, true);
    if (!bhav) continue;
    const range = await fetcher(urls.range, false);
    if (!range) throw new Error('NSE 52-week file missing for ' + session);
    return {session, urls, prices:parseBhavcopy(bhav, session), ranges:parseRange(range, session)};
  }
  throw new Error('No NSE session found in the 7 days before ' + date);
}

export async function latestFundamentals(date, dir = fundamentalsDir) {
  const names = (await readdir(dir).catch(() => [])).filter(name => /^\d{4}-\d{2}-\d{2}\.json$/.test(name) && name.slice(0, 10) <= date).sort();
  if (!names.length) throw new Error('No weekly fundamentals file in data/fundamentals/ on or before ' + date);
  const file = JSON.parse(await readFile(new URL(names.at(-1), dir), 'utf8'));
  validateFundamentals(file, names.at(-1).slice(0, 10));
  if (daysBetween(date, file.date) > MAX_FUNDAMENTALS_AGE_DAYS) throw new Error('Weekly fundamentals file ' + file.date + ' is more than ' + MAX_FUNDAMENTALS_AGE_DAYS + ' days old: refresh it');
  return file;
}

export const requiredMetrics = {
  'non-financial':['roce5y','de','salesCagr5y','profitCagr5y','ocfPositiveYears','eps','peMedian5y','divYield','promoterHolding','marketCap','avgDailyValue','profitYoY','promoterChange'],
  bank:['roa','grossNpa','car','bvps','pbMedian5y','divYield','promoterHolding','marketCap','avgDailyValue','profitYoY','promoterChange']
};
requiredMetrics.nbfc = requiredMetrics.bank;

// Stocks missing a required metric can never pass the screen; list them so the weekly file can be fixed.
export function fundamentalsGaps(file) {
  return (file?.stocks ?? []).map(stock => ({symbol:stock?.symbol,
    missing:(requiredMetrics[stock?.kind] ?? []).filter(key => !Number.isFinite(stock?.metrics?.[key]))}))
    .filter(row => row.missing.length);
}

export function validateFundamentals(file, expectedDate) {
  const problems = [];
  if (!isDay(file?.date) || (expectedDate && file.date !== expectedDate)) problems.push('date must match the file name');
  if (!validSources(file?.sources) || !sourceLink(file?.source?.url)) problems.push('needs source {label,url} and sources[]');
  if (!Array.isArray(file?.stocks) || !file.stocks.length) problems.push('stocks[] is empty');
  for (const stock of file?.stocks ?? []) {
    if (!/^[A-Z0-9&_-]+$/.test(stock?.symbol ?? '') || !nonEmpty(stock.sector) || !['non-financial', 'bank', 'nbfc'].includes(stock.kind) ||
        !isDay(stock.dataDate) || typeof stock.metrics !== 'object') problems.push((stock?.symbol ?? '?') + ': needs symbol, sector, kind, dataDate, metrics');
  }
  if (problems.length) throw new Error('Invalid fundamentals file: ' + problems.slice(0, 8).join('; '));
}

export function mergeStockInput(date, fundamentals, nse) {
  const nseSources = [
    {label:'NSE bhavcopy, ' + nse.session, url:nse.urls.bhavcopy},
    {label:'NSE adjusted 52-week high/low, ' + nse.session, url:nse.urls.range}
  ];
  const fileEvidence = {url:fundamentals.source.url, asOf:fundamentals.date};
  const missing = [];
  const stocks = [];
  for (const stock of fundamentals.stocks) {
    const quote = nse.prices.get(stock.symbol);
    const range = nse.ranges.get(stock.symbol);
    if (!quote || !range) { missing.push(stock.symbol); continue; }
    const metrics = {...stock.metrics, high52:range.high52, low52:range.low52};
    // Price-based ratios move every day: recompute them from the NSE close instead of trusting the weekly file.
    const recomputed = [];
    if (stock.metrics.eps > 0) { metrics.pe = Math.round(quote.close / stock.metrics.eps * 100) / 100; recomputed.push('pe'); }
    if (stock.metrics.bvps > 0) { metrics.pb = Math.round(quote.close / stock.metrics.bvps * 100) / 100; recomputed.push('pb'); }
    const metricSources = Object.fromEntries(Object.keys(metrics).filter(key => Number.isFinite(metrics[key]) && !['high52','low52'].includes(key))
      .map(key => [key, stock.metricSources?.[key] ?? fileEvidence]));
    for (const key of recomputed) metricSources[key] = {url:nse.urls.bhavcopy, asOf:nse.session};
    Object.assign(metricSources, {
      price:{url:nse.urls.bhavcopy, asOf:nse.session},
      high52:{url:nse.urls.range, asOf:nse.session},
      low52:{url:nse.urls.range, asOf:nse.session}
    });
    const sources = [...new Map([...(fundamentals.sources ?? []), ...(stock.sources ?? []), ...nseSources]
      .map(source => [source.url, source])).values()];
    stocks.push({symbol:stock.symbol, sector:stock.sector, kind:stock.kind, price:quote.close, quoteDate:nse.session,
      dataDate:stock.dataDate, metrics, metricSources, sources});
  }
  return {date, session:nse.session, fundamentalsDate:fundamentals.date, stocks, facts:[],
    missingFromNse:missing, ...(stocks.length ? {} : {unavailableReason:'No stock in the weekly file matched NSE data for ' + nse.session})};
}

export async function buildStockInput(date, options = {}) {
  const fundamentals = options.fundamentals ?? await latestFundamentals(date);
  const nse = options.nse ?? await previousSession(date, options.fetcher);
  return mergeStockInput(date, fundamentals, nse);
}
