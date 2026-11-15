import { configured, redis } from '../lib/store.js';
import { subscriptions, pushConfigured, validSubscription } from '../lib/push.js';

export default async function handler(req,res) {
  if (!configured() || !pushConfigured()) return res.status(503).json({error:'Alerts are not configured'});
  if (req.method === 'GET') return res.status(200).json({publicKey:process.env.VAPID_PUBLIC_KEY});
  if (req.method !== 'POST') return res.status(405).end();
  const entry = req.body;
  if (!validSubscription(entry)) return res.status(400).json({error:'Invalid push subscription'});
  const {endpoint, keys} = entry;
  try {
    await redis('HSET',subscriptions,endpoint,JSON.stringify({endpoint, keys:{p256dh:keys.p256dh,auth:keys.auth}}));
    return res.status(201).json({enabled:true});
  } catch { return res.status(503).json({error:'Unable to store the subscription'}); }
}
