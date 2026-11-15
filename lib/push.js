import webpush from 'web-push';
import { prefix, redis } from './store.js';

export const subscriptions = prefix + 'subscriptions';
export function pushConfigured() {
  return Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && process.env.VAPID_SUBJECT);
}
export function validSubscription(value) {
  try {
    const url = new URL(value.endpoint);
    const allowedHost = /^(?:[a-z0-9-]+\.)*push\.apple\.com$|^fcm\.googleapis\.com$|^updates\.push\.services\.mozilla\.com$|^(?:[a-z0-9-]+\.)*notify\.windows\.com$/i;
    return url.protocol === 'https:' && !url.username && !url.password && !url.port && allowedHost.test(url.hostname) &&
      value.endpoint.length <= 2048 && /^[\w-]{87}$/.test(value.keys?.p256dh) && /^[\w-]{22}$/.test(value.keys?.auth);
  } catch { return false; }
}
export async function notify(date) {
  if (!pushConfigured()) return {sent:0, failed:0};
  const clientOptions = {vapidDetails:{subject:process.env.VAPID_SUBJECT,publicKey:process.env.VAPID_PUBLIC_KEY,privateKey:process.env.VAPID_PRIVATE_KEY}, TTL:21600, timeout:5000};
  const entries = await redis('HVALS',subscriptions);
  let sent = 0, failed = 0;
  for (let offset=0; offset<entries.length; offset+=20) {
    await Promise.all(entries.slice(offset,offset+20).map(async entry => {
      const subscription = JSON.parse(entry);
      const delivered = prefix + 'push:' + date;
      if (await redis('SISMEMBER',delivered,subscription.endpoint)) return;
      try {
        await webpush.sendNotification(subscription,JSON.stringify({date}),clientOptions);
        sent++;
        await redis('SADD',delivered,subscription.endpoint);
        await redis('EXPIRE',delivered,172800);
      } catch (error) {
        if (error.statusCode === 404 || error.statusCode === 410) await redis('HDEL',subscriptions,subscription.endpoint);
        else failed++;
      }
    }));
  }
  return {sent,failed};
}
