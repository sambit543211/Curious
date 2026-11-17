import { readdir, readFile, writeFile } from 'node:fs/promises';
import { getDeck, isDay, isV2, sourceLink } from '../public/edition-format.js';

const positions = new Set(['pick','weekly']);
const closeDir = new URL('../public/market-closes/', import.meta.url);
const validPrice = price => Number.isFinite(price) && price > 0;
const change = (now, then) => validPrice(now) && validPrice(then) ? Number(((now / then - 1) * 100).toFixed(2)) : null;
const elapsed = (now, then) => (Date.parse(now) - Date.parse(then)) / 86400000;

export function closeValid(snapshot) {
  return isDay(snapshot?.date) && !!sourceLink(snapshot.equitiesSource) && !!sourceLink(snapshot.indicesSource) &&
    validPrice(snapshot.nifty50) && validPrice(snapshot.smallcap250) && snapshot.prices &&
    Object.entries(snapshot.prices).every(([symbol,price]) => /^[A-Z0-9&_-]+$/.test(symbol) && validPrice(price));
}

export async function readCloses() {
  const names = await readdir(closeDir).catch(error => {
    if (error.code === 'ENOENT') return [];
    throw error;
  });
  return Promise.all(names.filter(name => /^\d{4}-\d{2}-\d{2}\.json$/.test(name)).map(async name => {
    const close = JSON.parse(await readFile(new URL(name,closeDir),'utf8'));
    if (!closeValid(close) || close.date + '.json' !== name) throw new Error('Invalid NSE close in ' + name);
    return close;
  }));
}

export function makeLedger(editions, closes) {
  const dated = [...closes].sort((a,b) => a.date.localeCompare(b.date));
  const byDate = new Map(dated.map(row => [row.date,row]));
  const original = editions.filter(isV2).sort((a,b) => a.date.localeCompare(b.date)).flatMap(issue =>
    getDeck(issue,'investing').filter(card => positions.has(card.slot)).map(card => ({
      date:issue.date, symbol:card.symbol, verdict:card.verdict, buyBelow:card.buyBelow,
      reportPrice:card.price, dataDate:card.dataDate, id:card.id, thesis:card.thesis, status:'Active'
    })));
  const statusByPick = new Map();
  for (const edition of editions.filter(isV2).sort((a,b) => a.date.localeCompare(b.date))) {
    const notes = getDeck(edition, 'investing').find(card => card.slot === 'watchlist');
    for (const item of notes?.entries ?? []) {
      if (isDay(item.pickDate) && ['Thesis broken','Exited'].includes(item.status)) {
        const key = item.pickDate + ':' + item.symbol;
        if (!statusByPick.has(key)) statusByPick.set(key,{date:edition.date,status:item.status,reason:item.reason});
      }
    }
  }
  const rows = original.map(pick => {
    const baseline = byDate.get(pick.date);
    const event = statusByPick.get(pick.date + ':' + pick.symbol);
    const current = dated.findLast(close => close.date >= pick.date && (!event || close.date <= event.date) &&
      validPrice(close.prices[pick.symbol]));
    const priceAtPick = baseline?.prices[pick.symbol] ?? null;
    const currentPrice = current?.prices[pick.symbol] ?? null;
    const performance = change(currentPrice,priceAtPick);
    const nifty = performance === null ? null : change(current?.nifty50,baseline?.nifty50);
    const smallcap = performance === null ? null : change(current?.smallcap250,baseline?.smallcap250);
    return {...pick,status:event?.status ?? 'Active',statusReason:event?.reason ?? null, priceAtPick,currentPrice,
      asOf:current?.date ?? null, performance,nifty,smallcap,
      sources:[...new Set([baseline?.equitiesSource,baseline?.indicesSource,current?.equitiesSource,current?.indicesSource].filter(Boolean))]};
  });
  const measured = rows.filter(row => row.performance !== null && row.nifty !== null);
  const ranked = [...measured].sort((a,b) => b.performance - a.performance);
  const average = (values,field) => values.length ? Number((values.reduce((sum,row) => sum + row[field],0)/values.length).toFixed(2)) : null;
  const latestDate = dated.at(-1)?.date ?? null;
  const mature = measured.filter(row => latestDate && elapsed(latestDate,row.date) >= 183);
  return {latestDate, rows, summary:{
    measured:measured.length, average:average(measured,'performance'), nifty:average(measured,'nifty'),
    beating:measured.length ? Number((100 * measured.filter(row => row.performance > row.nifty).length / measured.length).toFixed(1)) : null,
    best:ranked[0]?.symbol ?? null, worst:ranked.at(-1)?.symbol ?? null,
    review:mature.length > 0 && average(mature,'performance') <= average(mature,'nifty')
  }};
}

export async function writeLedger(editions) {
  const ledger = makeLedger(editions, await readCloses());
  await writeFile(new URL('../public/picks-ledger.json',import.meta.url), JSON.stringify(ledger,null,2) + '\n');
}
