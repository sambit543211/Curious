// What a story shows up front and what waits under "More". All topic-specific wording
// comes from topics.js so the reader view stays generic.
import { getDeck, sectionIds, storyKey } from '../edition-format.js';
import { topicById } from '../topics.js';

const months = 'Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec';
const plainDate = new RegExp(`^\\d{1,2}(?:[–-]\\d{1,2})? (?:${months})(?: \\d{4})?$`, 'i');

// "India · 19 Nov 2026" says nothing inside the India section of the 19 Nov edition.
export function cleanLabel(topic, label) {
  const aliases = topicById[topic]?.aliases ?? [];
  return String(label ?? '').split('·').map(part => part.trim())
    .filter(part => part && !plainDate.test(part) && !aliases.includes(part.toLowerCase()))
    .join(' · ');
}

export function readingOrder(issue) {
  return sectionIds(issue).flatMap(topic => {
    const deck = getDeck(issue, topic);
    return deck.map((card, index) => ({topic, index, total:deck.length, card, key:storyKey(topic, card, deck)}));
  });
}

const words = card => ['headline','summary','why','soWhat','context','take','watch','risk','valuation','belief','experiment','finding','limits','useThisWeek']
  .map(key => card[key]).concat(card.thesis ?? [], card.breakers ?? [], card.examples ?? [])
  .filter(Boolean).join(' ').split(/\s+/).length;
export const storyMinutes = card => Math.max(1, Math.round(words(card) / 215));
export const sourceCount = card => (card.sources ?? (card.sourceUrl ? [card.sourceUrl] : [])).length;
export const storyMeta = card => {
  const count = sourceCount(card);
  return storyMinutes(card) + ' min' + (count ? ' · ' + count + (count === 1 ? ' source' : ' sources') : '');
};
export const minutes = stories => Math.max(1, Math.round(stories.reduce((sum, story) => sum + words(story.card), 0) / 215));

export function storyBlocks(topic, card) {
  const labels = topicById[topic];
  const primary = [];
  const more = [];
  const add = (list, title, text) => { if (typeof text === 'string' && text.trim()) list.push({title, text}); };

  add(primary, labels.context, card.soWhat ?? card.context);
  if (topic === 'mind') add(primary, 'Try this week', card.useThisWeek);
  if (topic === 'tech') add(primary, 'Try this', card.tryThis);
  add(primary, 'What to watch', card.watch);
  if (!card.breakers) add(primary, 'What could go wrong', card.risk);

  add(more, labels.why, card.why);
  if (topic === 'mind') add(more, 'Real-life example', card.example);
  add(more, 'Valuation', card.valuation);
  add(more, 'My take', card.take);
  if (card.brand) add(more, 'Campaign and results',
    [card.brand, card.agency, card.objective, card.insight, card.channels, card.results].filter(Boolean).join(' · '));
  return {primary, more};
}

export function topStories(issue, order) {
  const picks = issue.top3?.map(pick => ({
    story:order.find(entry => entry.card.id === pick.cardId || entry.key === pick.cardId), line:pick.line
  })) ?? ['india','world','tech'].map(topic => ({story:order.find(entry => entry.topic === topic)}));
  return picks.filter(pick => pick.story);
}

// What gets sent when you share a story (WhatsApp, Messages, Mail…): a short, easy-to-read message, not a link alone.
const firstSentences = (text, limit = 2) => String(text ?? '').trim().split(/(?<=[.!?])\s+(?=[A-Z0-9"‘“(₹])/)
  .slice(0, limit).join(' ').trim();
export function shareMessage(topic, card) {
  const lines = [card.headline, ''];
  if (card.kind === 'dashboard') lines.push(firstSentences(card.summary ?? card.soWhat, 2));
  else if (card.symbol && card.verdict) {
    lines.push(firstSentences(card.summary, 2));
    const price = Number.isFinite(card.price) ? 'Price ₹' + Math.round(card.price).toLocaleString('en-IN') : null;
    const below = Number.isFinite(card.buyBelow) ? 'buy below ₹' + Math.round(card.buyBelow).toLocaleString('en-IN') : null;
    lines.push('', card.symbol + ': ' + [card.verdict, price, below].filter(Boolean).join(' · '));
    lines.push('Research, not advice.');
  } else if (card.experiment) {
    lines.push(firstSentences(card.summary, 2), '', 'The surprise: ' + firstSentences(card.finding, 2));
    if (card.take) lines.push('', 'Remember: ' + card.take);
  } else {
    lines.push(firstSentences(card.summary, 2));
    if (card.soWhat) lines.push('', 'Why it matters: ' + firstSentences(card.soWhat, 1));
  }
  return lines.filter((line, index, all) => line || all[index - 1]).join('\n').trim();
}
