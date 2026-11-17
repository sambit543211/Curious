export const baseTopics = ['india', 'world', 'markets', 'tech', 'mind', 'marketing'];
export const stockTopic = 'investing';
export const topicIds = ['india', 'world', 'markets', stockTopic, 'tech', 'mind', 'marketing'];

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

export function isEdition(value) {
  if (!isDay(value?.date) || !value.sections) return false;
  return topicIds.every(id => {
    const deck = value.sections[id];
    if ((id === 'marketing' || id === stockTopic) && deck === undefined) return true;
    const required = ['label','headline','summary','context','source','sourceUrl'];
    if (id === stockTopic) required.push('id', 'why', 'valuation', 'risk');
    return Array.isArray(deck) && deck.length === 5 && deck.every(card =>
      required.every(key => typeof card?.[key] === 'string' && card[key].trim()) &&
      (card.sources === undefined || (Array.isArray(card.sources) && card.sources.length > 0 &&
        card.sources.every(source => typeof source?.label === 'string' && source.label.trim() && sourceLink(source.url))))
    );
  });
}

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
  for (const [topic, deck] of Object.entries(edition.sections)) {
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
