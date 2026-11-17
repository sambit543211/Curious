import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { getDeck, indianDay, isDay, isV2, isSunday } from '../public/edition-format.js';
import { fetchNseClose } from '../lib/nse-closes.js';

const date = process.argv[2] ?? indianDay();
if (!isDay(date) || date > indianDay()) throw new Error('Use an elapsed or current IST session date');
if (isSunday(date)) { console.log('Sunday · no NSE close update'); process.exit(0); }
const root = new URL('../public/editions/', import.meta.url);
const files = (await readdir(root)).filter(name => /^\d{4}-\d{2}-\d{2}\.json$/.test(name));
const editions = await Promise.all(files.map(async name => JSON.parse(await readFile(new URL(name,root),'utf8'))));
const symbols = new Set(editions.filter(isV2).flatMap(issue => getDeck(issue,'investing')
  .filter(card => ['pick','weekly'].includes(card.slot)).map(card => card.symbol)));
if (!symbols.size) { console.log('No verified v2 picks to update'); process.exit(0); }
const snapshot = await fetchNseClose(date,symbols);
if (!snapshot) { console.log('NSE closing files unavailable for ' + date); process.exit(0); }
const closes = new URL('../public/market-closes/', import.meta.url);
await mkdir(closes,{recursive:true});
const file = new URL(date + '.json',closes);
try {
  await writeFile(file,JSON.stringify(snapshot,null,2) + '\n',{flag:'wx'});
  console.log('Recorded ' + date + ' NSE close');
} catch (error) {
  if (error.code !== 'EEXIST') throw error;
  console.log('NSE close already recorded for ' + date);
}
