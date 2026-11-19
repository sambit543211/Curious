import { dates } from './catalog.js';
import { $, icon, node } from './dom.js';
import { monthName, shortDate } from './format.js';
import { savedSummary } from './progress.js';
import { state } from './state.js';

function status(day) {
  if (day === state.edition?.date) {
    const read = state.read.size;
    return read === state.order.length ? 'Done' : read ? read + ' of ' + state.order.length + ' read' : day === dates[0] ? 'Latest' : '';
  }
  const {read, total} = savedSummary(day);
  if (total && read >= total) return 'Done';
  if (read) return read + (total ? ' of ' + total : '') + ' read';
  return day === dates[0] ? 'Latest' : '';
}

export function openArchive(onChoose) {
  const months = new Map();
  for (const day of dates) {
    const key = day.slice(0, 7);
    if (!months.has(key)) months.set(key, []);
    months.get(key).push(day);
  }
  $('archive-message').textContent = '';
  $('archive-list').replaceChildren(...[...months.values()].map(days => {
    const group = node('section', 'archive-month');
    group.append(node('h3', '', monthName(days[0])));
    const list = node('ul');
    for (const day of days) {
      const item = node('li');
      const row = node('button', 'archive-row');
      row.type = 'button';
      if (day === state.edition?.date) row.setAttribute('aria-current', 'date');
      row.append(node('span', 'archive-date', shortDate(day)), node('span', 'archive-status', status(day)), icon('right'));
      row.addEventListener('click', () => onChoose(day));
      item.append(row);
      list.append(item);
    }
    group.append(list);
    return group;
  }));
  $('archive').showModal();
}
