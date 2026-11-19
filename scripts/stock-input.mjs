import { buildStockInput } from '../lib/stock-input.js';
import { selectStocks } from '../lib/stock-selection.js';
import { indianDay } from '../public/edition-format.js';
import { readHistory } from './prepare-v2.mjs';

// Usage: npm run stock-input -- [YYYY-MM-DD]  → shows today's selection without publishing anything.
const date = process.argv[2] ?? indianDay();
const input = await buildStockInput(date);
const selection = selectStocks(input.stocks, date, await readHistory());
const line = s => '  ' + s.symbol.padEnd(12) + s.verdict.padEnd(6) + ' ₹' + s.price + '  buy below ₹' + s.buyBelow +
  (s.dip ? '  ' + s.dip.fromHigh + '% from 52w high (' + s.dip.fall + ')' : '  score ' + s.score) + (s.repeat ? '  [repeat: ' + s.repeat.reason + ']' : '');
console.log('Edition ' + date + ' · NSE session ' + input.session + ' · fundamentals ' + input.fundamentalsDate);
console.log('Counts: ' + JSON.stringify(selection.counts));
console.log('52-week-low picks:'); selection.dips.forEach(s => console.log(line(s)));
console.log('Quality picks:'); selection.picks.forEach(s => console.log(line(s)));
for (const [group, reason] of Object.entries(selection.shortfall)) if (reason) console.log('Shortfall (' + group + '): ' + reason);
