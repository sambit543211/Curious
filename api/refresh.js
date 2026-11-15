import { randomUUID } from 'node:crypto';
import { archiveKey, authorized, configured, latestKey, indianDay, prefix, redis } from '../lib/store.js';
import { firstEdition, categories } from '../lib/edition.js';
import { research } from '../lib/research.js';
import { notify } from '../lib/push.js';

const release = "if redis.call('GET',KEYS[1]) == ARGV[1] then return redis.call('DEL',KEYS[1]) else return 0 end";
const publish = `
if redis.call('GET', KEYS[1]) ~= ARGV[1] then return 0 end
local previous = redis.call('GET', KEYS[2])
if previous then
  local ok, edition = pcall(cjson.decode, previous)
  if ok and type(edition) == 'table' and type(edition.date) == 'string' then
    if edition.date > ARGV[2] then return 0 end
    if edition.date < ARGV[2] then redis.call('HSETNX', KEYS[3], edition.date, previous) end
  end
end
redis.call('HSET', KEYS[3], ARGV[2], ARGV[3])
redis.call('SET', KEYS[2], ARGV[3])
return 1
`;
export default async function handler(req,res) {
  if (req.method !== 'POST' && req.method !== 'GET') return res.status(405).end();
  if (!authorized(req.headers.authorization)) return res.status(401).json({error:'Unauthorized'});
  if (!configured() || !process.env.OPENAI_API_KEY) return res.status(503).json({error:'Publishing setup required'});
  const now = new Date();
  const date = indianDay(now);
  const lock = prefix + 'lock:' + date;
  const token = randomUUID();
  let locked = false;
  try {
    locked = (await redis('SET',lock,token,'NX','EX',180)) === 'OK';
    if (!locked) return res.status(409).json({error:'Edition is already being prepared'});
    const previous = JSON.parse(await redis('GET',latestKey) || 'null') || firstEdition;
    if (previous.date !== date || !categories.every(category => previous.sections?.[category]?.length === 5)) {
      const yesterday = indianDay(new Date(now.getTime() - 86400000));
      const sections = await Promise.allSettled(categories.map(async category => [
        category,await research(category,date,yesterday,(previous.sections?.[category] ?? []).map(card => card.headline))
      ]));
      const failures = sections.filter(item => item.status === 'rejected');
      if (failures.length) throw new Error(failures.map(item => item.reason?.message).join(' | '));
      const edition = {date,publishedAt:new Date().toISOString(),sections:Object.fromEntries(sections.map(item => item.value))};
      if (await redis('EVAL',publish,3,lock,latestKey,archiveKey,token,date,JSON.stringify(edition)) !== 1) throw new Error('Edition changed during refresh');
    }
    const delivery = await notify(date);
    return res.status(delivery.failed ? 502 : 200).json({date,...delivery});
  } catch (error) {
    console.error('Edition refresh:',error.message);
    return res.status(502).json({error:'Refresh failed. The last available edition remains readable.'});
  } finally {
    if (locked) await redis('EVAL',release,1,lock,token).catch(() => {});
  }
}
