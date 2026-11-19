import { getDeck, indianDay, sectionIds } from '../edition-format.js';
import { topicName } from '../topics.js';
import { dates } from './catalog.js';
import { $, icon, node } from './dom.js';
import { istMinutes, istTime, longDate } from './format.js';
import { firstUnread, isRead, readCount, state } from './state.js';
import { minutes, topStories } from './story.js';

let handlers;
export const initHome = options => { handlers = options; };

function kicker(issue) {
  const latest = issue.date === dates[0];
  const kind = issue.publicationMode === 'late' ? 'Late edition' :
    !latest ? 'From the archive' : issue.date === indianDay() ? 'Today’s edition' : 'Latest edition';
  const stamp = issue.publishedAt ?? issue.preparedAt;
  if (!stamp || !Number.isFinite(Date.parse(stamp))) return kind;
  return kind + ' · ' + istTime(stamp) + ' IST';
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
      'Today’s edition arrives around 10 AM IST.';
  } else if (issue.publicationMode === 'late') {
    box.textContent = 'Published after the usual 10 AM target. Market figures show the time they were observed.';
  }
}

function storyRow(story) {
  const item = node('li');
  const row = node('button', 'story-row');
  row.type = 'button';
  row.dataset.key = story.key;
  row.append(node('span', 'story-headline', story.card.headline));
  if (story.card.verdict && (story.card.slot === 'pick' || story.card.slot === 'weekly')) {
    row.append(node('span', 'tag tag-' + story.card.verdict.toLowerCase(), story.card.verdict));
  }
  row.append(node('span', 'read-mark', ''));
  row.lastChild.append(icon('check'));
  row.addEventListener('click', () => handlers.onOpen(row, story.key));
  item.append(row);
  return item;
}

function topicSection(topic) {
  const section = node('section', 'topic');
  section.id = 'topic-' + topic;
  section.setAttribute('aria-labelledby', 'heading-' + topic);
  const head = node('div', 'topic-head');
  const title = node('h2', '', topicName(topic));
  title.id = 'heading-' + topic;
  head.append(title, node('span', 'topic-count'));
  if (topic === 'investing') {
    const link = node('a', 'text-button', 'Track record');
    link.href = '/track-record.html';
    head.append(link);
  }
  const list = node('ol', 'story-list');
  list.append(...state.order.filter(story => story.topic === topic).map(storyRow));
  section.append(head, list);
  return section;
}

function topList(issue) {
  const picks = topStories(issue, state.order);
  $('top-stories').hidden = !picks.length;
  $('top-title').textContent = issue.date === indianDay() ? 'Today’s top stories' : 'Top stories';
  $('top-list').replaceChildren(...picks.map(({story, line}) => {
    const item = node('li');
    const button = node('button', 'top-story');
    button.type = 'button';
    button.dataset.key = story.key;
    button.append(node('span', 'top-topic', topicName(story.topic)), node('span', 'top-headline', line ?? story.card.headline));
    button.addEventListener('click', () => handlers.onOpen(button, story.key));
    item.append(button);
    return item;
  }));
}

export function renderHome() {
  const issue = state.edition;
  const topics = sectionIds(issue);
  $('edition-kicker').textContent = kicker(issue);
  $('edition-date').textContent = longDate(issue.date);
  document.title = longDate(issue.date) + ' · Morning Edition';
  note(issue);
  topList(issue);
  $('sections').replaceChildren(...topics.map(topicSection));
  $('toc').replaceChildren(...topics.map(topic => {
    const item = node('li');
    const link = node('a');
    link.href = '#topic-' + topic;
    link.dataset.topic = topic;
    link.append(node('span', '', topicName(topic)), node('span', 'toc-count'));
    item.append(link);
    return item;
  }));
  updateHome();
}

// Refreshes read marks and counts without rebuilding the page.
export function updateHome() {
  const total = state.order.length;
  const read = readCount();
  const next = state.order[firstUnread()];
  const remaining = state.order.filter(story => !isRead(story));
  $('resume-label').textContent = !read ? 'Start reading' : next ? 'Continue · ' + topicName(next.topic) : 'All caught up';
  $('resume-meta').textContent = !read ? total + ' stories · about ' + minutes(state.order) + ' min' :
    next ? read + ' of ' + total + ' read · about ' + minutes(remaining) + ' min left' : 'Tap to read again';
  $('resume-fill').style.width = (total ? read / total * 100 : 0) + '%';
  $('resume').disabled = state.loading || !total;
  for (const row of document.querySelectorAll('.story-row, .top-story')) {
    row.classList.toggle('is-read', state.read.has(row.dataset.key));
  }
  for (const topic of sectionIds(state.edition)) {
    const count = readCount(topic);
    const length = getDeck(state.edition, topic).length;
    const text = count === length ? 'All read' : count ? count + ' of ' + length + ' read' : length + ' stories';
    const label = document.querySelector('#topic-' + topic + ' .topic-count');
    if (label) label.textContent = text;
    const toc = document.querySelector('#toc [data-topic="' + topic + '"] .toc-count');
    if (toc) toc.textContent = count === length ? '✓' : count + '/' + length;
  }
}
