// The Today tab: progress, markets, top stories and every topic.
import { getDeck, indianDay, sectionIds } from '../edition-format.js';
import { isPosition } from '../investment-rules.js';
import { topicById, topicName } from '../topics.js';
import { sourceLink } from '../edition-format.js';
import { dates } from './catalog.js';
import { $, icon, node } from './dom.js';
import { dayMonthLong, formatNumber, istMinutes, istTime, percent, rupees, trend, weekday } from './format.js';
import { firstUnread, isRead, readCount, state } from './state.js';
import { minutes, storyMeta, topStories } from './story.js';
import { marketStamp } from './story-view.js';
import { streakSummary } from './streak.js';

let handlers;
export const initHome = options => { handlers = options; };
const ringLength = 2 * Math.PI * 22;

function heroMeta(issue) {
  const parts = [issue.date === dates[0] ? dayMonthLong(issue.date) : 'From the archive · ' + dayMonthLong(issue.date)];
  const stamp = issue.publishedAt ?? issue.preparedAt;
  if (stamp && Number.isFinite(Date.parse(stamp))) parts.push(istTime(stamp));
  if (issue.publicationMode === 'late') parts.push('Late edition');
  return parts.join(' · ');
}

function note(issue) {
  const box = $('edition-note');
  box.replaceChildren();
  if (issue.date !== dates[0]) {
    const latest = node('button', 'text-button', 'Go to the latest edition');
    latest.type = 'button';
    latest.addEventListener('click', handlers.onLatest);
    box.append('You’re reading an older edition. ', latest);
  } else if (issue.date < indianDay()) {
    box.textContent = istMinutes() >= 600 ? 'Today’s edition isn’t out yet. This is the most recent one.' :
      'Today’s edition arrives around 10 AM.';
  }
}

const marketPicks = ['Nifty 50', 'Sensex', '₹/US$', 'Gold (₹/10 g)'];
const tileName = {'₹/US$':'₹ per US$', 'Gold (₹/10 g)':'Gold · 10 g'};
function markets(issue) {
  const deck = getDeck(issue, 'markets');
  const dash = deck[0]?.kind === 'dashboard' ? deck[0] : null;
  $('markets').hidden = !dash;
  if (!dash) return;
  $('markets-stamp').textContent = marketStamp(dash).replace('Opening snapshot · ', 'Opening · ');
  const key = state.order.find(story => story.topic === 'markets' && story.card.kind === 'dashboard')?.key;
  $('market-tiles').replaceChildren(...marketPicks.map(name => dash.rows.find(row => row.name === name)).filter(Boolean).map(row => {
    const tile = node('button', 'tile');
    tile.type = 'button';
    const value = row.name.startsWith('Gold') ? rupees(row.level) : formatNumber(row.level);
    const move = Number.isFinite(row.d1) && row.d1 !== 0 ? (row.d1 > 0 ? '▲ ' : '▼ ') + formatNumber(Math.abs(row.d1)) + '%' : percent(row.d1);
    tile.append(node('span', 'tile-name', tileName[row.name] ?? row.name), node('span', 'tile-value', value), node('span', 'tile-change ' + trend(row.d1), move));
    tile.setAttribute('aria-label', (tileName[row.name] ?? row.name) + ' ' + value + ', ' + move + '. Open the market snapshot.');
    tile.addEventListener('click', () => handlers.onOpen(tile, key));
    return tile;
  }));
}

// A story's cover: its licensed photo when the writer supplied one, otherwise artwork in the section's colour.
export function cover(story, className = 'cover') {
  const art = node('span', className);
  art.style.setProperty('--topic', topicById[story.topic]?.color ?? 'var(--accent)');
  const url = story.card.image?.url && sourceLink(story.card.image.url);
  if (url) {
    const img = node('img');
    img.src = url.href;
    img.alt = story.card.image.alt ?? '';
    img.loading = 'lazy';
    img.decoding = 'async';
    img.referrerPolicy = 'no-referrer';
    // A photo that fails to load falls back to the section artwork.
    img.addEventListener('error', () => { img.remove(); art.querySelector('.cover-credit')?.remove(); art.append(icon(story.topic, 'cover-mark')); });
    art.append(img);
    if (story.card.image.credit) art.append(node('small', 'cover-credit', story.card.image.credit));
  } else art.append(icon(story.topic, 'cover-mark'));
  return art;
}
const topicPill = topic => {
  const pill = node('span', 'topic-pill');
  pill.style.setProperty('--topic', topicById[topic]?.color ?? 'var(--accent)');
  pill.append(icon(topic), node('span', '', topicName(topic).replace('Stock Investing', 'Stocks')));
  return pill;
};

function topList(issue) {
  const picks = topStories(issue, state.order);
  $('top-stories').hidden = !picks.length;
  $('top-title').textContent = issue.date === indianDay() ? 'Today’s top stories' : 'Top stories';
  $('top-list').replaceChildren(...picks.map(({story, line}) => {
    const item = node('li');
    const button = node('button', 'top-story cover-card');
    button.type = 'button';
    button.dataset.key = story.key;
    const art = cover(story);
    art.append(topicPill(story.topic));
    if (story.card.keyNumber?.value) art.append(keyBadge(story.card.keyNumber, 'cover-key'));
    const meta = node('span', 'top-meta', topicName(story.topic) + ' · ' + storyMeta(story.card).split(' · ')[0]);
    button.append(art, node('span', 'top-headline', line ?? story.card.headline), meta);
    button.addEventListener('click', () => handlers.onOpen(button, story.key));
    item.append(button);
    return item;
  }));
}

// A story's headline figure, shown only when the writer marked one.
function keyBadge({value, label}, className = 'row-key') {
  const badge = node('span', className);
  badge.append(node('strong', '', value), node('small', '', label));
  return badge;
}

function storyRow(story, featured = false) {
  const item = node('li');
  const {card} = story;
  const pick = isPosition(card);
  const row = node('button', pick ? 'pick-row' : 'story-row' + (featured ? ' is-featured' : ''));
  row.type = 'button';
  row.dataset.key = story.key;
  const text = node('span', 'story-text');
  if (pick) {
    text.append(node('span', 'story-meta', [card.symbol, card.sector, card.slot === 'dip' ? '52-week low' : null, card.weekly ? 'Buy of the week' : null].filter(Boolean).join(' · ')), node('span', 'story-headline', card.headline));
    const side = node('span', 'pick-side');
    side.append(node('span', 'tag tag-' + card.verdict.toLowerCase(), card.verdict), node('span', '', 'below ' + rupees(Math.round(card.buyBelow))));
    row.append(text, side);
  } else {
    text.append(node('span', 'story-headline', card.headline), node('span', 'story-meta', storyMeta(card)));
    if (featured) {
      const art = cover(story, 'cover cover-band');
      if (card.keyNumber?.value) art.append(keyBadge(card.keyNumber, 'cover-key'));
      row.append(art);
    }
    row.append(text);
    const photo = !featured && card.image?.url;
    if (photo) row.append(cover(story, 'cover cover-thumb'));
    else if (card.keyNumber?.value && !featured) row.append(keyBadge(card.keyNumber));
    row.append(icon('done', 'check'));
  }
  row.addEventListener('click', () => handlers.onOpen(row, story.key));
  item.append(row);
  return item;
}

function topicSection(topic) {
  const section = node('section', 'topic');
  section.id = 'topic-' + topic;
  section.dataset.topic = topic;
  section.setAttribute('aria-labelledby', 'heading-' + topic);
  section.style.setProperty('--topic', topicById[topic]?.color ?? 'var(--accent)');
  const head = node('div', 'topic-head');
  head.append(icon(topic, 'topic-icon'));
  const title = node('h2', '', topicName(topic));
  title.id = 'heading-' + topic;
  const bar = node('span', 'bar');
  bar.append(node('span'));
  bar.setAttribute('aria-hidden', 'true');
  head.append(title, bar, node('span', 'topic-count'));
  const stories = state.order.filter(story => story.topic === topic);
  const picks = stories.filter(story => isPosition(story.card));
  const rest = stories.filter(story => !picks.includes(story));
  section.append(head);
  if (picks.length) {
    const list = node('ul', 'pick-list');
    list.append(...picks.map(storyRow));
    section.append(list);
  }
  const list = node('ol', 'story-list');
  list.append(...rest.map((story, index) => storyRow(story, index === 0 && !picks.length)));
  section.append(list);
  return section;
}

export function renderHome() {
  const issue = state.edition;
  const topics = sectionIds(issue);
  $('edition-meta').textContent = heroMeta(issue);
  $('today-title').textContent = weekday(issue.date);
  document.title = weekday(issue.date) + ' · Morning Edition';
  note(issue);
  markets(issue);
  topList(issue);
  $('sections').replaceChildren(...topics.map(topicSection));
  $('topic-bars').replaceChildren(...topics.map(topic => {
    const bar = node('span', 'bar');
    bar.dataset.topic = topic;
    bar.append(node('span'));
    return bar;
  }));
  $('chips').replaceChildren(...topics.map(topic => {
    const chip = node('button', 'chip');
    chip.append(icon(topic), node('span', '', topicName(topic).replace('Stock Investing', 'Stocks').replace('Indian Markets', 'Markets')));
    chip.style.setProperty('--topic', topicById[topic]?.color ?? 'var(--accent)');
    chip.type = 'button';
    chip.dataset.topic = topic;
    chip.addEventListener('click', () => {
      document.getElementById('topic-' + topic)?.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'});
    });
    return chip;
  }));
  updateHome();
}

// Refreshes read marks, counts and the Continue button without rebuilding the page.
export function updateHome() {
  if (!state.edition) return;
  const total = state.order.length;
  const read = readCount();
  const nextIndex = firstUnread();
  const next = state.order[nextIndex];
  const left = minutes(state.order.filter(story => !isRead(story)));
  const streak = streakSummary(dates).current;
  const streakText = streak > 1 ? ' · ' + streak + '-day streak' : '';

  $('ring-fill').setAttribute('stroke-dasharray', (total ? read / total * ringLength : 0) + ' ' + ringLength);
  $('progress-title').textContent = !read ? total + ' stories · about ' + minutes(state.order) + ' min' : next ? read + ' of ' + total + ' read' : 'All caught up';
  $('progress-sub').textContent = !read ? 'Start with the top stories' + streakText : next ? 'About ' + left + ' min left' + streakText : 'Every story read' + streakText;
  $('topbar-meta').textContent = read + '/' + total;

  const label = !read ? 'Start reading' : next ? 'Continue · ' + topicName(next.topic).replace('Stock Investing', 'Stocks') : 'All caught up';
  $('resume-label').textContent = label;
  $('resume-meta').textContent = next ? next.card.headline : 'Read again from the start';
  $('resume-inline-label').textContent = !read ? 'Start reading' : next ? 'Continue reading' : 'Read again';
  $('resume').disabled = state.loading || !total;
  $('resume-inline').disabled = state.loading || !total;

  for (const row of document.querySelectorAll('[data-key]')) row.classList.toggle('is-read', state.read.has(row.dataset.key));
  for (const story of document.querySelectorAll('.top-story')) {
    const meta = story.querySelector('.top-meta');
    const entry = state.order.find(item => item.key === story.dataset.key);
    if (!entry) continue;
    meta.replaceChildren(topicName(entry.topic) + ' · ' + (isRead(entry) ? 'Read' : storyMeta(entry.card).split(' · ')[0]));
    if (isRead(entry)) meta.append(icon('done', 'check'));
  }
  for (const topic of sectionIds(state.edition)) {
    const count = readCount(topic);
    const length = getDeck(state.edition, topic).length;
    const fill = (length ? count / length * 100 : 0) + '%';
    const section = document.getElementById('topic-' + topic);
    if (section) {
      section.querySelector('.bar > span').style.setProperty('--fill', fill);
      const counter = section.querySelector('.topic-count');
      counter.textContent = count === length ? 'All read' : count ? count + ' of ' + length : length + ' stories';
      counter.classList.toggle('is-done', count === length);
    }
    document.querySelector('#topic-bars [data-topic="' + topic + '"] > span')?.style.setProperty('--fill', fill);
    document.querySelector('#chips [data-topic="' + topic + '"]')?.classList.toggle('is-done', count === length);
  }
}
