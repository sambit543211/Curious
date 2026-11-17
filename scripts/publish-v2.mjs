import { readFile, writeFile } from 'node:fs/promises';
import { assembleEdition } from '../lib/edition-v2.js';
import { prepareInputs, readHistory } from './prepare-v2.mjs';

const [draftPath, fundamentals, market] = process.argv.slice(2);
if (!draftPath) throw new Error('Usage: npm run publish-v2 -- draft.json [fundamentals.json] [market.json]');
const draft = JSON.parse(await readFile(draftPath,'utf8'));
const history = await readHistory();
if (history.some(issue => issue.date === draft.date)) throw new Error('Edition date is already committed');
const prepared = await prepareInputs(draft.date,{fundamentals,market},history);
const edition = assembleEdition(draft,prepared,history);
const target = new URL('../public/editions/' + edition.date + '.json',import.meta.url);
await writeFile(target,JSON.stringify(edition,null,2) + '\n',{flag:'wx'});
console.log('Validated and wrote ' + edition.date + ' · commit this dated file to publish');
