import { researchFooter } from './investment-rules.js';

const $ = id => document.getElementById(id);
const headings = [
  ['date','Date picked'],['symbol','NSE symbol'],['verdict','Verdict'],['buyBelow','Buy below'],
  ['baselineDate','Baseline date'],['priceAtPick','Baseline close'],['currentPrice','Latest close'],['performance','Return'],
  ['nifty','Nifty 50'],['smallcap','Smallcap 250'],['status','Status']
];
const number = new Intl.NumberFormat('en-IN',{maximumFractionDigits:2});
const percentage = value => Number.isFinite(value) ? number.format(value) + '%' : '—';
const price = value => Number.isFinite(value) ? '₹' + number.format(value) : '—';
const view = (tag,label) => { const node = document.createElement(tag); node.textContent = label; return node; };
const caps = new Set(['buyBelow','priceAtPick','currentPrice']);
const returns = new Set(['performance','nifty','smallcap']);
let sort = 'date';
let direction = -1;

function draw(ledger) {
  const comparison = (a,b) => a[sort] == null ? (b[sort] == null ? 0 : 1) : b[sort] == null ? -1 : direction *
    (typeof a[sort] === 'number' ? a[sort] - b[sort] : String(a[sort]).localeCompare(String(b[sort])));
  const header = view('tr','');
  for (const [key,label] of headings) {
    const column = view('th','');
    column.scope = 'col';
    if (key === sort) column.setAttribute('aria-sort',direction === 1 ? 'ascending' : 'descending');
    const button = view('button',label);
    button.type = 'button';
    button.addEventListener('click',() => {
      direction = sort === key ? -direction : 1;
      sort = key;
      draw(ledger);
      $('track-columns').querySelector('[aria-sort] button')?.focus();
    });
    column.append(button);
    header.append(column);
  }
  $('track-columns').replaceChildren(header);
  const rows = [...ledger.rows].sort(comparison).map(pick => {
    const row = view('tr','');
    for (const [key] of headings) {
      const value = pick[key];
      const cell = view(key === 'symbol' ? 'th' : 'td', caps.has(key) ? price(value) :
        returns.has(key) ? percentage(value) : String(value ?? '—'));
      if (key === 'symbol') cell.scope = 'row';
      if (returns.has(key) && value) cell.className = value > 0 ? 'positive' : 'negative';
      if (key === 'currentPrice' && pick.asOf) {
        cell.append(view('div',pick.asOf));
        const report = pick.sources.findLast(url => url.endsWith('.zip'));
        if (report) {
          const link = view('a','NSE close file');
          link.href = report;
          link.target = '_blank';
          link.rel = 'noopener noreferrer';
          cell.append(link);
        }
      }
      if (key === 'status' && pick.statusReason) cell.append(view('div',pick.statusReason));
      row.append(cell);
    }
    return row;
  });
  $('track-rows').replaceChildren(...rows);
}
fetch('/picks-ledger.json',{cache:'no-cache'}).then(res => {
  if (!res.ok) throw new Error('Ledger unavailable');
  return res.json();
}).then(ledger => {
  const {summary,rows} = ledger;
  if (!rows.length) {
    $('track-status').textContent = 'No screened picks have been published yet.';
    return;
  }
  $('track-summary').hidden = false;
  $('track-summary').append(
    view('span','Average return ' + percentage(summary.average)),
    view('span','Nifty 50 ' + percentage(summary.nifty)),
    view('span','Beat Nifty ' + percentage(summary.beating)),
    view('span','Best ' + (summary.best ?? '—')),
    view('span','Worst ' + (summary.worst ?? '—'))
  );
  if (summary.review) $('track-summary').append(view('p','The six-month cohort has not outperformed the Nifty 50. Review the screen.'));
  $('track-status').textContent = rows.length + ' picks · ' + summary.measured + ' with matched closes';
  $('track-scroll').hidden = false;
  $('track-method').hidden = false;
  $('track-method').append(view('p',researchFooter));
  draw(ledger);
}).catch(() => { $('track-status').textContent = 'Track Record is temporarily unavailable.'; });
