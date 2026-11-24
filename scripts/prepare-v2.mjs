import { readFile, readdir } from 'node:fs/promises';
import { marketDashboard } from '../lib/edition-v2.js';
import { selectStocks } from '../lib/stock-selection.js';
import { buildStockInput } from '../lib/stock-input.js';
import { getDeck, indianDay, isDay, isSunday, sourceLink } from '../public/edition-format.js';
import { makeLedger, readCloses } from '../lib/track-record.js';
import { fetchTrending } from '../lib/trending.js';

export async function fetchInput(entry, date, key) {
  if (!entry) throw new Error('Missing ' + key + ' input');
  const url = sourceLink(entry);
  if (url) {
    url.searchParams.set('date',date);
    const headers = {Accept:'application/json'};
    const token = process.env[key + '_TOKEN'];
    if (token) headers.Authorization = 'Bearer ' + token;
    const response = await fetch(url,{headers,signal:AbortSignal.timeout(20000),redirect:'error'});
    if (!response.ok) throw new Error(key + ' source returned ' + response.status);
    return response.json();
  }
  return JSON.parse(await readFile(entry,'utf8'));
}

export async function readHistory() {
  const dir = new URL('../public/editions/',import.meta.url);
  const names = (await readdir(dir)).filter(name => /^\d{4}-\d{2}-\d{2}\.json$/.test(name));
  const history = await Promise.all(names.map(async name => JSON.parse(await readFile(new URL(name,dir),'utf8'))));
  history.push(JSON.parse(await readFile(new URL('../public/first-edition.json',import.meta.url),'utf8')));
  return history;
}

export async function prepareInputs(date, options, history) {
  const stage = options.stage ?? 'all';
  if (!isDay(date) || !['all','draft','market'].includes(stage)) throw new Error('Provide an ISO date and a valid preparation stage');
  const useFundamentals = stage !== 'market';
  const useMarket = stage !== 'draft' && !isSunday(date);
  const [fundamentals, market, closes] = await Promise.all([
    useFundamentals ? (options.fundamentals || process.env.MORNING_FUNDAMENTALS_URL ?
      fetchInput(options.fundamentals ?? process.env.MORNING_FUNDAMENTALS_URL,date,'MORNING_FUNDAMENTALS') :
      buildStockInput(date).catch(error => ({date, stocks:[], facts:[], unavailableReason:'Stock data unavailable: ' + error.message}))) : null,
    useMarket ? fetchInput(options.market ?? process.env.MORNING_MARKET_URL,date,'MORNING_MARKET') : null,
    useFundamentals ? readCloses() : []
  ]);
  if ((useFundamentals && fundamentals?.date !== date) || (useMarket && market?.date !== date)) throw new Error('Input must identify the requested IST edition date');
  const selection = fundamentals ? selectStocks(fundamentals.stocks,date,history) : null;
  const picks = selection ? [...selection.dips,...selection.picks] : [];
  const facts = [...(market?.facts ?? []),...(fundamentals?.facts ?? []), ...picks.flatMap(stock => [
    {value:stock.price,...stock.metricSources?.price},
    ...Object.entries(stock.metrics).filter(([,value]) => Number.isFinite(value))
      .map(([key,value]) => ({value,...stock.metricSources?.[key]}))
  ])];
  const dashboard = market ? marketDashboard(market,date) : null;
  if (dashboard) {
    for (const row of dashboard.rows) for (const field of ['level','previousClose','d1','w1','m1','ytd']) {
      if (Number.isFinite(row[field])) facts.push({value:row[field],...row.source});
    }
    for (const source of [dashboard.flows,dashboard.niftyPE]) {
      for (const value of Object.values(source).filter(Number.isFinite)) facts.push({value,url:source.url,asOf:source.asOf});
    }
  }
  const past = closes.filter(entry => entry.date < date).sort((a,b) => a.date.localeCompare(b.date));
  const cutoff = new Date(Date.parse(date) - 7*86400000).toISOString().slice(0,10);
  const previous = past.filter(row => row.date <= cutoff).at(-1);
  const latest = past.at(-1);
  const tracked = makeLedger(history,past);
  const entries = tracked.rows.filter(item => item.status !== 'Exited').flatMap(item => {
    const price = latest?.prices[item.symbol];
    const pastPrice = previous?.prices[item.symbol];
    if (!price) return item.status === 'Thesis broken' ? [{symbol:item.symbol,pickDate:item.date,status:item.status,reason:item.statusReason}] : [];
    const weekly = pastPrice ? Number(((price/pastPrice - 1) * 100).toFixed(2)) : null;
    const reason = item.status === 'Thesis broken' ? item.statusReason :
      price <= item.buyBelow ? 'NSE close at or below buy-below price' :
      Math.abs(weekly ?? 0) > 5 ? 'Moved more than 5% over seven days' : null;
    if (!reason) return [];
    for (const value of [price,weekly].filter(Number.isFinite)) facts.push({value,url:latest.equitiesSource,asOf:latest.date});
    return [{symbol:item.symbol,pickDate:item.date,status:item.status,price,weekly,reason}];
  });
  return {date, dashboard, picks, facts,
    ...(selection ? {selection:{dips:selection.dips.map(s => s.symbol),picks:selection.picks.map(s => s.symbol),counts:selection.counts,shortfall:fundamentals.unavailableReason ? {dip:fundamentals.unavailableReason,pick:fundamentals.unavailableReason} : selection.shortfall,
      session:fundamentals.session ?? null,fundamentalsDate:fundamentals.fundamentalsDate ?? null,missingFromNse:fundamentals.missingFromNse ?? []}} : {}),
    ...(fundamentals?.unavailableReason ? {fundamentalsUnavailable:fundamentals.unavailableReason} : {}), watchlist:{dataDate:latest?.date ?? null,entries,picks:tracked.rows.map(({date,symbol,status}) => ({date,symbol,status}))},
    recentConcepts:history.filter(issue => issue.date < date &&
      Date.parse(date)-Date.parse(issue.date) <= 60*86400000).flatMap(issue => getDeck(issue,'mind').map(card => card.concept ?? card.label))};
}

if (process.argv[1]?.endsWith('prepare-v2.mjs')) {
  const [date = indianDay(),fundamentals,market] = process.argv.slice(2);
  const options = {fundamentals:fundamentals || undefined,market:market || undefined,
    stage:process.env.MORNING_PREPARE_STAGE ?? 'all'};
  const prepared = await prepareInputs(date,options,await readHistory());
  // The morning checklist of big stories (Google News top headlines) the writer must cover or explain.
  if (options.stage === 'draft' && process.env.MORNING_TRENDING !== 'off') prepared.trending = await fetchTrending();
  console.log(JSON.stringify(prepared,null,2));
}
