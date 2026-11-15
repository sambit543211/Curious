import { readFile } from 'node:fs/promises';
import { topicIds } from '../public/edition-format.js';

const [latestSeed, previousSeed] = await Promise.all([
  readFile(new URL('../public/first-edition.json', import.meta.url), 'utf8'),
  readFile(new URL('../public/editions/2026-11-14.json', import.meta.url), 'utf8')
]);

export const firstEdition = JSON.parse(latestSeed);
export const seedEditions = new Map([firstEdition, JSON.parse(previousSeed)].map(edition => [edition.date, edition]));
export const categories = topicIds;

export function isHttps(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password;
  } catch { return false; }
}
