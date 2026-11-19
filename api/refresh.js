import { readBundledEdition } from '../lib/edition.js';
import { notify } from '../lib/push.js';
import { authorized } from '../lib/store.js';
import { indianDay, isV2 } from '../public/edition-format.js';

export default async function handler(req, res) {
  if (req.method !== 'POST' && req.method !== 'GET') return res.status(405).end();
  if (!authorized(req.headers.authorization)) return res.status(401).json({error:'Unauthorized'});
  const date = indianDay();
  try {
    const published = await readBundledEdition(date);
    if (!isV2(published)) return res.status(409).json({error:'No validated v2 edition published for this date'});
    const delivery = await notify(date);
    return res.status(delivery.failed ? 502 : 200).json({date,...delivery});
  } catch {
    return res.status(502).json({error:'Could not send edition notifications'});
  }
}
