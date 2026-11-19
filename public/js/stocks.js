// The Stocks tab: this edition's research and the track record of earlier picks.
import { researchFooter } from '../investment-rules.js';
import { $, node } from './dom.js';
import { dayAndMonth, percent, rupees, trend } from './format.js';
import { state } from './state.js';
import { storyMeta } from './story.js';

let positions = [];
let ledgerRequested = false;
let onOpen;

const sorters = {
  date:(a, b) => b.date.localeCompare(a.date),
  best:(a, b) => (b.performance ?? -Infinity) - (a.performance ?? -Infinity),
  worst:(a, b) => (a.performance ?? Infinity) - (b.performance ?? Infinity),
  symbol:(a, b) => a.symbol.localeCompare(b.symbol)
};

export function renderPicks() {
  const stories = state.order.filter(story => story.topic === 'investing');
  $('picks-empty').hidden = stories.length > 0;
  $('stock-picks').replaceChildren(...stories.map(story => {
    const {card} = story;
    const item = node('li');
    const row = node('button', 'pick-row' + (state.read.has(story.key) ? ' is-read' : ''));
    row.type = 'button';
    const text = node('span', 'story-text');
    const pick = card.verdict && (card.slot === 'pick' || card.slot === 'weekly');
    text.append(node('span', 'story-meta', pick ? [card.symbol, card.sector].filter(Boolean).join(' · ') : storyMeta(card)),
      node('span', 'story-headline', card.headline));
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
  const days = pick.pickDates ?? [pick.date];
  const picked = 'Picked ' + dayAndMonth(days[0]) + (days.length > 1 ? ' · again ' + days.slice(1).map(dayAndMonth).join(', ') : '');
  const facts = node('dl', 'facts');
  for (const [term, value] of [
    ['Buy below', rupees(pick.latestBuyBelow ?? pick.buyBelow)],
    ['Starting close', pick.baselineDate ? rupees(pick.priceAtPick) + ' (' + dayAndMonth(pick.baselineDate) + ')' : 'Next verified close'],
    ['Latest close', pick.asOf ? rupees(pick.currentPrice) + ' (' + dayAndMonth(pick.asOf) + ')' : '—'],
    ['Nifty 50, same period', percent(pick.nifty)]
  ]) facts.append(node('dt', '', term), node('dd', '', value));
  item.append(head, node('p', 'position-dates', picked), facts);
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
  $('positions').replaceChildren(...[...positions].sort(sorters[$('sort').value]).map(position));
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
    drawPositions();
  } catch {
    ledgerRequested = false;
    $('track-status').textContent = 'The track record is unavailable right now. Try again when you’re online.';
  }
}

export function renderStocks() {
  renderPicks();
  loadTrack();
}
export function initStocks(settings) {
  onOpen = settings.onOpen;
  $('stock-disclaimer').textContent = researchFooter;
  $('sort').addEventListener('change', drawPositions);
}
