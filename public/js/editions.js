// The Editions tab: a month calendar of published editions and how far you got in each.
import { indianDay } from '../edition-format.js';
import { dates, loadEdition } from './catalog.js';
import { $, node } from './dom.js';
import { fullDate, monthName } from './format.js';
import { savedSummary } from './progress.js';
import { state } from './state.js';
import { minutes, readingOrder, topStories } from './story.js';
import { loadProgress } from './progress.js';

let month;
let selected;
let onOpen;
let detailVersion = 0;

function status(day) {
  if (day === state.edition?.date) return {read:state.read.size, total:state.order.length};
  return savedSummary(day);
}
const shift = (value, step) => {
  const date = new Date(value + '-01T12:00:00Z');
  date.setUTCMonth(date.getUTCMonth() + step);
  return date.toISOString().slice(0, 7);
};

async function detail() {
  const version = ++detailVersion;
  const card = $('day-card');
  card.hidden = !selected;
  if (!selected) return;
  const {read, total} = status(selected);
  $('day-date').textContent = fullDate(selected) + (selected === dates[0] ? ' · Latest' : '');
  $('day-headline').textContent = '';
  $('day-progress').textContent = total && read >= total ? 'All read' : read ? read + (total ? ' of ' + total : '') + ' read' : 'Not opened yet';
  $('day-open-label').textContent = total && read >= total ? 'Read again' : read ? 'Continue this edition' : 'Open this edition';
  try {
    const issue = await loadEdition(selected);
    if (version !== detailVersion) return;
    const order = readingOrder(issue);
    const top = topStories(issue, order)[0];
    $('day-headline').textContent = top?.line ?? top?.story.card.headline ?? '';
    const done = selected === state.edition?.date ? state.read : loadProgress(issue);
    const left = order.filter(story => !done.has(story.key));
    $('day-progress').textContent = !done.size ? order.length + ' stories · about ' + minutes(order) + ' min' :
      left.length ? done.size + ' of ' + order.length + ' read · about ' + minutes(left) + ' min left' : 'All read';
  } catch { /* Offline: keep the saved summary. */ }
}

export function renderEditions() {
  if (!dates.length) return;
  month ??= (state.edition?.date ?? dates[0]).slice(0, 7);
  selected ??= state.edition?.date ?? dates[0];
  $('month-name').textContent = monthName(month + '-01');
  $('month-prev').disabled = month <= dates.at(-1).slice(0, 7);
  $('month-next').disabled = month >= dates[0].slice(0, 7);
  const [year, monthIndex] = month.split('-').map(Number);
  const offset = (new Date(Date.UTC(year, monthIndex - 1, 1)).getUTCDay() + 6) % 7;
  const length = new Date(Date.UTC(year, monthIndex, 0)).getUTCDate();
  const today = indianDay();
  const cells = Array.from({length:offset}, () => node('span'));
  for (let dayNumber = 1; dayNumber <= length; dayNumber++) {
    const day = month + '-' + String(dayNumber).padStart(2, '0');
    const inner = node('span', 'day-inner', String(dayNumber));
    if (!dates.includes(day)) {
      const cell = node('span', 'day');
      cell.append(inner);
      cells.push(cell);
      continue;
    }
    const {read, total} = status(day);
    const state = total && read >= total ? 'done' : read ? 'started' : 'unopened';
    const cell = node('button', 'day is-' + state + (day === today ? ' is-today' : ''));
    cell.type = 'button';
    if (state === 'started') inner.style.setProperty('--fill', (total ? Math.round(read / total * 100) : 30) + '%');
    cell.setAttribute('aria-pressed', String(day === selected));
    cell.setAttribute('aria-label', fullDate(day) + ', ' + {done:'read', started:'started', unopened:'not opened'}[state]);
    cell.append(inner);
    cell.addEventListener('click', () => { selected = day; renderEditions(); });
    cells.push(cell);
  }
  $('calendar').replaceChildren(...cells);
  detail();
}

export function initEditions(settings) {
  onOpen = settings.onOpen;
  $('month-prev').addEventListener('click', () => { month = shift(month, -1); renderEditions(); });
  $('month-next').addEventListener('click', () => { month = shift(month, 1); renderEditions(); });
  $('day-open').addEventListener('click', () => onOpen(selected));
}
export function focusEdition(day) { selected = day; month = day.slice(0, 7); }
