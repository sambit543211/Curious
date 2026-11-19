import { readFile } from 'node:fs/promises';
import { fundamentalsGaps, validateFundamentals } from '../lib/stock-input.js';

// Usage: npm run check-fundamentals -- data/fundamentals/YYYY-MM-DD.json
const path = process.argv[2];
if (!path) throw new Error('Usage: npm run check-fundamentals -- data/fundamentals/YYYY-MM-DD.json');
const file = JSON.parse(await readFile(path, 'utf8'));
validateFundamentals(file, path.match(/(\d{4}-\d{2}-\d{2})\.json$/)?.[1]);
const gaps = fundamentalsGaps(file);
const complete = file.stocks.length - gaps.length;
console.log(file.stocks.length + ' stocks · ' + complete + ' complete · ' + gaps.length + ' missing a required metric');
for (const gap of gaps.slice(0, 40)) console.log('  ' + gap.symbol + ': ' + gap.missing.join(', '));
if (complete < 100) console.log('Warning: fewer than 100 complete stocks. Five fresh picks a day need a wide universe (aim for the Nifty 500).');
