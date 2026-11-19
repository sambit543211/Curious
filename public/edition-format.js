import { topicIds } from './topics.js';

export { topicIds };
export const stockTopic = 'investing';
// Topics every original (pre-v2) edition carries.
export const baseTopics = topicIds.filter(id => id !== stockTopic);

const ist = new Intl.DateTimeFormat('en-IN', {
  timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit'
});

export function indianDay(date = new Date()) {
  const parts = Object.fromEntries(ist.formatToParts(date).map(part => [part.type, part.value]));
  return [parts.year, parts.month, parts.day].join('-');
}

export function isDay(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const day = new Date(value + 'T00:00:00Z');
  return Number.isFinite(day.getTime()) && day.toISOString().slice(0, 10) === value;
}

export const isV2 = issue => issue?.version === 2 || Array.isArray(issue?.top3);
export const isSunday = day => isDay(day) && new Date(day + 'T00:00:00Z').getUTCDay() === 0;
export const sectionIds = issue => topicIds.filter(topic => getDeck(issue, topic).length);

export function getDeck(issue, topic) {
  const sections = issue?.sections;
  const value = sections?.[topic] ?? (topic === 'mind' ? sections?.psychology : undefined);
  if (Array.isArray(value)) return value;
  if (topic === 'markets' && value?.dashboard && Array.isArray(value.cards)) {
    const dashboard = value.dashboard;
    return [{...dashboard, id:dashboard.id ?? 'markets-dashboard', label:dashboard.label ?? 'Market snapshot',
      headline:dashboard.headline ?? 'Indian markets at a glance', kind:'dashboard'}, ...value.cards];
  }
  return [];
}

export function isEdition(value) {
  if (!isDay(value?.date) || !value.sections || typeof value.sections !== 'object') return false;
  if (isV2(value)) return Array.isArray(value.top3) && value.top3.length === 3 &&
    topicIds.every(topic => {
      const deck = getDeck(value, topic);
      if (topic === 'markets' && isSunday(value.date)) return deck.length === 0;
      return deck.length === 5 && deck.every(card => nonEmpty(card?.id) &&
        nonEmpty(card.headline) && nonEmpty(card.summary) && validSources(card.sources));
    });
  return topicIds.every(id => {
    const deck = value.sections[id];
    if ((id === 'marketing' || id === stockTopic) && deck === undefined) return true;
    const required = ['label','headline','summary','context','source','sourceUrl'];
    if (id === stockTopic) required.push('id', 'why', 'valuation', 'risk');
    return Array.isArray(deck) && deck.length === 5 && deck.every(card =>
      required.every(key => nonEmpty(card?.[key])) &&
      (card.sources === undefined || validSources(card.sources))
    );
  });
}

export const nonEmpty = value => typeof value === 'string' && value.trim().length > 0;
export const validSources = sources => Array.isArray(sources) && sources.length > 0 &&
  sources.every(source => nonEmpty(source?.label) && sourceLink(source.url));

export function sourceLink(value) {
  try {
    const url = new URL(value);
    if (url.protocol === 'https:' && !url.username && !url.password) return url;
  } catch { /* A malformed URL has no link. */ }
  return null;
}

function canonicalSource(value) {
  const url = sourceLink(value);
  if (!url) return '';
  url.hash = '';
  for (const key of [...url.searchParams.keys()]) {
    if (key.startsWith('utm_')) url.searchParams.delete(key);
  }
  url.searchParams.sort();
  return url.href;
}

export function storyKey(topic, card, deck) {
  if (card.id) return `${topic}:${card.id}`;
  const url = canonicalSource(card.sourceUrl);
  const uniqueSource = url && deck.filter(item => canonicalSource(item.sourceUrl) === url).length === 1;
  return `${topic}:${uniqueSource ? url : card.headline}`;
}

export function matchProgress(edition, current, legacy) {
  const read = new Set();
  for (const topic of sectionIds(edition)) {
    const deck = getDeck(edition, topic);
    for (const card of deck) {
      const key = storyKey(topic, card, deck);
      if (current.has(key) || legacy.has(`${topic}:${card.headline}`)) read.add(key);
    }
  }
  return read;
}

export function nextUnread(order, current, read) {
  const later = order.findIndex((story, index) => index > current && !read.has(story.key));
  return later >= 0 ? later : order.findIndex((story, index) => index < current && !read.has(story.key));
}
