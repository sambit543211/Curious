import { listEditionDates, publishingEnabled } from '../lib/archive.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  res.setHeader('Cache-Control', 'no-cache');
  try {
    const dates = await listEditionDates();
    return res.status(200).json({dates, publishing:publishingEnabled()});
  } catch {
    return res.status(503).json({error:'Archive temporarily unavailable'});
  }
}
