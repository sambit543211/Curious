// Morning Edition: loads an edition and wires the four tabs and the reader together.
import { dates, loadEdition, refreshCatalog } from './js/catalog.js';
import { $, hydrateIcons } from './js/dom.js';
import { focusEdition, initEditions, renderEditions } from './js/editions.js';
import { initHome, renderHome, updateHome } from './js/home.js';
import { isProgressKey, loadProgress, rememberTotal, saveProgress } from './js/progress.js';
import { initReader, openReader } from './js/reader.js';
import { alertsAvailable, enableAlerts, initSettings } from './js/settings.js';
import { firstUnread, state } from './js/state.js';
import { initStocks, renderPicks, renderStocks } from './js/stocks.js';
import { readingOrder, topStories } from './js/story.js';
import { recordDay, streakSummary } from './js/streak.js';
import { savedSummary } from './js/progress.js';
import { currentTab, initViews, setTodayTitle, showTab } from './js/views.js';
import { fullDate, weekday } from './js/format.js';
import { node } from './js/dom.js';

hydrateIcons();
const params = () => new URLSearchParams(location.search);
let loadVersion = 0;
let lastCatalogCheck = 0;

function setRoute(day, mode) {
  if (mode === 'none') return;
  const url = new URL(location.href);
  url.searchParams.delete('story');
  if (day === dates[0]) url.searchParams.delete('edition');
  else url.searchParams.set('edition', day);
  if (url.href === location.href) return;
  history[mode === 'replace' ? 'replaceState' : 'pushState']({}, '', url);
}

function setLoading(loading) {
  state.loading = loading;
  $('view-today').setAttribute('aria-busy', String(loading));
  updateHome();
}

function topKeys() {
  return topStories(state.edition, state.order).map(({story}) => story.key);
}

// Shows the number of unread stories on the Home Screen icon (iOS 16.4+).
function updateBadge() {
  if (!('setAppBadge' in navigator) || state.edition?.date !== dates[0]) return;
  const unread = state.order.length - state.read.size;
  (unread > 0 ? navigator.setAppBadge(unread) : navigator.clearAppBadge()).catch(() => {});
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
    setTodayTitle(weekday(day));
    renderPicks();
    updateBadge();
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
  recordDay(state.edition.date, topKeys(), state.read);
  updateHome();
  updateBadge();
}

function openStory(trigger, key) {
  if (state.loading) return;
  openReader(trigger, state.order.findIndex(story => story.key === key));
}

function resume(trigger) {
  const next = firstUnread();
  openReader(trigger, next < 0 ? 0 : next);
}

// The "You're caught up" screen: streak, a missed edition to catch up on, and the alert offer.
async function onFinish() {
  recordDay(state.edition.date, topKeys(), state.read);
  const {current, best, week} = streakSummary(dates);
  $('streak-title').textContent = current > 0 ? current + (current === 1 ? '-day streak' : '-day streak') : 'Start a streak';
  $('streak-best').textContent = best > 1 ? 'Best: ' + best + ' days' : 'Read the top stories daily';
  $('streak-week').replaceChildren(...week.map(day => {
    const cell = node('span', [day.on && 'is-on', day.today && 'is-today'].filter(Boolean).join(' '), day.label);
    cell.append(node('i'));
    return cell;
  }));
  const missed = dates.find(day => {
    if (day === state.edition.date) return false;
    const {read, total} = savedSummary(day);
    return !(total && read >= total);
  });
  $('catchup').hidden = !missed;
  if (missed) {
    const {read, total} = savedSummary(missed);
    $('catchup-title').textContent = 'Catch up on ' + fullDate(missed).split(' ')[0];
    $('catchup-meta').textContent = read ? (total ? total - read : 'Some') + ' stories left' : 'Not opened yet';
    $('catchup-open').onclick = async () => {
      $('reader').close();
      if (await selectEdition(missed)) resume($('resume'));
    };
  }
  $('finish-remind').hidden = !(await alertsAvailable()) || (typeof Notification !== 'undefined' && Notification.permission === 'granted');
}

initHome({onOpen:openStory, onLatest:() => selectEdition(dates[0])});
initReader({onRead:markRead, onFinish, isLatest:() => state.edition?.date === dates[0]});
initSettings();
initStocks({onOpen:openStory});
initEditions({onOpen:async day => {
  if (await selectEdition(day)) location.hash = 'today';
}});
initViews({onShow:tab => {
  if (tab === 'editions') renderEditions();
  if (tab === 'stocks') renderStocks();
  if (tab === 'settings') alertsAvailable();
}});

$('resume').addEventListener('click', () => resume($('resume')));
$('resume-inline').addEventListener('click', () => resume($('resume-inline')));
$('finish-remind').addEventListener('click', async () => {
  if (await enableAlerts($('reader-announcement'))) $('finish-remind').hidden = true;
});

window.addEventListener('popstate', () => {
  if ($('reader').open) $('reader').close();
  selectEdition(params().get('edition') || dates[0], 'none');
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
  const onLatest = state.edition?.date === previousLatest && !params().get('edition');
  if (onLatest && !$('reader').open) await selectEdition(dates[0], 'replace');
  else if (state.edition) renderHome();
});

async function start() {
  showTab(currentTab(), {scroll:false});
  lastCatalogCheck = Date.now();
  await refreshCatalog();
  const requested = params().get('edition');
  const valid = dates.includes(requested);
  if (!dates.length || !await selectEdition(valid ? requested : dates[0], valid ? 'none' : 'replace')) throw new Error('No edition');
  if (requested && !valid) $('edition-note').textContent = 'There’s no edition for that date. Showing the latest one.';
  focusEdition(state.edition.date);
  showTab(currentTab(), {scroll:false});
  const shared = params().get('story');
  if (shared && state.order.some(story => story.key === shared)) {
    showTab('today', {scroll:false});
    openStory($('resume'), shared);
  }
}
start().catch(() => {
  $('edition-meta').textContent = 'Offline';
  $('edition-note').textContent = 'Couldn’t load the briefing. Check your connection and open the app again.';
  setLoading(false);
});
