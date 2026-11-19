import { bundledDates } from '../lib/edition.js';

export default function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  res.setHeader('Cache-Control', 'no-cache');
  return res.status(200).json({dates:bundledDates});
}
