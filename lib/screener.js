// Parses a Screener.in company page (plus its median-P/E chart) into the weekly fundamentals metrics.
// Only numbers printed on those pages are used; a metric that is not published is left out.

const decode = text => text.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
const plain = html => decode(html.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
export const num = text => {
  const match = String(text ?? '').replace(/,/g, '').match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
};
const round = (n, places = 2) => Math.round(n * 10 ** places) / 10 ** places;
const months = {Jan:1, Feb:2, Mar:3, Apr:4, May:5, Jun:6, Jul:7, Aug:8, Sep:9, Oct:10, Nov:11, Dec:12};
const monthEnd = label => {
  const [mon, year] = label.split(' ');
  if (!months[mon] || !/^\d{4}$/.test(year)) return null;
  return new Date(Date.UTC(Number(year), months[mon], 0)).toISOString().slice(0, 10);
};

export function section(html, id) {
  const match = html.match(new RegExp('<section id="' + id + '"[\\s\\S]*?</section>'));
  return match ? match[0] : '';
}

// The first data table in a section: {headers:[...], rows:Map(label -> [cells])}
export function table(sectionHtml) {
  const tbl = sectionHtml.match(/<table[^>]*class="[^"]*data-table[^"]*"[\s\S]*?<\/table>/);
  if (!tbl) return {headers:[], rows:new Map()};
  const headers = [...(tbl[0].match(/<thead[\s\S]*?<\/thead>/)?.[0] ?? '').matchAll(/<th[^>]*>([\s\S]*?)<\/th>/g)].map(m => plain(m[1])).slice(1);
  const rows = new Map();
  for (const row of (tbl[0].match(/<tbody[\s\S]*?<\/tbody>/)?.[0] ?? '').matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)) {
    const cells = [...row[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map(m => plain(m[1]));
    if (!cells.length) continue;
    const label = cells[0].replace(/\s*\+$/, '').trim();
    if (!rows.has(label)) rows.set(label, cells.slice(1));
  }
  return {headers, rows};
}

const values = (t, label) => (t.rows.get(label) ?? []).map(num);
const lastFinite = list => [...list].reverse().find(Number.isFinite) ?? null;

export function topRatios(html) {
  const out = {};
  const ul = html.match(/<ul id="top-ratios">([\s\S]*?)<\/ul>/)?.[1] ?? '';
  for (const li of ul.matchAll(/<li[\s\S]*?<\/li>/g)) {
    const name = plain(li[0].match(/<span class="name">([\s\S]*?)<\/span>/)?.[1] ?? '');
    const value = plain(li[0].match(/<span class="nowrap value">([\s\S]*?)<\/span>\s*<\/li>|<span class="[^"]*value[^"]*">([\s\S]*?)<\/li>/)?.[0] ?? '');
    if (name) out[name] = value;
  }
  return out;
}

function compounded(html, title) {
  const block = html.match(new RegExp(title + '[\\s\\S]*?</table>'))?.[0] ?? '';
  const row = [...block.matchAll(/<td>([\s\S]*?)<\/td>\s*<td>([\s\S]*?)<\/td>/g)].find(m => /5 Years/.test(plain(m[1])));
  return row ? num(plain(row[2])) : null;
}

export const companyId = html => html.match(/data-company-id="(\d+)"/)?.[1] ?? null;

// Returns {metrics, dataDate, problems}. `chart` is Screener's median-P/E chart JSON (optional).
export function parseCompany(html, chart) {
  const metrics = {};
  const problems = [];
  const set = (key, value) => { if (Number.isFinite(value)) metrics[key] = round(value); else problems.push(key); };
  const top = topRatios(html);
  set('marketCap', num(top['Market Cap']));
  set('divYield', num(top['Dividend Yield']));

  const ratios = table(section(html, 'ratios'));
  const roce = values(ratios, 'ROCE %').filter(Number.isFinite).slice(-5);
  set('roce5y', roce.length === 5 ? roce.reduce((a, b) => a + b, 0) / 5 : null);

  const balance = table(section(html, 'balance-sheet'));
  const equity = lastFinite(values(balance, 'Equity Capital'));
  const reserves = lastFinite(values(balance, 'Reserves'));
  const borrowings = lastFinite(values(balance, 'Borrowings'));
  set('de', [equity, reserves, borrowings].every(Number.isFinite) && equity + reserves > 0 ? borrowings / (equity + reserves) : null);

  const pl = section(html, 'profit-loss');
  set('salesCagr5y', compounded(pl, 'Compounded Sales Growth'));
  set('profitCagr5y', compounded(pl, 'Compounded Profit Growth'));

  const cash = values(table(section(html, 'cash-flow')), 'Cash from Operating Activity').filter(Number.isFinite).slice(-5);
  set('ocfPositiveYears', cash.length === 5 ? cash.filter(v => v > 0).length : null);

  const quarters = table(section(html, 'quarters'));
  const profit = values(quarters, 'Net Profit');
  const latest = profit.at(-1);
  const yearAgo = profit.at(-5);
  set('profitYoY', Number.isFinite(latest) && Number.isFinite(yearAgo) && yearAgo > 0 ? (latest / yearAgo - 1) * 100 : null);
  const dataDate = monthEnd(quarters.headers.at(-1) ?? '');

  const shareholding = table(section(html, 'shareholding'));
  if (shareholding.rows.size && !shareholding.rows.has('Promoters')) {
    // The published shareholding pattern has no promoter category: nothing is held or pledged by promoters.
    Object.assign(metrics, {promoterHolding:0, promoterChange:0, pledge:0});
  } else {
    const holding = values(shareholding, 'Promoters');
    set('promoterHolding', holding.at(-1));
    set('promoterChange', Number.isFinite(holding.at(-1)) && Number.isFinite(holding.at(-2)) ? holding.at(-1) - holding.at(-2) : null);
  }

  const datasets = chart?.datasets ?? [];
  const lastValue = metric => {
    const list = datasets.find(ds => ds.metric === metric)?.values;
    return Array.isArray(list) ? list.at(-1)?.[1] : null;
  };
  const eps = lastValue('EPS');
  const median = lastValue('Median PE');
  set('eps', num(eps));
  // A "5-year median" needs five years of P/E history; recent listings only have their (often expensive) early years.
  const peSeries = datasets.find(ds => ds.metric === 'Price to Earning')?.values;
  const span = Array.isArray(peSeries) && peSeries.length > 1 ? (Date.parse(peSeries.at(-1)[0]) - Date.parse(peSeries[0][0])) / (365.25 * 86400000) : 0;
  set('peMedian5y', span >= 4.5 ? num(median) : null);
  return {metrics, dataDate, problems};
}
