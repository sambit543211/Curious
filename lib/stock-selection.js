import { getDeck, isDay, isV2, nonEmpty, sourceLink, validSources } from '../public/edition-format.js';
import { dipCheck, dipRules, evaluatePick, positionSlots } from '../public/investment-rules.js';

// Daily stock selection. Code chooses the stocks; the writer only explains them.
//   Cards 1-2 ("dip"): pass the quality screen, trade near their 52-week low, and are not value traps.
//   Cards 3-5 ("pick"): pass the quality screen and rank best on quality + value.
// Every chosen stock has a Buy or Wait verdict, one stock per sector across all five cards,
// and a stock shown in the last 14 days only returns when its verdict changed or it crossed its buy-below price.

export const DIP_SLOTS = 2;
export const PICK_SLOTS = 3;
export const REPEAT_WINDOW_DAYS = 14;

const canonical = text => (String(text ?? '').toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []).join(' ');
const sourceUrls = sources => new Set((sources ?? []).map(source => source.url));
const evidenceValid = (e, date) => isDay(e?.asOf) && e.asOf <= date && !!sourceLink(e.url);
const median = values => {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};
const round1 = n => Math.round(n * 10) / 10;

export function hasEvidence(stock, date) {
  return !!stock && nonEmpty(stock.symbol) && nonEmpty(stock.sector) &&
    isDay(stock.dataDate) && stock.dataDate <= date && validSources(stock.sources) &&
    isDay(stock.quoteDate) && stock.quoteDate <= date &&
    ['divYield', 'promoterHolding'].every(key => Number.isFinite(stock.metrics?.[key])) &&
    ['price', ...Object.keys(stock.metrics ?? {}).filter(key => Number.isFinite(stock.metrics[key]))].every(key =>
      evidenceValid(stock.metricSources?.[key], date) && sourceUrls(stock.sources).has(stock.metricSources[key].url));
}

// Last appearance of each symbol as a stock position in editions before `date`, within the repeat window.
export function recentAppearances(history, date, days = REPEAT_WINDOW_DAYS) {
  const cutoff = new Date(Date.parse(date + 'T12:00:00Z') - days * 86400000).toISOString().slice(0, 10);
  const seen = new Map();
  for (const issue of [...history].filter(isV2).sort((a, b) => a.date.localeCompare(b.date))) {
    if (issue.date >= date || issue.date < cutoff) continue;
    for (const card of getDeck(issue, 'investing')) {
      if (!positionSlots.includes(card.slot) || !card.symbol) continue;
      seen.set(card.symbol, {date:issue.date, verdict:card.verdict, price:card.price, buyBelow:card.buyBelow});
    }
  }
  return seen;
}

export function repeatStatus(stock, last) {
  if (!last) return {allowed:true, repeat:null};
  if (stock.verdict !== last.verdict) return {allowed:true, repeat:{lastDate:last.date, reason:'Verdict changed from ' + last.verdict + ' to ' + stock.verdict}};
  if (Number.isFinite(last.price) && Number.isFinite(last.buyBelow) && last.price > last.buyBelow && stock.price <= stock.buyBelow) {
    return {allowed:true, repeat:{lastDate:last.date, reason:'Price fell below the buy-below level'}};
  }
  return {allowed:false, repeat:null};
}

// Percentile rank (0-1) of each value among candidates; higher is better unless `lowerIsBetter`.
function percentiles(values, lowerIsBetter = false) {
  const finite = values.filter(Number.isFinite);
  return values.map(value => {
    if (!Number.isFinite(value) || finite.length < 2) return Number.isFinite(value) ? 0.5 : null;
    const better = finite.filter(other => lowerIsBetter ? other > value : other < value).length;
    const ties = finite.filter(other => other === value).length - 1;
    return (better + ties / 2) / (finite.length - 1);
  });
}

export function qualityScores(stocks) {
  const finance = stock => stock.kind === 'bank' || stock.kind === 'nbfc';
  const returns = percentiles(stocks.map(s => finance(s) ? s.metrics.roa * 12.5 : s.metrics.roce5y));
  const growth = percentiles(stocks.map(s => s.metrics.profitCagr5y));
  const value = percentiles(stocks.map(s => s.price / s.fairValue), true);
  return stocks.map((stock, i) => {
    const parts = [returns[i], growth[i], value[i]].filter(Number.isFinite);
    return Math.round(parts.reduce((sum, n) => sum + n, 0) / parts.length * 1000) / 1000;
  });
}

export function selectStocks(rows, date, history = []) {
  if (!Array.isArray(rows) || !isDay(date)) throw new Error('A dated fundamentals export is required');
  const sectorDrop = new Map();
  for (const stock of rows) {
    const high = stock?.metrics?.high52;
    if (!nonEmpty(stock?.sector) || !(stock.price > 0) || !(high > 0)) continue;
    const key = canonical(stock.sector);
    sectorDrop.set(key, [...(sectorDrop.get(key) ?? []), {symbol:stock.symbol, drop:(stock.price / high - 1) * 100}]);
  }
  const recent = recentAppearances(history, date);
  const counts = {universe:rows.length, verified:0, passed:0, buyOrWait:0, heldBack:0, dipEligible:0};
  const candidates = [];
  for (const stock of rows) {
    if (!hasEvidence(stock, date)) continue;
    counts.verified++;
    const evaluated = {...stock, ...evaluatePick(stock)};
    if (!evaluated.pass) continue;
    counts.passed++;
    if (evaluated.verdict === 'Avoid') continue;
    counts.buyOrWait++;
    const {allowed, repeat} = repeatStatus(evaluated, recent.get(stock.symbol));
    if (!allowed) { counts.heldBack++; continue; }
    candidates.push(repeat ? {...evaluated, repeat} : evaluated);
  }
  const byValue = (a, b) => a.price / a.fairValue - b.price / b.fairValue || a.symbol.localeCompare(b.symbol);
  const sectors = new Set();
  const take = (list, size) => {
    const chosen = [];
    for (const stock of list) {
      const sector = canonical(stock.sector);
      if (chosen.length >= size || sectors.has(sector)) continue;
      sectors.add(sector);
      chosen.push(stock);
    }
    return chosen;
  };
  const dipPool = candidates.map(stock => {
    const check = dipCheck(stock);
    if (!check.pass) return null;
    // Compare with the other stocks in its sector; with fewer than two peers the comparison is not made.
    const peers = (sectorDrop.get(canonical(stock.sector)) ?? []).filter(peer => peer.symbol !== stock.symbol).map(peer => peer.drop);
    const sectorFromHigh = peers.length >= 2 ? median(peers) : null;
    return {...stock, dip:{fromHigh:check.fromHigh, fromLow:check.fromLow, peers:peers.length,
      sectorFromHigh:sectorFromHigh === null ? null : round1(sectorFromHigh),
      fall:sectorFromHigh === null ? 'no-peers' : sectorFromHigh <= -dipRules.sectorWide ? 'sector-wide' : 'stock-specific'}};
  }).filter(Boolean).sort(byValue);
  counts.dipEligible = dipPool.length;
  const dips = take(dipPool, DIP_SLOTS).map(stock => ({...stock, group:'dip'}));
  const chosenDips = new Set(dips.map(stock => stock.symbol));
  const rest = candidates.filter(stock => !chosenDips.has(stock.symbol));
  const scores = qualityScores(rest);
  const ranked = rest.map((stock, i) => ({...stock, score:scores[i]}))
    .sort((a, b) => b.score - a.score || byValue(a, b));
  const picks = take(ranked, PICK_SLOTS).map(stock => ({...stock, group:'pick'}));
  const shortfall = {
    dip:dips.length < DIP_SLOTS ? 'Only ' + dips.length + ' of ' + counts.verified + ' verified stocks met the quality screen and the 52-week-low rules on the latest session.' : null,
    pick:picks.length < PICK_SLOTS ? 'Only ' + picks.length + ' further stocks passed the quality screen with a Buy or Wait verdict and no recent repeat.' : null
  };
  return {dips, picks, counts, shortfall};
}
