export const researchFooter = 'AI-generated research, not advice from a SEBI-registered analyst. Verify before investing.';
export const moatTypes = ['Monopoly/duopoly', 'Network effect', 'Switching cost', 'Regulated asset', 'Brand', 'Cost leadership', 'None'];

export const metricLabels = {
  roce5y:'5-year average ROCE (%)', de:'Debt / equity', salesCagr5y:'5-year sales CAGR (%)',
  profitCagr5y:'5-year profit CAGR (%)', ocfPositiveYears:'Years with positive operating cash flow',
  pe:'Trailing P/E', peMedian5y:'5-year median P/E', peg:'PEG', eps:'Trailing EPS (₹)',
  pb:'P/B', pbMedian5y:'5-year median P/B', bvps:'Book value per share (₹)',
  roa:'ROA (%)', grossNpa:'Gross NPA (%)', car:'Capital adequacy (%)', divYield:'Dividend yield (%)',
  promoterHolding:'Promoter holding (%)', pledge:'Promoter pledge (%)',
  marketCap:'Market cap (₹ crore)', avgDailyValue:'Average daily traded value (₹ crore)',
  high52:'52-week high (₹, adjusted)', low52:'52-week low (₹, adjusted)',
  profitYoY:'Latest quarter profit vs a year ago (%)', promoterChange:'Promoter holding change, last quarter (pts)'
};

// Stock cards that carry a symbol, price and verdict. 'weekly' remains for editions published before 20 Nov 2026.
export const positionSlots = ['dip','pick','weekly'];
export const isPosition = card => !!card && positionSlots.includes(card.slot) && !!card.verdict;

// Cards 1-2: quality stocks trading near their 52-week low.
export const dipRules = {nearLow:1.10, belowHigh:0.75, minProfitYoY:-20, minPromoterChange:-2, sectorWide:15};
export function dipCheck(stock) {
  const m = stock?.metrics ?? {};
  const price = stock?.price;
  const ok = [price, m.high52, m.low52].every(n => Number.isFinite(n) && n > 0) && m.low52 <= m.high52;
  const fromHigh = ok ? Math.round((price / m.high52 - 1) * 1000) / 10 : null;
  const fromLow = ok ? Math.round((price / m.low52 - 1) * 1000) / 10 : null;
  const tests = {
    nearLow: ok && price <= m.low52 * dipRules.nearLow,
    belowHigh: ok && price <= m.high52 * dipRules.belowHigh,
    profit: Number.isFinite(m.profitYoY) && m.profitYoY >= dipRules.minProfitYoY,
    promoter: Number.isFinite(m.promoterChange) && m.promoterChange >= dipRules.minPromoterChange
  };
  return {tests, pass:Object.values(tests).every(Boolean), fromHigh, fromLow};
}
export const dipLabels = {
  nearLow:'Within 10% of its 52-week low', belowHigh:'At least 25% below its 52-week high',
  profit:'Latest quarter profit not down more than 20% a year on', promoter:'Promoters did not cut holding by more than 2 points last quarter'
};

export const screenLabels = {
  roce:'5-year average ROCE ≥ 15%', debt:'Debt / equity ≤ 0.5', sales:'5-year sales CAGR ≥ 10%',
  profit:'5-year profit CAGR ≥ 10%', cash:'Positive operating cash flow in ≥ 4 of 5 years',
  pledge:'Promoter pledge < 5%', valuation:'P/E below its 5-year median or PEG < 1.5',
  liquidity:'Market cap ≥ ₹1,000 crore and daily traded value ≥ ₹5 crore',
  roa:'ROA ≥ 1.2%', npa:'Gross NPA ≤ 3%', capital:'Capital adequacy ≥ 15%',
  book:'P/B below the 5-year median'
};

const finite = Number.isFinite;
const positive = n => finite(n) && n > 0;
const limit = (n, max) => finite(n) && n >= 0 && n <= max;
const floor = (n, min) => finite(n) && n >= min;
const cents = n => Math.round((n + Number.EPSILON) * 100) / 100;

export function evaluatePick(stock) {
  const m = stock.metrics ?? {};
  const finance = stock.kind === 'bank' || stock.kind === 'nbfc';
  const common = {
    // Pledge data is not always published in free sources: a missing value is 'not checked' (null), never a pass or a fail.
    pledge:finite(m.pledge) ? m.pledge >= 0 && m.pledge < 5 : null,
    liquidity:floor(m.marketCap, 1000) && floor(m.avgDailyValue, 5)
  };
  const screen = finance ? {
    roa:floor(m.roa, 1.2), npa:limit(m.grossNpa, 3), capital:floor(m.car, 15),
    book:positive(m.pb) && positive(m.pbMedian5y) && m.pb < m.pbMedian5y, ...common
  } : {
    roce:floor(m.roce5y, 15), debt:limit(m.de, 0.5), sales:floor(m.salesCagr5y, 10),
    profit:floor(m.profitCagr5y, 10), cash:Number.isInteger(m.ocfPositiveYears) && m.ocfPositiveYears >= 4 && m.ocfPositiveYears <= 5,
    valuation:(positive(m.pe) && positive(m.peMedian5y) && m.pe < m.peMedian5y) || (positive(m.peg) && m.peg < 1.5),
    ...common
  };
  const inputs = finance ? [m.pbMedian5y, m.bvps] : [m.peMedian5y, m.eps];
  const fairValue = inputs.every(positive) ? cents(inputs[0] * inputs[1]) : null;
  const buyBelow = fairValue === null ? null : cents(fairValue * 0.8);
  const pass = Object.entries(screen).every(([key, ok]) => ok === true || (key === 'pledge' && ok === null)) && positive(stock.price) && positive(buyBelow);
  const verdict = !pass || stock.price > cents(buyBelow * 1.2) ? 'Avoid' : stock.price <= buyBelow ? 'Buy' : 'Wait';
  return {screen, pass, fairValue, buyBelow, verdict};
}

// Company size by market value (₹ crore). SEBI's classes are rank-based (top 100 large, next 150 mid);
// these cut-offs approximate where AMFI's latest lists draw those lines.
export const sizeOf = cap => !Number.isFinite(cap) ? null : cap >= 100000 ? 'Large' : cap >= 33000 ? 'Mid' : 'Small';
export const sizeNote = {Large:'Large cap · roughly India’s top 100 by value', Mid:'Mid cap · roughly ranks 101–250', Small:'Small cap · outside the top 250'};

// The fundamentals scorecard: each metric, a plain benchmark, and whether this stock looks good, okay or weak on it.
const grade = (value, good, weak, lowerIsBetter = false) => !Number.isFinite(value) ? null :
  lowerIsBetter ? (value <= good ? 'good' : value > weak ? 'weak' : 'ok') : (value >= good ? 'good' : value < weak ? 'weak' : 'ok');
const num = value => Number.isFinite(value) ? (Math.round(value * 10) / 10).toLocaleString('en-IN') : '—';
export function scorecard(card) {
  const m = card?.metrics ?? {};
  const financial = card?.kind === 'bank' || card?.kind === 'nbfc';
  const rows = [];
  const add = (name, value, hint, status = null) => { if (value !== null) rows.push({name, value, hint, status}); };
  const pct = key => Number.isFinite(m[key]) ? num(m[key]) + '%' : null;
  const size = sizeOf(m.marketCap);
  add('Company size', Number.isFinite(m.marketCap) ? '₹' + num(m.marketCap) + ' cr' : null, size ? sizeNote[size] : '');
  if (financial) {
    add('Return on assets', pct('roa'), 'Profit on everything it lends · good above 1%', grade(m.roa, 1, 0.6));
    add('Bad loans (gross NPA)', pct('grossNpa'), 'Loans not being repaid · good below 2%', grade(m.grossNpa, 2, 4, true));
    add('Capital buffer (CAR)', pct('car'), 'Cushion against losses · good above 15%', grade(m.car, 15, 12));
    if ([m.pb, m.pbMedian5y].every(Number.isFinite)) add('Price to book', num(m.pb) + '× vs ' + num(m.pbMedian5y) + '× usual',
      'What you pay per rupee of net worth · lower than usual is cheaper', grade(m.pb / m.pbMedian5y, 0.9, 1.1, true));
  } else {
    add('Return on capital (5-yr)', pct('roce5y'), 'Earned on every ₹100 invested · good above 15%', grade(m.roce5y, 15, 10));
    add('Sales growth a year (5-yr)', pct('salesCagr5y'), 'How fast the business grows · good above 10%', grade(m.salesCagr5y, 10, 5));
    add('Profit growth a year (5-yr)', pct('profitCagr5y'), 'Good above 12%', grade(m.profitCagr5y, 12, 5));
    add('Debt to equity', Number.isFinite(m.de) ? m.de.toFixed(2) + '×' : null, 'Borrowing vs owners’ money · good below 0.5', grade(m.de, 0.5, 1, true));
    if ([m.pe, m.peMedian5y].every(Number.isFinite)) add('P/E today vs usual', num(m.pe) + ' vs ' + num(m.peMedian5y),
      'Price per ₹1 of yearly profit · below its usual is cheaper', grade(m.pe / m.peMedian5y, 0.9, 1.1, true));
    if (Number.isFinite(m.pe) && m.profitCagr5y > 0) add('PEG (P/E ÷ growth)', num(m.pe / m.profitCagr5y),
      'Price compared with growth · good below 1.5', grade(m.pe / m.profitCagr5y, 1.5, 2.5, true));
    add('Years of positive cash flow', Number.isFinite(m.ocfPositiveYears) ? m.ocfPositiveYears + ' of 5' : null,
      'Real cash from the business · 5 of 5 is best', grade(m.ocfPositiveYears, 5, 4));
  }
  add('Profit, latest quarter vs a year ago', Number.isFinite(m.profitYoY) ? (m.profitYoY > 0 ? '+' : '') + num(m.profitYoY) + '%' : null,
    'Is growth continuing? · good above 10%', grade(m.profitYoY, 10, 0));
  add('Dividend yield', pct('divYield'), 'Cash paid out each year on the price · a bonus, not a must', Number.isFinite(m.divYield) && m.divYield >= 1.5 ? 'good' : null);
  add('Promoter holding', Number.isFinite(m.promoterHolding) ? num(m.promoterHolding) + '%' +
    (Number.isFinite(m.promoterChange) && m.promoterChange !== 0 ? ' (' + (m.promoterChange > 0 ? '+' : '') + num(m.promoterChange) + ' pts)' : '') : null,
    'Founders’ own stake · a falling stake is a warning', Number.isFinite(m.promoterChange) && m.promoterChange <= -1 ? 'weak' : null);
  if (Number.isFinite(card?.price) && Number.isFinite(m.high52) && Number.isFinite(m.low52)) add('52-week range',
    '₹' + num(m.low52) + ' – ₹' + num(m.high52), 'Today ₹' + num(card.price) + ', ' + num(Math.abs((card.price / m.high52 - 1) * 100)) + '% below the year’s high');
  return rows;
}
