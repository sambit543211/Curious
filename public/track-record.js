import { researchFooter } from './investment-rules.js';
import { $, hydrateIcons, node } from './js/dom.js';
import { dayAndMonth, percent, rupees, trend } from './js/format.js';

hydrateIcons();
$('disclaimer').textContent = researchFooter;
let positions = [];

const sorters = {
  date:(a, b) => b.date.localeCompare(a.date),
  best:(a, b) => (b.performance ?? -Infinity) - (a.performance ?? -Infinity),
  worst:(a, b) => (a.performance ?? Infinity) - (b.performance ?? Infinity),
  symbol:(a, b) => a.symbol.localeCompare(b.symbol)
};

function card(pick) {
  const item = node('li', 'position');
  const head = node('div', 'position-head');
  const verdict = pick.latestVerdict ?? pick.verdict;
  head.append(node('h3', '', pick.symbol), node('span', 'tag tag-' + String(verdict).toLowerCase(), verdict));
  const measured = Number.isFinite(pick.performance);
  head.append(node('span', 'position-return ' + (measured ? trend(pick.performance) : 'pending'),
    measured ? percent(pick.performance) : 'Awaiting close'));
  const dates = pick.pickDates ?? [pick.date];
  const picked = 'Picked ' + dayAndMonth(dates[0]) + (dates.length > 1 ? ' · picked again ' + dates.slice(1).map(dayAndMonth).join(', ') : '');
  const facts = node('dl', 'facts');
  for (const [term, value] of [
    ['Buy below', rupees(pick.latestBuyBelow ?? pick.buyBelow)],
    ['Starting close', pick.baselineDate ? rupees(pick.priceAtPick) + ' (' + dayAndMonth(pick.baselineDate) + ')' : 'Next verified close'],
    ['Latest close', pick.asOf ? rupees(pick.currentPrice) + ' (' + dayAndMonth(pick.asOf) + ')' : '—'],
    ['Nifty 50, same period', percent(pick.nifty)]
  ]) facts.append(node('dt', '', term), node('dd', '', value));
  item.append(head, node('p', 'position-dates', picked), facts);
  if (pick.status && pick.status !== 'Active') item.append(node('p', 'position-note', pick.status + (pick.statusReason ? ' · ' + pick.statusReason : '')));
  const report = pick.sources?.findLast(url => url.endsWith('.zip'));
  if (report) {
    const note = node('p', 'position-note');
    const link = node('a', '', 'NSE closing-price file');
    link.href = report;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    note.append(link);
    item.append(note);
  }
  return item;
}

function draw() {
  $('positions').replaceChildren(...[...positions].sort(sorters[$('sort').value]).map(card));
}

function stats(summary) {
  if (!summary.measured) return false;
  $('stats').append(...[
    ['Average return', percent(summary.average), trend(summary.average)],
    ['Nifty 50', percent(summary.nifty), trend(summary.nifty)],
    ['Beat the Nifty', Number.isFinite(summary.beating) ? summary.beating + '%' : '—', '']
  ].map(([label, value, tone]) => {
    const box = node('div', 'stat');
    box.append(node('span', '', label), node('strong', tone, value));
    return box;
  }));
  return true;
}

fetch('/picks-ledger.json', {cache:'no-cache'}).then(response => {
  if (!response.ok) throw new Error('Ledger unavailable');
  return response.json();
}).then(ledger => {
  positions = ledger.positions ?? ledger.rows;
  if (!positions.length) {
    $('track-status').textContent = 'No screened picks have been published yet.';
    return;
  }
  const {summary} = ledger;
  $('stats').hidden = !stats(summary);
  $('track-status').hidden = !$('stats').hidden;
  $('track-status').textContent = 'Returns appear once each pick has a verified NSE closing price to measure from.';
  if (summary.review) $('track-status').hidden = false, $('track-status').textContent = 'Picks older than six months have not beaten the Nifty 50. The screen needs review.';
  $('positions-title').textContent = positions.length + (positions.length === 1 ? ' pick' : ' picks');
  $('track-bar').hidden = false;
  $('sort').addEventListener('change', draw);
  draw();
}).catch(() => { $('track-status').textContent = 'The track record is unavailable right now. Try again later.'; });
