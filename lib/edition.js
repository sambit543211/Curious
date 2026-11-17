import { readFile } from 'node:fs/promises';
import { isEdition, topicIds, sourceLink } from '../public/edition-format.js';

const [legacy, manifest] = await Promise.all([
  readFile(new URL('../public/first-edition.json', import.meta.url), 'utf8'),
  readFile(new URL('../public/editions/index.json', import.meta.url), 'utf8')
]);
const catalog = JSON.parse(manifest);

export const firstEdition = JSON.parse(legacy);
export const categories = topicIds;
export const bundledDates = catalog.editions.map(item => item.date);
export const scheduledPublishing = catalog.publishing === true;

export async function readBundledEdition(date = bundledDates[0]) {
  if (date === firstEdition.date) return firstEdition;
  if (!bundledDates.includes(date)) return undefined;
  const data = JSON.parse(await readFile(new URL('../public/editions/' + date + '.json', import.meta.url), 'utf8'));
  if (!isEdition(data) || data.date !== date) throw new Error('Bundled edition is invalid');
  return data;
}

export function isHttps(value) {
  return Boolean(sourceLink(value));
}
