// Morning Edition: loads an edition, renders the home page and wires the dialogs.
import { openArchive } from './js/archive.js';
import { dates, loadEdition, refreshCatalog } from './js/catalog.js';
import { $, closeOnBackdrop, hydrateIcons } from './js/dom.js';
import { initHome, renderHome, updateHome } from './js/home.js';
import { isProgressKey, loadProgress, rememberTotal, saveProgress } from './js/progress.js';
import { initReader, openReader } from './js/reader.js';
import { initSettings } from './js/settings.js';
import { firstUnread, state } from './js/state.js';
import { readingOrder } from './js/story.js';

hydrateIcons();
const requestedDay = () => new URLSearchParams(location.search).get('edition');
let loadVersion = 0;
let lastCatalogCheck = 0;

function setRoute(day, mode) {
  if (mode === 'none') return;
  const url = new URL(location.href);
  if (day === dates[0]) url.searchParams.delete('edition');
  else url.searchParams.set('edition', day);
  if (url.href === location.href) return;
  history[mode === 'replace' ? 'replaceState' : 'pushState']({}, '', url);
}

function setLoading(loading) {
  state.loading = loading;
  const index = dates.indexOf(state.edition?.date);
  $('older').disabled = loading || index < 0 || index === dates.length - 1;
  $('newer').disabled = loading || index <= 0;
  $('open-archive').disabled = loading || !dates.length;
  $('briefing').setAttribute('aria-busy', String(loading));
  if (state.edition) updateHome();
}

async function selectEdition(day, mode = 'push') {
  if (!dates.includes(day)) return false;
  if (state.edition?.date === day) { setRoute(day, mode); return true; }
  const version = ++loadVersion;
  setLoading(true);
  try {
    const issue = await loadEdition(day);
    if (version !== loadVersion) return false;
    state.edition = issue;
    state.order = readingOrder(issue);
    state.read = loadProgress(issue);
    rememberTotal(day, state.order.length);
    setRoute(day, mode);
    renderHome();
    window.scrollTo({top:0});
    return true;
  } catch {
    if (version === loadVersion) $('edition-note').textContent = 'Couldn’t load this edition. Check your connection and try again.';
    return false;
  } finally {
    if (version === loadVersion) setLoading(false);
  }
}

function markRead(story) {
  state.read.add(story.key);
  saveProgress(state.edition, state.read);
  updateHome();
}

function openStory(trigger, key) {
  if (state.loading) return;
  openReader(trigger, state.order.findIndex(story => story.key === key));
}

initHome({
  onOpen:openStory,
  onLatest:() => selectEdition(dates[0])
});
initReader({onRead:markRead});
initSettings();
for (const dialog of document.querySelectorAll('dialog.sheet')) closeOnBackdrop(dialog);

$('resume').addEventListener('click', () => {
  const next = firstUnread();
  openReader($('resume'), next < 0 ? 0 : next);
});
$('older').addEventListener('click', () => selectEdition(dates[dates.indexOf(state.edition.date) + 1]));
$('newer').addEventListener('click', () => selectEdition(dates[dates.indexOf(state.edition.date) - 1]));
$('open-archive').addEventListener('click', () => openArchive(async day => {
  $('archive-message').textContent = 'Opening…';
  if (await selectEdition(day)) $('archive').close();
  else $('archive-message').textContent = 'Couldn’t open this edition. Check your connection and try again.';
}));
$('archive-close').addEventListener('click', () => $('archive').close());

window.addEventListener('popstate', () => {
  if ($('reader').open) $('reader').close();
  selectEdition(requestedDay() || dates[0], 'none');
});
window.addEventListener('storage', event => {
  if (!state.edition || !isProgressKey(event.key, state.edition.date)) return;
  state.read = loadProgress(state.edition);
  updateHome();
});

// When the app comes back to the foreground, pick up a newly published edition.
document.addEventListener('visibilitychange', async () => {
  if (document.hidden || Date.now() - lastCatalogCheck < 60000) return;
  lastCatalogCheck = Date.now();
  const previousLatest = dates[0];
  try { await refreshCatalog(); } catch { return; }
  if (dates[0] === previousLatest) return;
  const onLatest = state.edition?.date === previousLatest && !requestedDay();
  if (onLatest && !document.querySelector('dialog[open]')) await selectEdition(dates[0], 'replace');
  else if (state.edition) renderHome();
});

async function start() {
  lastCatalogCheck = Date.now();
  await refreshCatalog();
  const requested = requestedDay();
  const valid = dates.includes(requested);
  if (!dates.length || !await selectEdition(valid ? requested : dates[0], valid ? 'none' : 'replace')) throw new Error('No edition');
  if (requested && !valid) $('edition-note').textContent = 'There’s no edition for that date. Showing the latest one.';
}
start().catch(() => {
  $('edition-kicker').textContent = 'Offline';
  $('edition-note').textContent = 'Couldn’t load the briefing. Check your connection and refresh the page.';
  setLoading(false);
});
