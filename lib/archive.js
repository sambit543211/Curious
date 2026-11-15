import { firstEdition, seedEditions } from './edition.js';
import { archiveKey, configured, latestKey, redis } from './store.js';
import { isDay, isEdition } from '../public/edition-format.js';

export const publishingEnabled = () => Boolean(configured() && process.env.OPENAI_API_KEY);

function decode(raw) {
  if (raw == null) return null;
  const edition = JSON.parse(raw);
  if (!isEdition(edition)) throw new Error('Stored edition is invalid');
  return edition;
}

export async function findEdition(date) {
  if (!configured()) return date ? seedEditions.get(date) : firstEdition;
  if (!date) {
    const latest = decode(await redis('GET', latestKey));
    return latest && latest.date >= firstEdition.date ? latest : firstEdition;
  }

  const archived = decode(await redis('HGET', archiveKey, date));
  if (archived?.date === date) return archived;
  const latest = decode(await redis('GET', latestKey));
  return latest?.date === date ? latest : seedEditions.get(date);
}

export async function listEditionDates() {
  const dates = new Set(seedEditions.keys());
  if (configured()) {
    const [savedDays, rawLatest] = await Promise.all([
      redis('HKEYS', archiveKey),
      redis('GET', latestKey)
    ]);
    for (const date of (savedDays ?? []).filter(isDay)) dates.add(date);
    const latest = decode(rawLatest);
    if (latest) dates.add(latest.date);
  }
  return [...dates].sort().reverse();
}
