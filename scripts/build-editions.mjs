import { access, readFile, readdir, writeFile } from 'node:fs/promises';
import { baseTopics, isDay, isEdition, sourceLink, storyKey, topicIds } from '../public/edition-format.js';

const publicRoot = new URL('../public/', import.meta.url);
const editionsDir = new URL('editions/', publicRoot);
const entries = ['/first-edition.json'];
for (const name of await readdir(editionsDir)) {
  if (name !== 'index.json' && name.endsWith('.json')) entries.push('/editions/' + name);
}

const catalog = new Map();
const checkedImages = new Set();
for (const path of entries) {
  const edition = JSON.parse(await readFile(new URL(path.slice(1), publicRoot), 'utf8'));
  if (!isEdition(edition) || !baseTopics.every(id => edition.sections[id])) {
    throw new Error(path + ' must contain five cards in each available topic');
  }
  if (path.startsWith('/editions/') && path !== '/editions/' + edition.date + '.json') {
    throw new Error(path + ' must match its edition date');
  }
  if (!isDay(edition.date) || catalog.has(edition.date)) throw new Error('Duplicate or invalid date ' + edition.date);
  for (const id of topicIds.filter(id => edition.sections[id])) {
    const cards = edition.sections[id];
    if (new Set(cards.map(card => card.headline.trim().toLowerCase())).size !== cards.length) {
      throw new Error(path + ' contains duplicate headlines in ' + id);
    }
    if (new Set(cards.map(card => storyKey(id, card, cards))).size !== cards.length) {
      throw new Error(path + ' contains duplicate story IDs in ' + id);
    }
    for (const card of cards) {
      if (!sourceLink(card.sourceUrl) || (card.sources !== undefined &&
          (!Array.isArray(card.sources) || !card.sources.length || card.sources.some(source =>
            typeof source?.label !== 'string' || !source.label.trim() || !sourceLink(source.url))))) {
        throw new Error(path + ' contains an invalid source URL');
      }
      if (!/^\/images\/[a-z-]+\.jpg$/.test(card.image || '')) {
        throw new Error(path + ' contains an invalid cover path');
      }
      if (!checkedImages.has(card.image)) {
        await access(new URL(card.image.slice(1), publicRoot));
        checkedImages.add(card.image);
      }
    }
  }
  if (!edition.sections.marketing.every((card, i) => (i < 3 ? /^India\b/i : /^Global\b/i).test(card.label))) {
    throw new Error(path + ' must contain three India and two Global marketing stories');
  }
  catalog.set(edition.date, {date:edition.date,path});
}
const editions = [...catalog.values()].sort((a,b) => b.date.localeCompare(a.date));
const index = {editions, publishing:process.env.VERCEL_ENV === 'production'};
await writeFile(new URL('index.json', editionsDir), JSON.stringify(index, null, 2) + '\n');
console.log('Built archive index for ' + editions.length + ' editions.');
