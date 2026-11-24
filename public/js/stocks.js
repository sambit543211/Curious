// The Stocks tab: filters (verdict, company size, sector), this edition's research and every stock picked so far.
import { isPosition, researchFooter, sizeOf } from '../investment-rules.js';
import { $, node } from './dom.js';
import { dayAndMonth, formatNumber, percent, rupees, trend } from './format.js';
import { state } from './state.js';
import { storyMeta } from './story.js';

let positions = [];
let ledgerRequested = false;
let onOpen;
const filter = {verdict:'', size:'', sector:''};

// How cheap a stock is against its own usual valuation (below 1 is cheaper than normal).
const cheapness = metrics => {
  const m = metrics ?? {};
  return Number.isFinite(m.pe) && m.peMedian5y > 0 ? m.pe / m.peMedian5y : Number.isFinite(m.pb) && m.pbMedian5y > 0 ? m.pb / m.pbMedian5y : Infinity;
};
const sorters = {
  date:(a, b) => b.date.localeCompare(a.date),
  best:(a, b) => (b.performance ?? -Infinity) - (a.performance ?? -Infinity),
  worst:(a, b) => (a.performance ?? Infinity) - (b.performance ?? Infinity),
  symbol:(a, b) => a.symbol.localeCompare(b.symbol),
  sector:(a, b) => (a.sector ?? '~').localeCompare(b.sector ?? '~') || a.symbol.localeCompare(b.symbol),
  cheap:(a, b) => cheapness(a.metrics) - cheapness(b.metrics)
};

// One shape for a stock whether it comes from today's edition or the ledger.
const fromCard = card => ({verdict:card.verdict, sector:card.sector ?? null, metrics:card.metrics ?? {}});
const fromPosition = pick => ({verdict:pick.latestVerdict ?? pick.verdict, sector:pick.sector ?? null, metrics:pick.metrics ?? {}});
const matches = stock => (!filter.verdict || stock.verdict === filter.verdict) &&
  (!filter.size || sizeOf(stock.metrics.marketCap) === filter.size) && (!filter.sector || stock.sector === filter.sector);

// Small labels under a stock: size class and its headline numbers.
function tags(stock) {
  const m = stock.metrics;
  const box = node('span', 'stock-tags');
  const size = sizeOf(m.marketCap);
  if (size) box.append(node('span', 'size', size + ' cap'));
  if (Number.isFinite(m.pe)) box.append(node('span', '', 'P/E ' + formatNumber(Math.round(m.pe)) + (Number.isFinite(m.peMedian5y) ? ' · usual ' + formatNumber(Math.round(m.peMedian5y)) : '')));
  else if (Number.isFinite(m.pb)) box.append(node('span', '', 'P/B ' + formatNumber(m.pb)));
  if (Number.isFinite(m.roce5y)) box.append(node('span', '', 'ROCE ' + formatNumber(Math.round(m.roce5y)) + '%'));
  else if (Number.isFinite(m.roa)) box.append(node('span', '', 'ROA ' + formatNumber(m.roa) + '%'));
  if (Number.isFinite(m.salesCagr5y)) box.append(node('span', '', 'Sales +' + formatNumber(Math.round(m.salesCagr5y)) + '%/yr'));
  if (Number.isFinite(m.de)) box.append(node('span', '', 'Debt ' + (m.de < 0.1 ? 'almost none' : formatNumber(Math.round(m.de * 100) / 100) + '×')));
  return box;
}

function chips(rowId, key, options) {
  const row = $(rowId);
  row.querySelectorAll('.chip').forEach(chip => chip.remove());
  row.append(...[['', 'All'], ...options].map(([value, label]) => {
    const chip = node('button', 'chip', label);
    chip.type = 'button';
    chip.setAttribute('aria-pressed', String(filter[key] === value));
    if (filter[key] === value) chip.setAttribute('aria-current', 'true');
    chip.addEventListener('click', () => { filter[key] = value; draw(); });
    return chip;
  }));
}

function drawFilters() {
  const all = [...state.order.filter(story => isPosition(story.card)).map(story => fromCard(story.card)), ...positions.map(fromPosition)];
  const verdicts = ['Buy', 'Wait', 'Avoid'].filter(verdict => all.some(stock => stock.verdict === verdict));
  chips('filter-verdict', 'verdict', verdicts.map(verdict => [verdict, verdict]));
  chips('filter-size', 'size', ['Large', 'Mid', 'Small'].filter(size => all.some(stock => sizeOf(stock.metrics.marketCap) === size)).map(size => [size, size]));
  const sectors = [...new Set(all.map(stock => stock.sector).filter(Boolean))].sort();
  if (filter.sector && !sectors.includes(filter.sector)) filter.sector = '';
  const select = $('filter-sector');
  select.replaceChildren(new Option('All sectors', ''), ...sectors.map(sector => new Option(sector + ' (' + all.filter(stock => stock.sector === sector).length + ')', sector)));
  select.value = filter.sector;
}

export function renderPicks() {
  const stories = state.order.filter(story => story.topic === 'investing');
  const active = filter.verdict || filter.size || filter.sector;
  const shown = stories.filter(story => isPosition(story.card) ? matches(fromCard(story.card)) : !active);
  $('picks-empty').hidden = shown.length > 0;
  $('picks-empty').textContent = stories.length ? 'No stock in this edition matches these filters.' : 'This edition has no stock research.';
  $('stock-picks').replaceChildren(...shown.map(story => {
    const {card} = story;
    const item = node('li');
    const row = node('button', 'pick-row' + (state.read.has(story.key) ? ' is-read' : ''));
    row.type = 'button';
    const text = node('span', 'story-text');
    const pick = isPosition(card);
    text.append(node('span', 'story-meta', pick ? [card.symbol, card.sector, card.slot === 'dip' ? '52-week low' : null, card.weekly ? 'Buy of the week' : null].filter(Boolean).join(' · ') : storyMeta(card)),
      node('span', 'story-headline', card.headline));
    if (pick) text.append(tags(fromCard(card)));
    row.append(text);
    if (pick) {
      const side = node('span', 'pick-side');
      side.append(node('span', 'tag tag-' + card.verdict.toLowerCase(), card.verdict), node('span', '', 'below ' + rupees(Math.round(card.buyBelow))));
      row.append(side);
    }
    row.addEventListener('click', () => onOpen(row, story.key));
    item.append(row);
    return item;
  }));
}

function position(pick) {
  const item = node('li', 'position');
  const head = node('div', 'position-head');
  const verdict = pick.latestVerdict ?? pick.verdict;
  head.append(node('h3', '', pick.symbol), node('span', 'tag tag-' + String(verdict).toLowerCase(), verdict));
  const measured = Number.isFinite(pick.performance);
  head.append(node('span', 'position-return ' + (measured ? trend(pick.performance) : 'pending'), measured ? percent(pick.performance) : 'Awaiting close'));
  item.append(head);
  if (pick.sector) item.append(node('span', 'position-sector', pick.sector));
  item.append(tags(fromPosition(pick)));
  const days = pick.pickDates ?? [pick.date];
  const picked = 'Picked ' + dayAndMonth(days[0]) + (days.length > 1 ? ' · again ' + days.slice(1).map(dayAndMonth).join(', ') : '');
  const facts = node('dl', 'facts');
  for (const [term, value] of [
    ['Buy below', rupees(pick.latestBuyBelow ?? pick.buyBelow)],
    ['Starting close', pick.baselineDate ? rupees(pick.priceAtPick) + ' (' + dayAndMonth(pick.baselineDate) + ')' : 'Next verified close'],
    ['Latest close', pick.asOf ? rupees(pick.currentPrice) + ' (' + dayAndMonth(pick.asOf) + ')' : '—'],
    ['Nifty 50, same period', percent(pick.nifty)]
  ]) facts.append(node('dt', '', term), node('dd', '', value));
  item.append(node('p', 'position-dates', picked), facts);
  if (pick.status && pick.status !== 'Active') item.append(node('p', 'fine', pick.status + (pick.statusReason ? ' · ' + pick.statusReason : '')));
  const report = pick.sources?.findLast(url => url.endsWith('.zip'));
  if (report) {
    const note = node('p', 'fine');
    const link = node('a', '', 'NSE closing-price file');
    link.href = report;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    note.append(link);
    item.append(note);
  }
  return item;
}

function drawPositions() {
  const shown = positions.filter(pick => matches(fromPosition(pick)));
  $('positions').replaceChildren(...shown.sort(sorters[$('sort').value]).map(position));
  const active = filter.verdict || filter.size || filter.sector;
  $('filter-count').textContent = positions.length ? (active ? shown.length + ' of ' + positions.length : positions.length + ' stocks') : '';
  if (positions.length && !shown.length) {
    $('positions').append(node('li', 'empty', 'No earlier pick matches these filters.'));
  }
}

function draw() {
  drawFilters();
  renderPicks();
  drawPositions();
}

async function loadTrack() {
  if (ledgerRequested) return;
  ledgerRequested = true;
  try {
    const response = await fetch('/picks-ledger.json', {cache:'no-cache'});
    if (!response.ok) throw new Error('Ledger unavailable');
    const ledger = await response.json();
    positions = ledger.positions ?? ledger.rows ?? [];
    const {summary} = ledger;
    if (!positions.length) {
      $('track-status').textContent = 'No screened picks have been published yet.';
      return;
    }
    if (summary.measured) {
      $('stats').replaceChildren(...[
        ['Average return', percent(summary.average), trend(summary.average)],
        ['Nifty 50', percent(summary.nifty), trend(summary.nifty)],
        ['Beat the Nifty', Number.isFinite(summary.beating) ? summary.beating + '%' : '—', '']
      ].map(([label, value, tone]) => {
        const box = node('div', 'stat');
        box.append(node('span', 'stat-name', label), node('span', 'stat-value ' + tone, value));
        return box;
      }));
      $('stats').hidden = false;
    }
    $('track-status').textContent = summary.review ? 'Picks older than six months have not beaten the Nifty 50. The screen needs review.' :
      'Returns appear once each pick has a verified NSE closing price to measure from.';
    $('track-status').hidden = summary.measured > 0 && !summary.review;
    draw();
  } catch {
    ledgerRequested = false;
    $('track-status').textContent = 'The track record is unavailable right now. Try again when you’re online.';
  }
}

export function renderStocks() {
  draw();
  loadTrack();
}
export function initStocks(settings) {
  onOpen = settings.onOpen;
  $('stock-disclaimer').textContent = researchFooter;
  $('sort').addEventListener('change', drawPositions);
  $('filter-sector').addEventListener('change', event => { filter.sector = event.target.value; draw(); });
}
