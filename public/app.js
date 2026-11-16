import { indianDay, isDay, isEdition, topicIds } from './edition-format.js';

const $ = id => document.getElementById(id);
const categories = {
  india: 'India',
  world: 'World',
  markets: 'Indian Markets',
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

const fullDate = new Intl.DateTimeFormat('en-GB', {weekday:'long', day:'numeric', month:'long',year:'numeric',timeZone:'UTC'});
const briefDate = new Intl.DateTimeFormat('en-GB', {weekday:'short', day:'numeric', month:'short', year:'numeric',timeZone:'UTC'});
const monthDate = new Intl.DateTimeFormat('en-GB', {month:'long',year:'numeric',timeZone:'UTC'});
const format = (formatter, day) => formatter.format(new Date(day + 'T12:00:00Z'));
const editionKey = day => 'morning-edition:read:' + day;
const itemId = (topic, card) => topic + ':' + card.headline;

let edition;
let active = 'india';
let readingOrder = [];
let readerIndex = 0;
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
const storyRead = ({topic, card}) => seen.has(itemId(topic, card));
const countRead = topic => edition.sections[topic].filter(card => seen.has(itemId(topic, card))).length;
const currentQuery = () => new URLSearchParams(location.search).get('edition');

function storedProgress(day) {
  try {
    const entries = JSON.parse(localStorage.getItem(editionKey(day)) || '[]');
    return new Set(Array.isArray(entries) ? entries.filter(value => typeof value === 'string') : []);
  } catch { return new Set(); }
}

function imageInto(container, card, topic, eager = false, caption) {
  const img = node('img');
  const fallback = '/images/' + topic + '.jpg';
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
  $('resume-label').textContent = complete ? 'Review stories' : read ? 'Continue reading' : 'Start reading';
  $('resume').disabled = loading;
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
    button.querySelector('.read-badge').hidden = !seen.has(itemId(active, deck()[index]));
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
function renderSection() {
  $('section-title').textContent = categories[active];
  $('stories').replaceChildren(...deck().map((card, index) => {
    const button = node('button', index ? 'story' : 'story lead');
    button.type = 'button';
    const media = node('span', 'story-media');
    imageInto(media, card, active, !index);
    media.append(node('span', 'read-badge', '✓ Read'));
    const caption = node('span', 'story-caption');
    caption.append(node('span', 'story-meta', card.label), node('span', 'story-title', card.headline));
    if (!index) caption.append(node('span', 'story-summary', card.summary));
    if (index === 0) {
      const cta = node('span', 'story-link', 'Read story');
      cta.append(icon('arrow'));
      caption.append(cta);
    } else {
      const arrow = icon('arrow');
      arrow.classList.add('story-arrow');
      caption.append(arrow);
    }
    button.append(media, caption);
    button.addEventListener('click', () => {
      if (!loading) openStory(readingOrder.findIndex(story => story.card === card), button);
    });
    return button;
  }));
  updateProgress();
}
function nextStoryIndex() {
  const anotherUnread = readingOrder.findIndex((story, index) => index !== readerIndex && !storyRead(story));
  if (!storyRead(readingOrder[readerIndex]) && anotherUnread === -1) return -1;
  return readerIndex + 1 < readingOrder.length ? readerIndex + 1 : anotherUnread;
}
function showStory(position) {
  readerIndex = position;
  const {topic, index, card} = readingOrder[position];
  const next = nextStoryIndex();
  $('reader-cover').querySelector('img')?.remove();
  imageInto($('reader-cover'), card, topic, true, $('reader-photo-note'));
  $('reader-topic').textContent = categories[topic];
  const positionText = (index + 1) + ' of ' + edition.sections[topic].length;
  $('reader-position').textContent = positionText;
  $('reader-label').textContent = card.label;
  $('reader-title').textContent = card.headline;
  $('reader-summary').textContent = card.summary;
  $('reader-context').textContent = card.context;
  $('context-label').textContent = topic === 'markets' ? 'What to watch' :
    topic === 'marketing' ? 'What marketers can borrow' : 'Why it matters';
  let source;
  try { source = new URL(card.sourceUrl); } catch {}
  const linkAllowed = source?.protocol === 'https:' && !source.username && !source.password;
  $('reader-source').hidden = !linkAllowed;
  $('reader-source').href = linkAllowed ? source.href : '#';
  $('source-name').textContent = card.source;
  $('previous').disabled = position === 0;
  const alreadyRead = storyRead(readingOrder[position]);
  $('read-label').textContent = alreadyRead ? (next >= 0 ? 'Next story' : 'Back to briefing') :
    (next >= 0 ? 'Mark read & next' : 'Finish briefing');
  $('read-icon').querySelector('path').setAttribute('d', paths[next >= 0 ? 'arrow' : 'check']);
  $('reader-content').scrollTop = 0;
  if ($('reader').open) {
    $('reader-announcement').textContent = categories[topic] + ', ' + positionText + '. ' + card.headline;
  }
}
function openStory(position, trigger) {
  returnFocus = trigger;
  showStory(position);
  $('reader').showModal();
  $('reader-title').focus({preventScroll:true});
}
$('reader-close').addEventListener('click', () => $('reader').close());
$('previous').addEventListener('click', () => {
  showStory(readerIndex - 1);
  if (readerIndex === 0) $('read').focus({preventScroll:true});
});
$('read').addEventListener('click', () => {
  const next = nextStoryIndex();
  const story = readingOrder[readerIndex];
  if (!storyRead(story)) {
    seen.add(itemId(story.topic, story.card));
    try { localStorage.setItem(editionKey(edition.date), JSON.stringify([...seen])); } catch {}
    updateProgress();
  }
  if (next >= 0) showStory(next);
  else $('reader').close();
});
$('reader').addEventListener('close', () => {
  $('reader-announcement').textContent = '';
  if (returnFocus?.isConnected) returnFocus.focus({preventScroll:true});
});
$('resume').addEventListener('click', () => {
  const position = readingOrder.findIndex(story => !storyRead(story));
  openStory(Math.max(0, position), $('resume'));
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
  $('open-archive').disabled = catalog.length === 0;
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
  $('date').dateTime = edition.date;
  $('date').textContent = format(fullDate, edition.date);
  $('selected-date').textContent = format(briefDate, edition.date);
  readingOrder = getTopics().flatMap(topic =>
    edition.sections[topic].map((card, index) => ({topic, index, card}))
  );
  $('schedule-note').textContent = publishing ? 'Daily at 10:05 a.m. IST' : 'Private preview';
  $('edition-note').textContent = publishing && latest && !today ?
    'Showing the latest published edition.' : '';
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
    seen = storedProgress(day);
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
      const read = storedProgress(day).size;
      const status = read ? read + ' read' : day === catalog[0] ? 'Latest' : 'Unread';
      button.append(node('span', 'archive-date', format(briefDate, day)),
        node('span', 'archive-progress', status), icon('right'));
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
$('open-archive').addEventListener('click', openArchive);
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
    button.disabled = false;
    status.textContent = '';
  } catch {
    pushConfig = null;
    status.textContent = 'Morning alerts are unavailable on this deployment.';
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
