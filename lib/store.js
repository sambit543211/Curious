import { timingSafeEqual } from 'node:crypto';

export const configured = () => Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
export { indianDay } from '../public/edition-format.js';
export const prefix = 'morning-edition:';
export const latestKey = prefix + 'latest';
export const archiveKey = prefix + 'archive';

export async function redis(...command) {
  const response = await fetch(process.env.UPSTASH_REDIS_REST_URL, {
    method:'POST', headers:{Authorization:'Bearer '+process.env.UPSTASH_REDIS_REST_TOKEN,'Content-Type':'application/json'},
    body:JSON.stringify(command), signal:AbortSignal.timeout(8000)
  });
  if (!response.ok) throw new Error('Edition storage request failed');
  const {result,error} = await response.json();
  if (error) throw new Error('Edition storage command failed');
  return result;
}
export function authorized(header) {
  if (!process.env.CRON_SECRET || typeof header !== 'string') return false;
  const actual = Buffer.from(header);
  const expected = Buffer.from('Bearer ' + process.env.CRON_SECRET);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
