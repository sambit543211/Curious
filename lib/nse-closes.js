import { inflateRawSync } from 'node:zlib';
import { isDay } from '../public/edition-format.js';
import { closeValid } from './track-record.js';

const domain = 'https://nsearchives.nseindia.com';
function csvFields(row) {
  return (row.match(/(?:^|,)(?:"((?:[^"]|"")*)"|([^,]*))/g) ?? [])
    .map(field => field.replace(/^,/, '').replace(/^"(.*)"$/, '$1').replaceAll('""','"'));
}
function records(csv) {
  const [header,...lines] = csv.trim().replace(/^\uFEFF/,'').split(/\r?\n/);
  const fields = csvFields(header);
  return lines.filter(Boolean).map(line => {
    const values = csvFields(line);
    return Object.fromEntries(fields.map((name,index) => [name,values[index] ?? '']));
  });
}

function zippedCSV(raw) {
  const zip = Buffer.from(raw);
  const eocd = zip.lastIndexOf(Buffer.from('504b0506','hex'));
  if (eocd < 0 || eocd + 22 > zip.length) throw new Error('Invalid NSE ZIP');
  const central = zip.readUInt32LE(eocd + 16);
  if (zip.readUInt32LE(central) !== 0x02014b50) throw new Error('ZIP entry missing');
  const method = zip.readUInt16LE(central + 10);
  const size = zip.readUInt32LE(central + 20);
  const inflated = zip.readUInt32LE(central + 24);
  const local = zip.readUInt32LE(central + 42);
  if (zip.readUInt32LE(local) !== 0x04034b50 || inflated > 24_000_000 || size > zip.length) throw new Error('Unexpected NSE ZIP entry');
  const offset = local + 30 + zip.readUInt16LE(local + 26) + zip.readUInt16LE(local + 28);
  const payload = zip.subarray(offset, offset + size);
  if (method !== 0 && method !== 8) throw new Error('Unsupported NSE ZIP compression');
  const unpacked = method === 0 ? payload : inflateRawSync(payload, {maxOutputLength:24_000_000});
  if (unpacked.length !== inflated) throw new Error('NSE ZIP length mismatch');
  return unpacked.toString('utf8');
}

async function exchangeFile(url) {
  const res = await fetch(url,{signal:AbortSignal.timeout(20000),headers:{Accept:'*/*'}});
  if (res.status === 404) return null;
  if (!res.ok) throw new Error('NSE request returned ' + res.status);
  return res;
}

export async function fetchNseClose(date, symbols) {
  if (!isDay(date)) throw new Error('Use an ISO session date');
  const [year,month,day] = date.split('-');
  const equitiesSource = domain + '/content/cm/BhavCopy_NSE_CM_0_0_0_' + year + month + day + '_F_0000.csv.zip';
  const indicesSource = domain + '/content/indices/ind_close_all_' + day + month + year + '.csv';
  const [eq,ind] = await Promise.all([exchangeFile(equitiesSource),exchangeFile(indicesSource)]);
  if (!eq || !ind) return null;
  const prices = Object.fromEntries(records(zippedCSV(await eq.arrayBuffer()))
    .filter(row => row.TradDt === date && row.SctySrs === 'EQ' && symbols.has(row.TckrSymb) && Number(row.ClsPric) > 0)
    .map(row => [row.TckrSymb,Number(row.ClsPric)]));
  const index = new Map(records(await ind.text())
    .filter(row => row['Index Date'] === day + '-' + month + '-' + year)
    .map(row => [row['Index Name'],Number(row['Closing Index Value'])]));
  const result = {date,equitiesSource,indicesSource,nifty50:index.get('Nifty 50'),smallcap250:index.get('Nifty Smallcap 250'),prices};
  if (!closeValid(result)) throw new Error('NSE close files did not match the requested date or benchmarks');
  return result;
}
