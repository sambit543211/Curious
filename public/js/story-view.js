// Builds the article for one story in the reader.
import { metricLabels, researchFooter, screenLabels } from '../investment-rules.js';
import { sourceLink } from '../edition-format.js';
import { icon, node } from './dom.js';
import { dayAndMonth, formatNumber, percent, rupees, trend } from './format.js';
import { cleanLabel, sourceCount, storyBlocks, storyMinutes } from './story.js';

const arrow = value => Number.isFinite(value) && value !== 0 ? (value > 0 ? '▲ ' : '▼ ') + formatNumber(Math.abs(value)) + '%' : percent(value);
const changeSpan = (value, tag = 'span', className = '') => node(tag, [className, trend(value)].filter(Boolean).join(' '), arrow(value));

function block(title, content, className = 'block') {
  const box = node('section', className);
  box.append(node('h3', '', title));
  box.append(...[].concat(content).map(item => typeof item === 'string' ? node('p', '', item) : item));
  return box;
}
function checklist(items, risky = false) {
  const list = node('ul', 'checks' + (risky ? ' risks' : ''));
  list.append(...items.map(text => {
    const item = node('li');
    item.append(icon(risky ? 'cross' : 'check'), node('span', '', text));
    return item;
  }));
  return list;
}
function disclosure(title, ...content) {
  const details = node('details', 'more');
  const summary = node('summary');
  summary.append(node('span', '', title), icon('down'));
  const body = node('div', 'more-body');
  body.append(...content);
  details.append(summary, body);
  return details;
}
function table(label, headings, rows) {
  const scroll = node('div', 'table-scroll');
  scroll.tabIndex = 0;
  scroll.setAttribute('role', 'region');
  scroll.setAttribute('aria-label', label);
  const element = node('table', 'data-table');
  element.append(node('caption', 'visually-hidden', label));
  const head = node('tr');
  headings.forEach((text, index) => {
    const cell = node('th', index ? 'numeric' : '', text);
    cell.scope = 'col';
    head.append(cell);
  });
  const thead = node('thead');
  thead.append(head);
  const body = node('tbody');
  for (const values of rows) {
    const row = node('tr');
    values.forEach((value, index) => {
      const content = value instanceof Node ? value : null;
      const cell = node(index ? 'td' : 'th', index ? 'numeric' : '', content ? '' : String(value ?? '—'));
      if (content) cell.append(content);
      if (!index) cell.scope = 'row';
      row.append(cell);
    });
    body.append(row);
  }
  element.append(thead, body);
  scroll.append(element);
  return scroll;
}
function stat(name, value, change, className = 'stat') {
  const box = node('div', className);
  box.append(node('span', 'stat-name', name), node('span', 'stat-value', value));
  if (change !== undefined) box.append(changeSpan(change, 'span', 'stat-change'));
  return box;
}

const marketName = name => ({'₹/US$':'₹ per US$', 'Gold (₹/10 g)':'Gold · ₹/10 g', 'Nifty Midcap 150':'Midcap 150',
  'Nifty Smallcap 250':'Smallcap 250', 'India 10-year G-sec yield':'10-year G-sec', 'Brent':'Brent · $/bbl'})[name] ?? name;
export const marketStamp = card => card.session === 'closed' ? 'Last session close' :
  (card.session === 'after-close' ? 'After the close · ' : 'Opening snapshot · ') + card.asOf;

function dashboard(card) {
  const lead = [];
  const stamp = node('span', 'stamp' + (card.session === 'closed' ? ' is-closed' : ''), marketStamp(card));
  lead.push(stamp);
  const [first, ...rest] = [card.rows.slice(0, 4), card.rows.slice(4)];
  const tiles = node('div', 'grid-2');
  tiles.append(...first.map(row => stat(marketName(row.name), formatNumber(row.level), row.d1)));
  lead.push(tiles);
  if (rest[0].length) {
    const rows = node('div', 'rows');
    rows.append(...rest[0].map(row => {
      const line = node('div');
      const value = node('span', '', formatNumber(row.level) + ' ');
      value.append(changeSpan(row.d1, 'em'));
      line.append(node('span', '', marketName(row.name)), value);
      return line;
    }));
    lead.push(rows);
  }
  const {flows, niftyPE} = card;
  if (Number.isFinite(flows?.fii) || Number.isFinite(flows?.dii)) {
    const money = value => Number.isFinite(value) ? (value >= 0 ? '+' : '−') + '₹' + formatNumber(Math.round(Math.abs(value))) + ' cr' : '—';
    const flowTiles = node('div', 'grid-2');
    flowTiles.append(stat('FII net' + (flows.asOf ? ', ' + flows.asOf.slice(8) + '/' + flows.asOf.slice(5, 7) : ''), money(flows.fii), undefined, 'stat is-tint'),
      stat('DII net', money(flows.dii), undefined, 'stat is-tint'));
    lead.push(flowTiles);
  }
  if (Number.isFinite(niftyPE?.now) && Number.isFinite(niftyPE?.median5y)) {
    const low = Math.min(niftyPE.now, niftyPE.median5y) * 0.8;
    const high = Math.max(niftyPE.now, niftyPE.median5y) * 1.2;
    const at = value => ((value - low) / (high - low) * 100).toFixed(1) + '%';
    const gauge = node('div', 'gauge');
    const labels = node('div', 'gauge-labels');
    labels.append(node('span', '', 'Nifty P/E ' + formatNumber(niftyPE.now)), node('span', '', '5-year median ' + formatNumber(niftyPE.median5y)));
    const track = node('div', 'gauge-track');
    const fill = node('span', 'gauge-fill');
    fill.style.width = at(niftyPE.now);
    const mark = node('span', 'gauge-mark');
    mark.style.left = at(niftyPE.median5y);
    track.append(fill, mark);
    track.setAttribute('role', 'img');
    track.setAttribute('aria-label', 'Nifty P/E ' + formatNumber(niftyPE.now) + (niftyPE.now < niftyPE.median5y ? ', below' : ', above') + ' its five-year median of ' + formatNumber(niftyPE.median5y));
    gauge.append(labels, track);
    lead.push(gauge);
  }
  const later = [block('Longer periods', table('Index changes over time', ['', 'Prev. close', 'Week', 'Month', 'YTD'],
    card.rows.map(row => [marketName(row.name), formatNumber(row.previousClose), changeSpan(row.w1), changeSpan(row.m1), changeSpan(row.ytd)])))];
  const notes = [...(card.dataQualityNotes ?? []), ...card.rows.filter(row => row.note).map(row => row.name + ': ' + row.note)];
  if (card.lastSession) notes.push('Last session: ' + card.lastSession);
  if (flows?.asOf || niftyPE?.asOf) notes.push('Flows as of ' + (flows?.asOf ?? '—') + ' · valuation as of ' + (niftyPE?.asOf ?? '—') +
    (Number.isFinite(flows?.fiiMtd) ? ' · month to date: FII ₹' + formatNumber(flows.fiiMtd) + ' cr, DII ₹' + formatNumber(flows.diiMtd) + ' cr' : ''));
  if (notes.length) {
    const list = node('ul', 'checks');
    list.append(...notes.map(text => node('li', 'fine', text)));
    later.push(block('About this data', list));
  }
  return {lead, later};
}

const keyMetrics = {financial:['roa', 'grossNpa', 'car', 'pb'], other:['roce5y', 'de', 'salesCagr5y', 'profitCagr5y']};
const shortMetric = {roa:'ROA', grossNpa:'Gross NPA', car:'Capital adequacy', pb:'P/B', roce5y:'ROCE 5y', de:'Debt/equity', salesCagr5y:'Sales CAGR', profitCagr5y:'Profit CAGR'};
const percentMetric = new Set(['roa', 'grossNpa', 'car', 'roce5y', 'salesCagr5y', 'profitCagr5y']);

function priceScale(card) {
  const {price, buyBelow, fairValue} = card;
  if (![price, buyBelow].every(Number.isFinite)) return null;
  const waitTop = buyBelow * 1.2;
  const low = Math.min(price, buyBelow) * 0.93;
  const high = Math.max(fairValue ?? 0, waitTop, price) * 1.05;
  const at = value => Math.min(100, Math.max(0, (value - low) / (high - low) * 100));
  const scale = node('div', 'scale');
  scale.setAttribute('role', 'img');
  scale.setAttribute('aria-label', 'Price ' + rupees(price) + (price <= buyBelow ? ' is inside' : ' is outside') + ' the buy zone below ' + rupees(buyBelow) +
    (Number.isFinite(fairValue) ? '. Fair value ' + rupees(fairValue) + '.' : '.'));
  const track = node('div', 'scale-track');
  const zone = (className, from, to) => {
    const element = node('span', 'scale-zone ' + className);
    element.style.left = from + '%';
    element.style.width = (to - from) + '%';
    return element;
  };
  track.append(zone('buy', 0, at(buyBelow)), zone('wait', at(buyBelow), at(waitTop)), zone('avoid', at(waitTop), 100));
  if (Number.isFinite(fairValue)) {
    const fair = node('span', 'scale-fair');
    fair.style.left = at(fairValue) + '%';
    track.append(fair);
  }
  const marker = node('span', 'scale-price');
  marker.style.left = at(price) + '%';
  track.append(marker);
  const labels = node('div', 'scale-labels');
  const buyLabel = node('span', '', 'Buy zone');
  buyLabel.style.left = '0';
  const waitLabel = node('span', '', 'Wait');
  waitLabel.style.left = at(buyBelow) + 2 + '%';
  labels.append(buyLabel, waitLabel);
  if (Number.isFinite(fairValue)) {
    const fairLabel = node('span', '', 'Fair ' + rupees(Math.round(fairValue)));
    fairLabel.style.right = '0';
    labels.append(fairLabel);
  }
  scale.append(track, labels);
  return scale;
}

function stockPick(card) {
  const verdict = node('section', 'verdict-card');
  const top = node('div', 'verdict-top');
  top.append(node('span', 'tag tag-' + String(card.verdict).toLowerCase(), card.verdict), node('span', '', 'Close ' + dayAndMonth(card.quoteDate)));
  const prices = node('div', 'verdict-prices');
  const now = node('span');
  now.append(node('small', '', 'Price'), node('strong', '', rupees(card.price)));
  const limit = node('span');
  limit.append(node('small', '', 'Buy below'), node('strong', '', rupees(Math.round(card.buyBelow))));
  prices.append(now, limit);
  verdict.append(top, prices);
  const scale = priceScale(card);
  if (scale) verdict.append(scale);
  if ([card.price, card.buyBelow].every(Number.isFinite)) {
    const gap = (card.price / card.buyBelow - 1) * 100;
    const fairGap = Number.isFinite(card.fairValue) ? (card.price / card.fairValue - 1) * 100 : null;
    const part = (value, what) => formatNumber(Math.abs(Math.round(value * 10) / 10)) + '% ' + (value <= 0 ? 'below ' : 'above ') + what;
    verdict.append(node('p', 'verdict-note', part(gap, 'the buy price') + (fairGap === null ? '.' : ', ' + part(fairGap, 'fair value') + '.')));
  }
  const lead = [verdict];
  if (card.thesis?.length) lead.push(block('The case', checklist(card.thesis)));
  const kind = card.kind === 'bank' || card.kind === 'nbfc' ? 'financial' : 'other';
  const metrics = keyMetrics[kind].filter(key => Number.isFinite(card.metrics?.[key]));
  if (metrics.length) {
    const grid = node('div', 'grid-4');
    grid.append(...metrics.map(key => stat(shortMetric[key], formatNumber(card.metrics[key]) + (percentMetric.has(key) ? '%' : ''))));
    lead.push(grid);
  }
  const after = [];
  if (card.breakers?.length) after.push(block('What would break this', checklist(card.breakers, true)));
  const later = [];
  if (card.moat) later.push(block('Moat · ' + card.moat, card.moatWhy ?? ''));
  later.push(block('All fundamentals', table('Fundamentals', ['Metric', 'Value'], Object.entries(card.metrics ?? {})
    .filter(([key, value]) => metricLabels[key] && Number.isFinite(value)).map(([key, value]) => [metricLabels[key], formatNumber(value)]))));
  later.push(block('Screen', table('Screen results', ['Test', 'Result'], Object.entries(card.screen ?? {})
    .map(([key, pass]) => [screenLabels[key] ?? key, node('span', pass ? 'up' : 'down', pass ? 'Pass' : 'Fail')]))));
  later.push(node('p', 'fine', 'Fundamentals as of ' + card.dataDate + ' · quote from ' + card.quoteDate));
  return {lead, after, later};
}

function dataFor(topic, card) {
  if (card.kind === 'dashboard') return {...dashboard(card), first:true};
  if (card.slot === 'pick' || card.slot === 'weekly') return {...stockPick(card), first:true};
  const lead = [];
  if (card.slot === 'watchlist' && card.entries?.length) {
    lead.push(table('Watchlist', ['Stock', 'Signal', 'Close', 'Week'],
      card.entries.map(entry => [entry.symbol, entry.reason, rupees(entry.price), changeSpan(entry.weekly)])));
  }
  if (card.slot === 'learn' && card.exampleMetric) {
    const example = card.exampleMetric;
    lead.push(stat(example.symbol + ' · ' + (metricLabels[example.metric] ?? example.metric), formatNumber(example.value)));
  }
  return {lead, later:card.dataDate && card.slot === 'watchlist' ? [node('p', 'fine', 'Data as of ' + card.dataDate)] : []};
}

function sources(card) {
  const fallback = sourceLink(card.sourceUrl);
  const entries = card.sources ?? (fallback ? [{label:fallback.hostname.replace(/^www\./, ''), url:fallback.href}] : []);
  const items = entries.map(source => {
    const url = sourceLink(source.url);
    if (!url) return null;
    const link = node('a', 'source-link');
    link.href = url.href;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.append(node('span', '', source.label), icon('external'));
    const item = node('li');
    item.append(link);
    return item;
  }).filter(Boolean);
  if (!items.length) return null;
  const list = node('ul', 'sources');
  list.append(...items);
  return disclosure('Sources (' + items.length + ')', list);
}

export function renderArticle(story) {
  const {topic, card} = story;
  const article = node('article', 'article');
  const head = node('div', 'article-head');
  const metaParts = [];
  const label = cleanLabel(topic, card.label);
  if (card.symbol) metaParts.push('NSE: ' + card.symbol, card.sector, card.moat && 'Moat: ' + card.moat.toLowerCase());
  else {
    if (label && card.kind !== 'dashboard') metaParts.push(label);
    metaParts.push(storyMinutes(card) + ' min read');
    const count = sourceCount(card);
    if (count) metaParts.push(count + (count === 1 ? ' source' : ' sources'));
  }
  if (topic === 'mind' && card.study) metaParts.push([card.study.authors, card.study.year && '(' + card.study.year + ')'].filter(Boolean).join(' '));
  head.append(node('p', 'article-meta', metaParts.filter(Boolean).join(' · ')));
  const title = node('h2', 'article-title', card.headline);
  title.id = 'reader-title';
  title.tabIndex = -1;
  head.append(title);
  article.append(head);

  const data = dataFor(topic, card);
  if (data.first) article.append(...data.lead);
  if (card.summary) article.append(node('p', 'lede', card.summary));
  if (!data.first) article.append(...data.lead);
  const {primary, more} = storyBlocks(topic, card);
  primary.forEach((item, index) => article.append(block(item.title, item.text, index ? 'block' : 'block callout')));
  article.append(...(data.after ?? []));

  const extra = [...more.map(item => block(item.title, item.text)), ...data.later];
  if (card.terms?.length) {
    const terms = node('dl', 'terms');
    terms.append(...card.terms.flatMap(({term, meaning}) => [node('dt', '', term), node('dd', '', meaning)]));
    extra.push(block('Terms', terms));
  }
  const tail = node('div', 'tail');
  if (extra.length) tail.append(disclosure(card.kind === 'dashboard' ? 'More market detail' : card.symbol ? 'Fundamentals and screen' : 'Background and my take', ...extra));
  const links = sources(card);
  if (links) tail.append(links);
  if (tail.children.length) article.append(tail);
  if (topic === 'investing') article.append(node('p', 'fine', researchFooter));
  return article;
}
