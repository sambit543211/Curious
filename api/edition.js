import { readBundledEdition } from '../lib/edition.js';
import { isDay } from '../public/edition-format.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  res.setHeader('Cache-Control', 'no-cache');
  const date = req.query?.date;
  if (date !== undefined && !isDay(date)) return res.status(400).json({error:'Use a valid edition date'});
  try {
    const edition = await readBundledEdition(date);
    if (!edition) return res.status(404).json({error:'No edition for this date'});
    return res.status(200).json(edition);
  } catch {
    return res.status(503).json({error:'Edition temporarily unavailable'});
  }
}
