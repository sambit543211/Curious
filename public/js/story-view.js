// Builds the article element for one story in the reader.
import { metricLabels, researchFooter, screenLabels } from '../investment-rules.js';
import { sourceLink } from '../edition-format.js';
import { icon, node } from './dom.js';
import { formatNumber, percent, rupees, trend } from './format.js';
import { cleanLabel, storyBlocks } from './story.js';

function table(label, headings, rows, numericFrom = 1) {
  const scroll = node('div', 'table-scroll');
  scroll.tabIndex = 0;
  scroll.setAttribute('role', 'region');
  scroll.setAttribute('aria-label', label);
  const element = node('table', 'data-table');
  element.append(node('caption', 'visually-hidden', label));
  const head = node('tr');
  headings.forEach((text, index) => {
    const cell = node('th', index >= numericFrom ? 'num' : '', text);
    cell.scope = 'col';
    head.append(cell);
  });
  const body = node('tbody');
  for (const values of rows) {
    const row = node('tr');
    values.forEach((value, index) => {
      const content = typeof value === 'object' && value ? value : {text:value};
      const cell = node(index ? 'td' : 'th', [index >= numericFrom ? 'num' : '', content.className].filter(Boolean).join(' '),
        String(content.text ?? '—'));
      if (!index) cell.scope = 'row';
      row.append(cell);
    });
    body.append(row);
  }
  const thead = node('thead');
  thead.append(head);
  element.append(thead, body);
  scroll.append(element);
  return scroll;
}
const change = value => ({text:percent(value), className:trend(value)});

function section(title, ...content) {
  const box = node('section', 'story-block');
  box.append(node('h3', '', title), ...content);
  return box;
}
const paragraph = text => node('p', '', text);
const list = items => {
  const element = node('ul', 'bullets');
  element.append(...items.map(item => node('li', '', item)));
  return element;
};
function disclosure(title, ...content) {
  const details = node('details', 'more');
  const summary = node('summary');
  summary.append(node('span', '', title), icon('down'));
  details.append(summary, ...content);
  return details;
}

function dashboard(card) {
  const lead = [];
  const later = [];
  const stamp = card.session === 'closed' ? 'Market closed · last session close' :
    (card.session === 'after-close' ? 'After the close · observed ' : 'As of ') + card.asOf;
  lead.push(node('p', 'data-stamp', stamp));
  lead.push(table('Market snapshot', ['Indicator', 'Level', 'Day'],
    card.rows.map(row => [row.name, formatNumber(row.level), change(row.d1)])));
  const {flows, niftyPE} = card;
  const facts = node('dl', 'facts');
  for (const [term, value] of [
    ['FII net', Number.isFinite(flows?.fii) ? '₹' + formatNumber(flows.fii) + ' cr' : '—'],
    ['DII net', Number.isFinite(flows?.dii) ? '₹' + formatNumber(flows.dii) + ' cr' : '—'],
    ['Nifty P/E', formatNumber(niftyPE?.now) + (Number.isFinite(niftyPE?.median5y) ? ' (5-yr median ' + formatNumber(niftyPE.median5y) + ')' : '')]
  ]) facts.append(node('dt', '', term), node('dd', '', value));
  lead.push(facts);

  later.push(section('Longer periods', table('Index changes over time', ['Indicator', 'Prev. close', 'Week', 'Month', 'YTD'],
    card.rows.map(row => [row.name, formatNumber(row.previousClose), change(row.w1), change(row.m1), change(row.ytd)]))));
  const notes = [...(card.dataQualityNotes ?? []), ...card.rows.filter(row => row.note).map(row => row.name + ': ' + row.note)];
  if (card.lastSession) notes.push('Last session: ' + card.lastSession);
  if (flows?.asOf || niftyPE?.asOf) notes.push('Flows as of ' + (flows?.asOf ?? '—') + ' · valuation as of ' + (niftyPE?.asOf ?? '—') +
    (Number.isFinite(flows?.fiiMtd) ? ' · month to date FII ₹' + formatNumber(flows.fiiMtd) + ' cr, DII ₹' + formatNumber(flows.diiMtd) + ' cr' : ''));
  if (notes.length) later.push(section('About this data', list(notes)));
  return {lead, later};
}

function stockPick(card) {
  const verdict = node('div', 'verdict-card');
  const top = node('p', 'verdict-line');
  top.append(node('span', 'verdict verdict-' + String(card.verdict).toLowerCase(), card.verdict),
    node('strong', '', 'Buy below ' + rupees(card.buyBelow)));
  verdict.append(top, node('p', 'verdict-meta', 'Price ' + rupees(card.price) + ' · Fair value ' + rupees(card.fairValue)));
  const lead = [verdict, section('The case', list(card.thesis ?? []))];
  if (card.moat) lead.push(section('Moat · ' + card.moat, paragraph(card.moatWhy)));
  if (card.breakers?.length) lead.push(section('What would break this', list(card.breakers)));
  const later = [
    section('Fundamentals', table('Fundamentals', ['Metric', 'Value'], Object.entries(card.metrics ?? {})
      .filter(([key, value]) => metricLabels[key] && Number.isFinite(value)).map(([key, value]) => [metricLabels[key], formatNumber(value)]))),
    section('Screen', table('Screen results', ['Test', 'Result'], Object.entries(card.screen ?? {})
      .map(([key, pass]) => [screenLabels[key] ?? key, {text:pass ? 'Pass' : 'Fail', className:pass ? 'up' : 'down'}]))),
    node('p', 'data-note', 'Fundamentals as of ' + card.dataDate + ' · quote from ' + card.quoteDate)
  ];
  return {lead, later};
}

function dataFor(topic, card) {
  if (card.kind === 'dashboard') return dashboard(card);
  if (card.slot === 'pick' || card.slot === 'weekly') return stockPick(card);
  const lead = [];
  if (card.slot === 'watchlist' && card.entries?.length) {
    lead.push(table('Watchlist', ['Stock', 'Signal', 'Close', 'Week'],
      card.entries.map(entry => [entry.symbol, entry.reason, rupees(entry.price), change(entry.weekly)])));
  }
  if (card.slot === 'learn' && card.exampleMetric) {
    const example = card.exampleMetric;
    lead.push(table('Worked example', ['Stock', 'Metric', 'Value'],
      [[example.symbol, metricLabels[example.metric] ?? example.metric, formatNumber(example.value)]], 2));
  }
  return {lead, later:card.dataDate && card.slot === 'watchlist' ? [node('p', 'data-note', 'Data as of ' + card.dataDate)] : []};
}

function sources(card) {
  const fallback = sourceLink(card.sourceUrl);
  const entries = card.sources ?? (fallback ? [{label:fallback.hostname.replace(/^www\./, ''), url:fallback.href}] : []);
  const links = entries.map(source => {
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
  if (!links.length) return null;
  const items = node('ul', 'sources');
  items.append(...links);
  return disclosure('Sources (' + links.length + ')', items);
}

export function renderArticle(story) {
  const {topic, card} = story;
  const article = node('article', 'article');
  const label = cleanLabel(topic, card.label);
  if (label) article.append(node('p', 'eyebrow', label));
  const title = node('h2', 'article-title', card.headline);
  title.id = 'reader-title';
  title.tabIndex = -1;
  article.append(title);
  if (topic === 'mind' && card.study) {
    article.append(node('p', 'byline', [card.study.authors, card.study.year && '(' + card.study.year + ')',
      card.study.sample && '· ' + card.study.sample + ' participants'].filter(Boolean).join(' ')));
  }
  const data = dataFor(topic, card);
  // Markets and stock picks lead with their numbers; other stories lead with the summary.
  const numbersFirst = card.kind === 'dashboard' || card.slot === 'pick' || card.slot === 'weekly';
  if (numbersFirst) article.append(...data.lead);
  if (card.summary) article.append(node('p', 'lede', card.summary));
  if (!numbersFirst) article.append(...data.lead);

  const {primary, more} = storyBlocks(topic, card);
  article.append(...primary.map(block => section(block.title, paragraph(block.text))));
  const extra = [...more.map(block => section(block.title, paragraph(block.text))), ...data.later];
  if (card.terms?.length) {
    const terms = node('dl', 'terms');
    terms.append(...card.terms.flatMap(({term, meaning}) => [node('dt', '', term), node('dd', '', meaning)]));
    extra.push(section('Terms', terms));
  }
  const tail = node('div', 'article-tail');
  if (extra.length) tail.append(disclosure('More on this story', ...extra));
  const links = sources(card);
  if (links) tail.append(links);
  if (tail.children.length) article.append(tail);
  if (topic === 'investing') article.append(node('p', 'disclaimer', researchFooter));
  return article;
}
