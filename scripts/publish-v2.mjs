import { readFile, writeFile } from 'node:fs/promises';
import { indianDay } from '../public/edition-format.js';
import { assembleEdition } from '../lib/edition-v2.js';
import { prepareInputs, readHistory } from './prepare-v2.mjs';
import { coverageProblems } from '../lib/trending.js';
import { getDeck, sectionIds } from '../public/edition-format.js';

const args = process.argv.slice(2);
const replace = args.includes('--replace');
const [draftPath, fundamentals, market] = args.filter(arg => arg !== '--replace');
if (!draftPath) throw new Error('Usage: npm run publish-v2 -- draft.json [fundamentals.json] [market.json]');
const draft = JSON.parse(await readFile(draftPath,'utf8'));
const allHistory = await readHistory();
const exists = allHistory.some(issue => issue.date === draft.date);
if (replace && (draft.date !== indianDay() || draft.replacePublished !== true || typeof draft.revisionId !== 'string' || !draft.revisionId.trim())) throw new Error('Replacement needs explicit current-day revision consent and revisionId');
if (exists && !replace) throw new Error('Edition date is already committed');
const history = allHistory.filter(issue => !replace || issue.date !== draft.date);
const prepared = await prepareInputs(draft.date,{fundamentals,market},history);
const edition = assembleEdition(draft,prepared,history);
if (replace) edition.revisionId = draft.revisionId;
// Every big story on Google News this morning must be covered by a card, or skipped with a reason.
const checklist = await readFile(new URL('prepared.json', new URL(draftPath, 'file://' + process.cwd() + '/')),'utf8').then(JSON.parse).catch(() => null);
if (checklist?.trending?.items?.length) {
  const cardIds = new Set(sectionIds(edition).flatMap(id => getDeck(edition,id).map(card => card.id)));
  const problems = coverageProblems(checklist.trending, draft.coverage, cardIds);
  if (problems.length) throw new Error('Edition misses big stories:\n' + problems.join('\n'));
  edition.coverage = {checkedAt:checklist.trending.checkedAt, items:checklist.trending.items.map(item => ({title:item.title, feed:item.feed, rank:item.rank, answer:draft.coverage[item.id]}))};
}
const target = new URL('../public/editions/' + edition.date + '.json',import.meta.url);
await writeFile(target,JSON.stringify(edition,null,2) + '\n',{flag:replace ? 'w' : 'wx'});
console.log('Validated and wrote ' + edition.date + ' · commit this dated file to publish');
