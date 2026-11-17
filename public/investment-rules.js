export const researchFooter = 'AI-generated research, not advice from a SEBI-registered analyst. Verify before investing.';
export const moatTypes = ['Monopoly/duopoly', 'Network effect', 'Switching cost', 'Regulated asset', 'Brand', 'Cost leadership', 'None'];

export const metricLabels = {
  roce5y:'5-year average ROCE (%)', de:'Debt / equity', salesCagr5y:'5-year sales CAGR (%)',
  profitCagr5y:'5-year profit CAGR (%)', ocfPositiveYears:'Years with positive operating cash flow',
  pe:'Trailing P/E', peMedian5y:'5-year median P/E', peg:'PEG', eps:'Trailing EPS (₹)',
  pb:'P/B', pbMedian5y:'5-year median P/B', bvps:'Book value per share (₹)',
  roa:'ROA (%)', grossNpa:'Gross NPA (%)', car:'Capital adequacy (%)', divYield:'Dividend yield (%)',
  promoterHolding:'Promoter holding (%)', pledge:'Promoter pledge (%)',
  marketCap:'Market cap (₹ crore)', avgDailyValue:'Average daily traded value (₹ crore)'
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
    pledge:finite(m.pledge) && m.pledge >= 0 && m.pledge < 5,
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
  const pass = Object.values(screen).every(Boolean) && positive(stock.price) && positive(buyBelow);
  const verdict = !pass || stock.price > cents(buyBelow * 1.2) ? 'Avoid' : stock.price <= buyBelow ? 'Buy' : 'Wait';
  return {screen, pass, fairValue, buyBelow, verdict};
}
