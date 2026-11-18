import { metricLabels, researchFooter, screenLabels } from './investment-rules.js';
import { getDeck, indianDay, isDay, isEdition, matchProgress, sectionIds, sourceLink, storyKey } from './edition-format.js';

const $ = id => document.getElementById(id);
const number = new Intl.NumberFormat('en-IN', {maximumFractionDigits:2});
const formatNumber = value => Number.isFinite(value) ? number.format(value) : '—';
const rupees = value => Number.isFinite(value) ? '₹' + formatNumber(value) : '—';
const change = value => Number.isFinite(value) ? (value > 0 ? '+' : '') + formatNumber(value) + '%' : '—';
const categories = {
  india: 'India',
  world: 'World',
  markets: 'Indian Markets',
  investing: 'Stock Investing',
  tech: 'AI & Tech',
  mind: 'Psychology',
  marketing: 'Marketing'
};
const paths = {
  india: 'M3 9h18L12 3 3 9Zm2 11h14M6 20V9m6 11V9m6 11V9',
  world: 'M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0ZM2 12h20M12 2a16 16 0 0 1 0 20m0-20a16 16 0 0 0 0 20',
  markets: 'M4 4v16h16M7 15l4-5 4 2 5-6m-4 0h4v4',
  investing: 'M5 20V9m5 11V4m5 16v-7m5 7V7',
  tech: 'M7 7h10v10H7zM4 9h3m-3 6h3m10-6h3m-3 6h3M9 4v3m6-3v3m-6 10v3m6-3v3',
  mind: 'M7 19v-2c-1.9-1.3-3-3.4-3-5.7a7 7 0 0 1 14-.7l2 3.4h-3v5h-5v2m-3-10a2 2 0 0 1 4 0',
  marketing: 'M3 10v4h4l3 6h3l-2-6 10 3V7l-10 3H3Zm4 0v4m4-4v4',
  calendar: 'M7 3v4m10-4v4M4 10h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z',
  settings: 'M4 7h16M4 12h16M4 17h16M8 5v4m8 1v4m-6 1v4',
  system: 'M4 5h16v11H4zM9 20h6m-3-4v4',
  sun: 'M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM12 2v2m0 16v2M2 12h2m16 0h2M5 5l2 2m10 10 2 2M19 5l-2 2M7 17l-2 2',
  moon: 'M20.5 15A8.8 8.8 0 0 1 9 3.5 8.8 8.8 0 1 0 20.5 15Z',
  left: 'M15 5l-7 7 7 7',
  right: 'm9 5 7 7-7 7',
  down: 'm6 9 6 6 6-6',
  arrow: 'M4 12h15m-6-6 6 6-6 6',
  close: 'm6 6 12 12M18 6 6 18',
  external: 'M13 5h6v6m0-6-9 9m-1-8H6a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1v-3',
  check: 'm5 12 5 5L20 7'
};
function node(tag, className, label) {
  const item = document.createElement(tag);
  if (className) item.className = className;
  if (label) item.textContent = label;
  return item;
}
function addIcon(slot, name) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  const path = document.createElementNS(svg.namespaceURI, 'path');
  for (const [key, value] of Object.entries({
    d:paths[name], fill:'none', stroke:'currentColor', 'stroke-width':'1.65',
    'stroke-linecap':'round', 'stroke-linejoin':'round'
  })) path.setAttribute(key, value);
  svg.append(path);
  slot.setAttribute('aria-hidden', 'true');
  slot.append(svg);
  return slot;
}
const icon = name => addIcon(node('span', 'icon-slot'), name);
for (const slot of document.querySelectorAll('[data-icon]')) addIcon(slot, slot.dataset.icon);

const releaseTime = new Intl.DateTimeFormat('en-IN', {hour:'numeric', minute:'2-digit', timeZone:'Asia/Kolkata'});
const briefDate = new Intl.DateTimeFormat('en-GB', {weekday:'short', day:'numeric', month:'short', year:'numeric',timeZone:'UTC'});
const monthDate = new Intl.DateTimeFormat('en-GB', {month:'long',year:'numeric',timeZone:'UTC'});
const format = (formatter, day) => formatter.format(new Date(day + 'T12:00:00Z'));
const legacyKey = day => 'morning-edition:read:' + day;
const editionKey = day => 'morning-edition:read:v2:' + day;

let edition;
let active = 'india';
let readingOrder = [];
let readerIndex = 0;
let readerOrder = [];
let readTimer;
let chapterTimer;
let touchStart;
let returnFocus;
let seen = new Set();
let catalog = [];
let bundled = new Map();
let remote = false;
let publishing = false;
let loading = false;
let loadVersion = 0;
let lastLookup = 0;
let checkingCatalog = false;
let worker;
let pushConfig;
const loaded = new Map();
const getTopics = () => sectionIds(edition);
const topicDeck = topic => getDeck(edition, topic);
const deck = () => topicDeck(active);
const storyRead = story => seen.has(story.key);
const countRead = topic => readingOrder.filter(story => story.topic === topic && storyRead(story)).length;
const currentQuery = () => new URLSearchParams(location.search).get('edition');

function storedEntries(key) {
  try {
    const entries = JSON.parse(localStorage.getItem(key) || '[]');
    return new Set(Array.isArray(entries) ? entries.filter(value => typeof value === 'string') : []);
  } catch { return new Set(); }
}

const savedProgress = issue => matchProgress(issue, storedEntries(editionKey(issue.date)), storedEntries(legacyKey(issue.date)));
function rememberProgress(issue, progress) {
  try { localStorage.setItem(editionKey(issue.date), JSON.stringify([...progress])); } catch { /* Reads still work in this session. */ }
}
function imageInto(container, card, caption) {
  const image = typeof card.image === 'object' ? card.image : {url:card.image, credit:card.imageCredit};
  const url = image && sourceLink(image.url);
  container.hidden = !url || !image.credit;
  container.querySelector('img')?.remove();
  if (container.hidden) return;
  const img = node('img');
  img.alt = image.alt ?? '';
  img.decoding = 'async';
  img.referrerPolicy = 'no-referrer';
  img.src = url.href;
  caption.textContent = image.credit;
  img.addEventListener('error', () => { if (img.isConnected) container.hidden = true; });
  container.prepend(img);
}

const words = card => ['headline','summary','why','soWhat','context','take','watch'].map(key => card[key])
  .concat(card.thesis ?? [], card.breakers ?? []).filter(Boolean).join(' ').trim().split(/\s+/).length;
const readingMinutes = list => Math.ceil(list.reduce((sum, story) => sum + words(story.card), 0) / 215);

function renderReaderProgress() {
  const progress = $('reader-segments');
  const remaining = readingOrder.filter(story => !storyRead(story));
  progress.setAttribute('aria-valuemin', '0');
  progress.setAttribute('aria-valuemax', String(readingOrder.length));
  progress.setAttribute('aria-valuenow', String(readingOrder.length - remaining.length));
  progress.replaceChildren(...getTopics().map(topic => {
    const group = node('span', 'segment-group');
    const entries = readingOrder.filter(story => story.topic === topic);
    group.style.flexGrow = entries.length;
    group.setAttribute('aria-hidden', 'true');
    for (const story of entries) {
      const segment = node('span', 'segment');
      segment.classList.toggle('is-read', storyRead(story));
      segment.classList.toggle('is-current', story === readerOrder[readerIndex]);
      group.append(segment);
    }
    return group;
  }));
  $('reader-minutes').textContent = remaining.length ? '~' + readingMinutes(remaining) + ' min left' : 'All read';
}
function updateProgress() {
  const read = readingOrder.filter(storyRead).length;
  const total = readingOrder.length;
  const complete = read === total;
  $('progress').max = total;
  $('progress').value = read;
  $('progress-text').textContent = complete ? 'Briefing complete' : read + ' of ' + total + ' read';
  const next = readingOrder.find(story => !storyRead(story));
  $('resume-label').textContent = complete ? 'Review briefing' : read ? 'Continue · ' + categories[next.topic] : 'Start reading';
  $('resume').disabled = loading;
  $('resume-topic-label').textContent = countRead(active) === deck().length ? 'Review topic' : 'Read next unread';
  const remaining = deck().length - countRead(active);
  $('section-remaining').textContent = remaining ? remaining + ' unread' : 'All read';
  for (const button of $('topics').children) {
    const id = button.dataset.category;
    const count = countRead(id);
    const length = topicDeck(id).length;
    button.setAttribute('aria-label', categories[id] + ', ' + count + ' of ' + length + ' read');
    button.setAttribute('aria-pressed', String(id === active));
    const counter = button.querySelector('small');
    counter.textContent = count === length ? '✓' : count;
    counter.style.setProperty('--read-angle', (count / length * 360) + 'deg');
    counter.classList.toggle('topic-complete', count === length);
  }
  if ($('reader').open) renderReaderProgress();
  for (const [index, button] of [...$('stories').children].entries()) {
    button.querySelector('.read-badge').hidden = !seen.has(storyKey(active, deck()[index], deck()));
  }
}
function createTopics() {
  $('topics').replaceChildren(...getTopics().map(id => {
    const button = node('button', 'topic');
    button.type = 'button';
    button.dataset.category = id;
    button.append(icon(id), node('span', 'topic-name', categories[id]), node('small'));
    button.addEventListener('click', () => {
      if (loading || active === id) return;
      active = id;
      renderSection();
    });
    return button;
  }));
}
function renderTopThree(list) {
  const entries = edition.top3?.map(pick => ({
    story:readingOrder.find(entry => entry.card.id === pick.cardId || entry.key === pick.cardId), line:pick.line
  })).filter(item => item.story) ?? ['india','world','tech'].map(topic => ({
    story:readingOrder.find(entry => entry.topic === topic)
  })).filter(item => item.story);
  list.replaceChildren(...entries.map(({story, line}) => {
    const row = node('li');
    const button = node('button', 'quick-story');
    button.type = 'button';
    button.append(node('span', 'story-meta', categories[story.topic]),
      node('span', 'quick-headline', line ?? story.card.headline), icon('right'));
    button.addEventListener('click', () => {
      if (!loading) openStory(button, story.topic, story.key);
    });
    row.append(button);
    return row;
  }));
  $('quick-brief').hidden = entries.length === 0;
}

function renderSection() {
  $('section-title').textContent = categories[active];
  $('resume-topic').hidden = false;
  $('stories').replaceChildren(...deck().map(card => {
    const button = node('button', 'story');
    button.type = 'button';
    const caption = node('span', 'story-caption');
    const meta = node('span', 'story-row-meta');
    meta.append(node('span', 'story-meta', card.label), node('span', 'read-badge', '✓ Read'));
    caption.append(meta, node('span', 'story-title', card.headline));
    button.append(caption, icon('arrow'));
    button.addEventListener('click', () => {
      if (!loading) openStory(button, active, storyKey(active, card, deck()));
    });
    return button;
  }));
  updateProgress();
}

function renderSources(card) {
  const fallback = sourceLink(card.sourceUrl);
  const sources = card.sources ?? (fallback ? [{label:fallback.hostname.replace(/^www\./, ''), url:fallback.href}] : []);
  const links = [];
  for (const source of sources) {
    const url = sourceLink(source.url);
    if (!url) continue;
    const link = node('a', 'source-link');
    link.append(icon('external'), node('span', '', source.label));
    link.href = url.href;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    links.push(link);
  }
  $('reader-sources').replaceChildren(...links);
  $('source-disclosure').hidden = links.length === 0;
  $('source-disclosure').open = false;
  $('source-summary').textContent = 'Sources (' + links.length + ')';
}

function detail(id, value) {
  $(id + '-box').hidden = !value;
  $(id).textContent = value ?? '';
}

function readerTable(label, headings, rows, changeColumns = []) {
  const scroll = node('div', 'table-scroll');
  scroll.tabIndex = 0;
  scroll.setAttribute('role', 'region');
  scroll.setAttribute('aria-label', label);
  const table = node('table', 'data-table');
  const caption = node('caption', 'visually-hidden', label);
  const head = node('thead');
  const header = node('tr');
  for (const text of headings) {
    const cell = node('th', '', text);
    cell.scope = 'col';
    header.append(cell);
  }
  head.append(header);
  const body = node('tbody');
  for (const values of rows) {
    const row = node('tr');
    for (const [index, value] of values.entries()) {
      const signed = changeColumns.includes(index);
      const cell = node(index === 0 ? 'th' : 'td',
        signed && Number.isFinite(value) ? (value > 0 ? 'positive' : value < 0 ? 'negative' : '') : '',
        signed ? change(value) : String(value ?? '—'));
      if (!index) cell.scope = 'row';
      row.append(cell);
    }
    body.append(row);
  }
  table.append(caption, head, body);
  scroll.append(table);
  return scroll;
}

function list(items) {
  const result = node('ul', 'research-list');
  result.append(...items.map(value => node('li', '', value)));
  return result;
}

function renderReaderData(topic, card) {
  const target = $('reader-data');
  target.replaceChildren();
  if (card.kind === 'dashboard') {
    target.append(node('p', 'data-stamp', card.session === 'closed' ?
      'Session closed · Last available close · Checked at ' + card.asOf :
      (card.session === 'after-close' ? 'After-close edition · Observed at ' : 'Data as of ') + card.asOf));
    for (const note of card.dataQualityNotes ?? []) target.append(node('p', 'data-note', note));
    for (const row of card.rows) if (row.note) target.append(node('p', 'data-note', row.name + ': ' + row.note));
    if (card.lastSession) target.append(node('p', 'data-note', 'Last session · ' + card.lastSession));
    target.append(readerTable('Market snapshot',
      ['Indicator','Level','Previous close','Day %','1 week %','1 month %','YTD %'],
      card.rows.map(row => [row.name,formatNumber(row.level),formatNumber(row.previousClose),row.d1,row.w1,row.m1,row.ytd]), [3,4,5,6]));
    const {flows, niftyPE} = card;
    target.append(readerTable('Flows and valuation', ['Indicator','Latest','Comparison'], [
      ['FII net flows (₹ crore)', formatNumber(flows.fii), 'MTD ' + formatNumber(flows.fiiMtd)],
      ['DII net flows (₹ crore)', formatNumber(flows.dii), 'MTD ' + formatNumber(flows.diiMtd)],
      ['Nifty P/E', formatNumber(niftyPE.now), '5-year median ' + formatNumber(niftyPE.median5y)]
    ]));
    target.append(node('p', 'data-note', 'Flows as of ' + flows.asOf + ' · Valuation as of ' + niftyPE.asOf));
    target.append(node('h3', 'data-subhead', 'What moved the market'));
  }
  if (card.slot === 'pick' || card.slot === 'weekly') {
    const lead = node('div', 'stock-verdict');
    lead.append(node('strong', 'verdict verdict-' + card.verdict.toLowerCase(), card.verdict),
      node('strong', '', 'Buy below ' + rupees(card.buyBelow)),
      node('span', '', 'Fair value ' + rupees(card.fairValue) + ' · Price ' + rupees(card.price)));
    target.append(lead, list(card.thesis));
    target.append(readerTable('Fundamentals', ['Metric','Value'],
      Object.entries(card.metrics).filter(([key,value]) => metricLabels[key] && Number.isFinite(value))
        .map(([key,value]) => [metricLabels[key],formatNumber(value)])));
    target.append(readerTable('Screen results', ['Test','Result'], Object.entries(card.screen)
      .map(([key,pass]) => [screenLabels[key] ?? key,pass ? '✓ Pass' : '× Fail'])));
    target.append(node('h3', 'data-subhead', 'Moat · ' + card.moat), node('p', 'data-note', card.moatWhy),
      node('h3', 'data-subhead', 'What would break this'), list(card.breakers),
      node('p', 'data-note', 'Fundamentals ' + card.dataDate + ' · Quote ' + card.quoteDate));
  }
  if (card.slot === 'watchlist') {
    if (card.entries?.length) target.append(readerTable('Watchlist', ['Stock','Signal','NSE close','Week %'],
      card.entries.map(entry => [entry.symbol,entry.reason,rupees(entry.price),entry.weekly]), [3]));
    if (card.dataDate) target.append(node('p', 'data-note', 'Data as of ' + card.dataDate));
  }
  if (card.slot === 'learn' && card.exampleMetric) {
    const example = card.exampleMetric;
    target.append(readerTable('Worked example', ['Stock','Metric','Value'],
      [[example.symbol,metricLabels[example.metric] ?? example.metric,formatNumber(example.value)]]));
  }
  if (topic === 'mind' && card.study) {
    target.append(node('p', 'data-note', card.study.authors + ' (' + card.study.year + ') · ' + card.study.sample + ' participants'));
  }
  $('research-notice').hidden = topic !== 'investing';
  $('research-notice').textContent = researchFooter;
}

function showStory(position) {
  readerIndex = position;
  const {topic, index, card} = readerOrder[position];
  const cover = $('reader-cover');
  imageInto(cover, card, $('reader-photo-note'));
  $('reader-topic').textContent = categories[topic];
  const positionText = (index + 1) + ' of ' + topicDeck(topic).length;
  $('reader-position').textContent = positionText;
  $('reader-label').textContent = card.label;
  $('reader-title').textContent = card.headline;
  $('reader-summary').textContent = card.summary;
  renderReaderData(topic, card);
  detail('reader-example', topic === 'mind' ? card.example : '');
  detail('reader-use', topic === 'mind' ? card.useThisWeek : topic === 'tech' ? card.tryThis : '');
  detail('reader-campaign', card.brand ? [card.brand, card.agency, card.objective, card.insight, card.channels, card.results].join(' · ') : '');
  detail('reader-why', card.why);
  detail('reader-valuation', card.valuation);
  detail('reader-risk', card.risk);
  $('why-label').textContent = {
    investing:'Competitive advantage', mind:'What may explain it', marketing:'Why this approach'
  }[topic] ?? 'Why it happened';
  detail('reader-context', card.soWhat ?? card.context);
  detail('reader-take', card.take);
  detail('reader-watch', card.watch);
  const terms = $('reader-terms');
  terms.hidden = !card.terms?.length;
  terms.replaceChildren(...(card.terms ?? []).flatMap(({term, meaning}) => [node('dt', '', term), node('dd', '', meaning)]));
  $('context-label').textContent = {
    investing:'Growth case and what to watch', markets:'Why it matters for markets', marketing:'Why it matters for marketers'
  }[topic] ?? 'Why it matters';
  renderSources(card);
  $('previous').disabled = position === 0;
  $('read-label').textContent = position === readerOrder.length - 1 ? 'Finish' : 'Next';
  $('read-icon').querySelector('path').setAttribute('d', paths[position === readerOrder.length - 1 ? 'check' : 'arrow']);
  $('reader-content').scrollTop = 0;
  renderReaderProgress();
  if ($('reader').open) {
    $('reader-announcement').textContent = categories[topic] + ', ' + positionText + '. ' + card.headline;
  }
}

function startReadTimer() {
  clearTimeout(readTimer);
  const story = readerOrder[readerIndex];
  if (!$('reader').open || !$('reader-transition').hidden || !$('reader-finish').hidden ||
      document.hidden || !story || storyRead(story)) return;
  readTimer = setTimeout(() => {
    if (document.hidden || story !== readerOrder[readerIndex] || !$('reader').open) return;
    for (const key of savedProgress(edition)) seen.add(key);
    seen.add(story.key);
    rememberProgress(edition, seen);
    updateProgress();
  }, 5000);
}

function openStory(trigger, topic, key) {
  readerOrder = readingOrder;
  const matchesTopic = story => !topic || story.topic === topic;
  const firstUnread = readerOrder.findIndex(story => matchesTopic(story) && !storyRead(story));
  const initial = key ? readerOrder.findIndex(story => story.key === key) :
    firstUnread >= 0 ? firstUnread : readerOrder.findIndex(matchesTopic);
  if (initial < 0) return;
  if (!$('reader').open) returnFocus = trigger;
  $('reader-actions').hidden = false;
  $('reader-finish').hidden = true;
  $('reader-transition').hidden = true;
  $('reader').setAttribute('aria-labelledby', 'reader-title');
  $('reader-content').hidden = false;
  showStory(initial);
  if (!$('reader').open) $('reader').showModal();
  $('reader-title').focus({preventScroll:true});
  startReadTimer();
}

function finishEdition() {
  clearTimeout(readTimer);
  $('reader-finish').hidden = false;
  $('reader-content').hidden = true;
  $('reader-actions').hidden = true;
  $('reader').setAttribute('aria-labelledby', 'reader-finish-title');
  $('reader-finish-count').textContent = readerOrder.length + ' stories · ~' + readingMinutes(readerOrder) + ' min';
  renderTopThree($('finish-stories'));
  const weekly = readerOrder.find(({card}) => card.slot === 'weekly');
  const note = $('finish-weekly');
  note.hidden = !weekly;
  note.textContent = weekly ? 'Buy of the week · ' + weekly.card.symbol : '';
  $('reader-finish-title').focus({preventScroll:true});
}

function moveStory(direction) {
  if (!$('reader').open || !$('reader-transition').hidden || !$('reader-finish').hidden) return;
  const next = readerIndex + direction;
  if (next < 0) return;
  if (next >= readerOrder.length) return finishEdition();
  clearTimeout(readTimer);
  const from = readerOrder[readerIndex].topic;
  const to = readerOrder[next].topic;
  if (direction > 0 && from !== to) {
    $('reader-transition').textContent = categories[to] + ' · ' + topicDeck(to).length + ' stories';
    $('reader-transition').hidden = false;
    $('reader-content').hidden = true;
    $('reader-actions').hidden = true;
    $('reader-transition').focus({preventScroll:true});
    chapterTimer = setTimeout(() => {
      $('reader-transition').hidden = true;
      $('reader-content').hidden = false;
      $('reader-actions').hidden = false;
      showStory(next);
      $('reader-title').focus({preventScroll:true});
      startReadTimer();
    }, 1000);
    return;
  }
  showStory(next);
  $('reader-title').focus({preventScroll:true});
  startReadTimer();
}

$('reader-close').addEventListener('click', () => $('reader').close());
$('finish-close').addEventListener('click', () => $('reader').close());
$('previous').addEventListener('click', () => moveStory(-1));
$('read').addEventListener('click', () => moveStory(1));
$('reader').addEventListener('close', () => {
  clearTimeout(readTimer);
  clearTimeout(chapterTimer);
  $('reader-actions').hidden = false;
  $('reader-announcement').textContent = '';
  if (returnFocus?.isConnected) returnFocus.focus({preventScroll:true});
});
document.addEventListener('visibilitychange', startReadTimer);
$('reader').addEventListener('keydown', event => {
  if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey ||
      event.target.closest('a, input, summary, .table-scroll')) return;
  const direction = {ArrowLeft:-1, ArrowRight:1}[event.key];
  if (direction) {
    event.preventDefault();
    moveStory(direction);
  }
});
$('reader-content').addEventListener('touchstart', event => {
  const touch = event.touches[0];
  touchStart = event.touches.length === 1 && !event.target.closest('a, button, summary, .table-scroll') ?
    {x:touch.clientX, y:touch.clientY, time:performance.now()} : null;
}, {passive:true});
$('reader-content').addEventListener('touchend', event => {
  if (!touchStart) return;
  const start = touchStart;
  touchStart = null;
  const end = event.changedTouches[0];
  const dx = end.clientX - start.x;
  const dy = end.clientY - start.y;
  if (Math.abs(dx) >= 55 && Math.abs(dx) > Math.abs(dy) * 1.5) return moveStory(dx < 0 ? 1 : -1);
  if (Math.abs(dx) > 9 || Math.abs(dy) > 9 || performance.now() - start.time > 260 ||
      String(window.getSelection())) return;
  const bounds = $('reader-content').getBoundingClientRect();
  const fraction = (end.clientX - bounds.left) / bounds.width;
  if (fraction < 1 / 3 || fraction > 2 / 3) moveStory(fraction > 2 / 3 ? 1 : -1);
}, {passive:true});
$('reader-content').addEventListener('touchcancel', () => { touchStart = null; }, {passive:true});
$('resume').addEventListener('click', () => openStory($('resume')));
$('resume-topic').addEventListener('click', () => {
  if (!loading) openStory($('resume-topic'), active);
});
window.addEventListener('storage', event => {
  if (!edition || (event.key !== editionKey(edition.date) && event.key !== legacyKey(edition.date))) return;
  seen = savedProgress(edition);
  updateProgress();
  if ($('archive').open) renderArchive();
});

async function jsonAt(path) {
  const response = await fetch(path, {cache:'no-cache'});
  if (!response.ok) throw new Error('Edition is unavailable');
  return response.json();
}
async function readCatalog() {
  checkingCatalog = true;
  lastLookup = Date.now();
  try {
    const [local, live] = await Promise.allSettled([
      jsonAt('/editions/index.json'),
      jsonAt('/api/editions')
    ]);
    for (const entry of local.value?.editions ?? []) {
      if (isDay(entry.date) && /^\/(first-edition\.json|editions\/\d{4}-\d{2}-\d{2}\.json)$/.test(entry.path)) bundled.set(entry.date, entry.path);
    }
    if (Array.isArray(live.value?.dates)) {
      remote = true;
      publishing = live.value.publishing === true || local.value?.publishing === true;
      catalog = [...new Set([...bundled.keys(), ...live.value.dates.filter(isDay)])].sort().reverse();
    } else {
      publishing ||= local.value?.publishing === true;
      catalog = [...new Set([...bundled.keys(), ...catalog])].sort().reverse();
    }
  } finally { checkingCatalog = false; }
}
async function fetchEdition(day) {
  const cached = loaded.get(day);
  if (cached) return cached;
  const paths = [];
  if (remote) paths.push('/api/edition?date=' + day);
  if (bundled.has(day)) paths.push(bundled.get(day));
  for (const path of paths) {
    try {
      const value = await jsonAt(path);
      if (isEdition(value) && value.date === day) {
        loaded.set(day, value);
        return value;
      }
    } catch {}
  }
  throw new Error('Could not load this edition');
}
function updateToolbar() {
  const index = catalog.indexOf(edition?.date);
  $('older').disabled = loading || index < 0 || index === catalog.length - 1;
  $('newer').disabled = loading || index <= 0;
  $('pick-date').disabled = loading || !edition;
  $('resume-topic').disabled = loading;
  $('back-latest').hidden = index <= 0;
  $('back-latest').disabled = loading;
}
function setRoute(day, mode) {
  const url = new URL(location.href);
  if (mode === 'replace' || mode === 'latest') url.searchParams.delete('edition');
  else url.searchParams.set('edition', day);
  if (url.href === location.href) return;
  if (mode === 'replace') history.replaceState({}, '', url);
  else history.pushState({}, '', url);
}
function renderEdition() {
  const latest = edition.date === catalog[0];
  const today = edition.date === indianDay();
  $('top-title').textContent = today ? 'Today’s Top 3' : 'Top 3 for this edition';
  $('edition-kind').textContent = edition.publicationMode === 'late' ? 'Late edition' : latest ? (today ? 'Today’s edition' : 'Latest edition') : 'From the archive';
  $('selected-date').textContent = format(briefDate, edition.date);
  readingOrder = getTopics().flatMap(topic =>
    topicDeck(topic).map((card, index) => ({topic, index, card, key:storyKey(topic, card, topicDeck(topic))}))
  );
  const timestamp = edition.publishedAt ?? edition.preparedAt;
  const time = $('release-time');
  time.hidden = !timestamp || !Number.isFinite(Date.parse(timestamp));
  if (!time.hidden) {
    time.dateTime = timestamp;
    time.textContent = (edition.publishedAt ? 'Published ' : 'Prepared ') + releaseTime.format(new Date(timestamp)) + ' IST';
  }
  const preparing = publishing && latest && edition.date < indianDay();
  $('edition-note').textContent = preparing ? 'Today’s edition is pending. Showing the latest available.' : edition.publicationMode === 'late' ? 'Published after the morning target. Market observations show their actual times; unavailable figures are marked.' : '';
  renderTopThree($('quick-stories'));
  createTopics();
  renderSection();
}
async function selectEdition(day, mode = 'push') {
  if (!catalog.includes(day)) return false;
  if (edition?.date === day && !loading) {
    if (mode !== 'none') setRoute(day, mode);
    return true;
  }
  const version = ++loadVersion;
  loading = true;
  updateToolbar();
  $('resume').disabled = true;
  $('story-section').setAttribute('aria-busy', 'true');
  try {
    const value = await fetchEdition(day);
    if (version !== loadVersion) return false;
    edition = value;
    seen = savedProgress(value);
    if (seen.size) rememberProgress(value, seen);
    if (!topicDeck(active).length) active = 'india';
    if (mode !== 'none') setRoute(day, mode);
    renderEdition();
    return true;
  } catch {
    if (version === loadVersion) $('edition-note').textContent = 'Couldn’t load this edition. Try again when you’re online.';
    return false;
  } finally {
    if (version === loadVersion) {
      loading = false;
      updateToolbar();
      $('resume').disabled = !edition;
      $('story-section').setAttribute('aria-busy', 'false');
    }
  }
}

function renderArchive() {
  const groups = new Map();
  for (const day of catalog) {
    const month = day.slice(0, 7);
    if (!groups.has(month)) groups.set(month, []);
    groups.get(month).push(day);
  }
  $('archive-dates').replaceChildren(...[...groups.values()].map(days => {
    const group = node('section');
    group.append(node('h3', 'archive-month', format(monthDate, days[0])));
    for (const day of days) {
      const button = node('button', 'archive-row');
      button.type = 'button';
      if (day === edition?.date) button.setAttribute('aria-current', 'date');
      const status = node('span', 'archive-progress', day === catalog[0] ? 'Latest' : 'Unread');
      const progressLabel = issue => {
        const count = savedProgress(issue).size;
        const total = sectionIds(issue).reduce((sum, topic) => sum + getDeck(issue, topic).length, 0);
        return count === total ? 'Complete' : count ? count + ' of ' + total + ' read' : day === catalog[0] ? 'Latest' : 'Unread';
      };
      if (loaded.has(day)) status.textContent = progressLabel(loaded.get(day));
      else if (storedEntries(editionKey(day)).size || storedEntries(legacyKey(day)).size) {
        status.textContent = 'Checking progress…';
        fetchEdition(day).then(issue => { status.textContent = progressLabel(issue); })
          .catch(() => { status.textContent = 'Progress unavailable'; });
      }
      button.append(node('span', 'archive-date', format(briefDate, day)), status, icon('right'));
      button.addEventListener('click', () => chooseArchived(day));
      group.append(button);
    }
    return group;
  }));
}
function openArchive() {
  if (!catalog.length) return;
  $('archive-message').textContent = '';
  $('find-date').min = catalog.at(-1);
  $('find-date').max = catalog[0];
  $('find-date').value = edition?.date ?? catalog[0];
  renderArchive();
  $('archive').showModal();
}
async function chooseArchived(day) {
  if (!catalog.includes(day)) {
    $('archive-message').textContent = 'There’s no published edition on that date. Choose an available date below.';
    return;
  }
  if (loading) return;
  $('archive-message').textContent = 'Opening edition…';
  if (await selectEdition(day)) {
    $('archive').close();
    $('pick-date').focus({preventScroll:true});
  } else $('archive-message').textContent = 'Couldn’t open this edition. Try again when you’re online.';
}
$('pick-date').addEventListener('click', openArchive);
$('archive-close').addEventListener('click', () => $('archive').close());
$('find-edition').addEventListener('submit', event => {
  event.preventDefault();
  chooseArchived($('find-date').value);
});
$('older').addEventListener('click', () => selectEdition(catalog[catalog.indexOf(edition.date) + 1]));
$('newer').addEventListener('click', () => selectEdition(catalog[catalog.indexOf(edition.date) - 1]));
$('back-latest').addEventListener('click', () => selectEdition(catalog[0], 'latest'));
window.addEventListener('popstate', () => {
  if ($('reader').open) $('reader').close();
  selectEdition(currentQuery() || catalog[0], 'none');
});

async function initialize() {
  await readCatalog();
  const requested = currentQuery();
  const publishedLink = catalog.includes(requested);
  if (!catalog.length || !await selectEdition(publishedLink ? requested : catalog[0], publishedLink ? 'none' : 'replace')) {
    $('stories').textContent = 'Couldn’t load the briefing. Refresh this page to try again.';
    return;
  }
  if (requested && !catalog.includes(requested)) $('edition-note').textContent = 'That date has no published edition. Showing the latest available.';
}
document.addEventListener('visibilitychange', async () => {
  if (document.hidden || checkingCatalog || Date.now() - lastLookup < 60000) return;
  const formerLatest = catalog[0];
  await readCatalog();
  if (edition && !currentQuery() && !loading && !$('reader').open && !$('archive').open && catalog[0] !== formerLatest) {
    await selectEdition(catalog[0], 'replace');
  } else if (edition && catalog[0] !== formerLatest) {
    $('edition-kind').textContent = 'From the archive';
    updateToolbar();
    if ($('archive').open) renderArchive();
  }
});
initialize().catch(() => {
  $('stories').textContent = 'Couldn’t load the briefing. Refresh this page to try again.';
  $('story-section').setAttribute('aria-busy', 'false');
});

$('settings').addEventListener('click', async () => {
  $('settings-dialog').showModal();
  if (pushConfig) return;
  const button = $('enable-push');
  const status = $('push-status');
  button.disabled = true;
  try {
    pushConfig = await jsonAt('/api/push');
    if (!pushConfig.publicKey) throw new Error();
    $('push-instructions').hidden = false;
    button.hidden = false;
    button.disabled = false;
    status.textContent = '';
  } catch {
    pushConfig = null;
    button.hidden = true;
    status.textContent = 'Morning alerts are currently unavailable.';
  }
});
$('settings-close').addEventListener('click', () => $('settings-dialog').close());
function pushKey(value) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')), char => char.charCodeAt(0));
}
$('enable-push').addEventListener('click', async () => {
  const button = $('enable-push');
  const status = $('push-status');
  if (!worker || !('PushManager' in window) || !('Notification' in window)) {
    status.textContent = 'Open the installed Home Screen app on iPhone to enable alerts.';
    return;
  }
  button.disabled = true;
  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') throw new Error('Allow notifications in your device settings to enable alerts.');
    let subscription = await worker.pushManager.getSubscription();
    subscription ??= await worker.pushManager.subscribe({userVisibleOnly:true, applicationServerKey:pushKey(pushConfig.publicKey)});
    const response = await fetch('/api/push', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(subscription)});
    if (!response.ok) throw new Error('Could not save your subscription. Try again.');
    status.textContent = 'Notifications are enabled on this device.';
  } catch (error) { status.textContent = error.message; }
  finally { button.disabled = false; }
});
if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js')
  .then(() => navigator.serviceWorker.ready)
  .then(registration => { worker = registration; })
  .catch(() => {});
