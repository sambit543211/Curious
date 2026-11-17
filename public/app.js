import { indianDay, isDay, isEdition, matchProgress, nextUnread, sourceLink, storyKey, topicIds } from './edition-format.js';

const $ = id => document.getElementById(id);
const categories = {
  india: 'India',
  world: 'World',
  markets: 'Indian Markets',
  investing: 'Stock Investing',
  tech: 'AI & Tech',
  mind: 'Mind & Evolution',
  marketing: 'Marketing World'
};
const photoNotes = {
  '/images/phuket.jpg': 'File photo · Phuket Old Town',
  '/images/auto-factory.jpg': 'Illustrative photo · Car assembly'
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
  bell: 'M5 17h14l-2-3V9a5 5 0 1 0-10 0v5l-2 3Zm5 3a2 2 0 0 0 4 0',
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
let reviewMode = false;
let readerScope;
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
const getTopics = () => topicIds.filter(id => edition.sections[id]);
const deck = () => edition.sections[active];
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
const defaultCover = topic => '/images/' + (topic === 'investing' ? 'charts' : topic) + '.jpg';
const showCover = (card, topic) => card.image && card.image !== defaultCover(topic) && topic !== 'investing';

function imageInto(container, card, topic, eager = false, caption) {
  const img = node('img');
  const fallback = defaultCover(topic);
  img.alt = '';
  img.loading = eager ? 'eager' : 'lazy';
  img.decoding = 'async';
  img.src = /^\/images\/[a-z0-9-]+\.jpg$/.test(card.image || '') ? card.image : fallback;
  if (caption) {
    caption.hidden = false;
    const path = img.getAttribute('src');
    caption.textContent = photoNotes[path] ?? 'Illustrative photo';
    if (path === '/images/guppy.jpg') {
      const credit = node('a', '', 'Trinidadian guppy · Deacon et al.');
      credit.href = 'https://github.com/sambit543211/Curious#photo-credits';
      credit.target = '_blank';
      credit.rel = 'noopener noreferrer';
      caption.replaceChildren(credit);
    }
  }
  img.addEventListener('error', () => {
    if (img.getAttribute('src') !== fallback) {
      img.src = fallback;
      if (caption && img.isConnected) caption.textContent = 'Illustrative photo';
    } else if (img.isConnected) {
      img.remove();
      if (caption) caption.hidden = true;
    }
  });
  container.prepend(img);
}
function updateProgress() {
  const read = readingOrder.filter(storyRead).length;
  const total = readingOrder.length;
  const complete = read === total;
  $('progress').max = total;
  $('progress').value = read;
  $('progress-text').textContent = complete ? 'Briefing complete' : read + ' of ' + total + ' read';
  const next = readingOrder.find(story => !storyRead(story));
  $('resume-label').textContent = complete ? 'Review briefing' : read ? 'Continue · ' + categories[next.topic] : 'Start briefing';
  $('resume').disabled = loading;
  $('resume-topic-label').textContent = countRead(active) === deck().length ? 'Review topic' : 'Read next unread';
  const remaining = deck().length - countRead(active);
  $('section-remaining').textContent = remaining ? remaining + ' unread' : 'All read';
  for (const button of $('topics').children) {
    const id = button.dataset.category;
    const count = countRead(id);
    const length = edition.sections[id].length;
    button.setAttribute('aria-label', categories[id] + ', ' + count + ' of ' + length + ' read');
    button.setAttribute('aria-pressed', String(id === active));
    const counter = button.querySelector('small');
    counter.textContent = count === length ? '✓' : count + '/' + length;
    counter.classList.toggle('topic-complete', count === length);
  }
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
function renderQuickBrief() {
  $('quick-stories').replaceChildren(...['india', 'world', 'markets', 'tech'].map(topic => {
    const story = readingOrder.find(item => item.topic === topic);
    const row = node('li');
    const button = node('button', 'quick-story');
    button.type = 'button';
    button.append(node('span', 'story-meta', categories[topic]), node('span', 'quick-headline', story.card.headline));
    button.addEventListener('click', () => {
      if (!loading) openStory(button, topic, story.key);
    });
    row.append(button);
    return row;
  }));
  $('quick-brief').hidden = false;
}

function renderSection() {
  $('section-title').textContent = categories[active];
  $('resume-topic').hidden = false;
  $('stories').replaceChildren(...deck().map(card => {
    const button = node('button', 'story');
    button.type = 'button';
    if (showCover(card, active)) {
      const media = node('span', 'story-media');
      imageInto(media, card, active);
      button.append(media);
    }
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

function nextStoryIndex() {
  if (reviewMode) return readerIndex + 1 < readerOrder.length ? readerIndex + 1 : -1;
  return nextUnread(readerOrder, readerIndex, seen);
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
}

function detail(id, value) {
  $(id + '-box').hidden = !value;
  $(id).textContent = value ?? '';
}

function showStory(position) {
  readerIndex = position;
  const {topic, index, card} = readerOrder[position];
  const next = nextStoryIndex();
  const cover = $('reader-cover');
  cover.querySelector('img')?.remove();
  cover.hidden = !showCover(card, topic);
  if (!cover.hidden) imageInto(cover, card, topic, true, $('reader-photo-note'));
  $('reader-topic').textContent = categories[topic];
  const positionText = (index + 1) + ' of ' + edition.sections[topic].length;
  $('reader-position').textContent = positionText;
  $('reader-label').textContent = card.label;
  $('reader-title').textContent = card.headline;
  $('reader-summary').textContent = card.summary;
  detail('reader-why', card.why);
  detail('reader-valuation', card.valuation);
  detail('reader-risk', card.risk);
  $('why-label').textContent = {
    investing:'Competitive advantage', mind:'What may explain it', marketing:'Why this approach'
  }[topic] ?? 'Why it happened';
  $('reader-context').textContent = card.context;
  $('context-label').textContent = {
    investing:'Growth case and what to watch', markets:'Why it matters for markets', marketing:'Why it matters for marketers'
  }[topic] ?? 'Why it matters';
  renderSources(card);
  $('previous').disabled = position === 0;
  const alreadyRead = storyRead(readerOrder[position]);
  $('read-label').textContent = alreadyRead ? (next >= 0 ? 'Next story' : 'Back to briefing') :
    (next >= 0 ? 'Mark read & next' : readerScope ? 'Finish topic' : 'Finish briefing');
  $('read-icon').querySelector('path').setAttribute('d', paths[next >= 0 ? 'arrow' : 'check']);
  $('reader-content').scrollTop = 0;
  if ($('reader').open) {
    $('reader-announcement').textContent = categories[topic] + ', ' + positionText + '. ' + card.headline;
  }
}

function openStory(trigger, topic, key) {
  readerScope = topic;
  readerOrder = topic ? readingOrder.filter(story => story.topic === topic) : readingOrder;
  const unreadPosition = readerOrder.findIndex(story => !storyRead(story));
  reviewMode = unreadPosition === -1;
  returnFocus = trigger;
  showStory(key ? readerOrder.findIndex(story => story.key === key) : Math.max(0, unreadPosition));
  $('reader').showModal();
  $('reader-title').focus({preventScroll:true});
}

$('reader-close').addEventListener('click', () => $('reader').close());
$('previous').addEventListener('click', () => {
  showStory(readerIndex - 1);
  if (readerIndex === 0) $('read').focus({preventScroll:true});
});
$('read').addEventListener('click', () => {
  const story = readerOrder[readerIndex];
  for (const key of savedProgress(edition)) seen.add(key);
  const next = nextStoryIndex();
  if (!storyRead(story)) {
    seen.add(story.key);
    rememberProgress(edition, seen);
    updateProgress();
  }
  if (next >= 0) showStory(next);
  else $('reader').close();
});
$('reader').addEventListener('close', () => {
  $('reader-announcement').textContent = '';
  if (returnFocus?.isConnected) returnFocus.focus({preventScroll:true});
});
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
  $('edition-kind').textContent = latest ? (today ? 'Today’s edition' : 'Latest edition') : 'From the archive';
  $('selected-date').textContent = format(briefDate, edition.date);
  readingOrder = getTopics().flatMap(topic =>
    edition.sections[topic].map((card, index) => ({topic, index, card, key:storyKey(topic, card, edition.sections[topic])}))
  );
  const timestamp = edition.publishedAt ?? edition.preparedAt;
  const time = $('release-time');
  time.hidden = !timestamp || !Number.isFinite(Date.parse(timestamp));
  if (!time.hidden) {
    time.dateTime = timestamp;
    time.textContent = (edition.publishedAt ? 'Published ' : 'Prepared ') + releaseTime.format(new Date(timestamp)) + ' IST';
  }
  const preparing = publishing && latest && edition.date < indianDay();
  $('edition-note').textContent = preparing ? 'Today’s edition is pending. Showing the latest available.' : '';
  renderQuickBrief();
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
    if (!edition.sections[active]) active = 'india';
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
        const total = Object.values(issue.sections).reduce((sum, deck) => sum + deck.length, 0);
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
