// Editions are static files. The build writes /editions/index.json listing every date.
import { isDay, isEdition } from '../edition-format.js';

const paths = new Map();
const loaded = new Map();
export let dates = [];

async function json(path) {
  const response = await fetch(path, {cache:'no-cache'});
  if (!response.ok) throw new Error('Unavailable: ' + path);
  return response.json();
}

export async function refreshCatalog() {
  const index = await json('/editions/index.json');
  for (const entry of index.editions ?? []) {
    if (isDay(entry.date) && /^\/(first-edition\.json|editions\/\d{4}-\d{2}-\d{2}\.json)$/.test(entry.path)) {
      paths.set(entry.date, entry.path);
    }
  }
  dates = [...paths.keys()].sort().reverse();
  return dates;
}

export async function loadEdition(day) {
  if (loaded.has(day)) return loaded.get(day);
  if (!paths.has(day)) throw new Error('No edition for ' + day);
  const issue = await json(paths.get(day));
  if (!isEdition(issue) || issue.date !== day) throw new Error('Invalid edition ' + day);
  loaded.set(day, issue);
  return issue;
}
