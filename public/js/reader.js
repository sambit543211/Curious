// The full-screen story reader. A story counts as read when you move on with Next,
// or after you've spent a few seconds on it.
import { topicName } from '../topics.js';
import { $, node, setIcon } from './dom.js';
import { isRead, state } from './state.js';
import { minutes } from './story.js';
import { renderArticle } from './story-view.js';

const dwell = 3000;
let position = 0;
let openedAt = 0;
let returnFocus;
let touch;
let options;

const story = () => state.order[position];
const shortTopic = topic => topicName(topic).replace('Stock Investing', 'Stocks').replace('Indian Markets', 'Markets');

function settle(forward) {
  const current = story();
  if (current && !isRead(current) && (forward || performance.now() - openedAt >= dwell)) options.onRead(current);
}

function segments(current) {
  const siblings = state.order.filter(item => item.topic === current.topic);
  $('reader-segments').replaceChildren(...siblings.map(item => {
    const bar = node('span');
    if (item === current) bar.className = 'is-current';
    else if (isRead(item)) bar.className = 'is-read';
    return bar;
  }));
}

function hideTerm() {
  $('term-tip').hidden = true;
}
function showTerm(word) {
  $('term-tip-word').textContent = word.dataset.term;
  $('term-tip-meaning').textContent = word.dataset.meaning;
  $('term-tip').hidden = false;
  $('term-tip-close').focus({preventScroll:true});
}

function show(index, direction = 0) {
  hideTerm();
  position = index;
  openedAt = performance.now();
  const current = story();
  $('reader-finish').hidden = true;
  $('reader-scroll').hidden = false;
  $('reader-nav').hidden = false;
  $('reader-bar').hidden = false;
  $('reader').setAttribute('aria-labelledby', 'reader-title');
  $('reader-topic').textContent = shortTopic(current.topic);
  $('reader-position').textContent = '· ' + (current.index + 1) + ' of ' + current.total;
  segments(current);
  const article = renderArticle(current);
  if (direction) article.classList.add(direction > 0 ? 'slide-next' : 'slide-prev');
  $('reader-scroll').replaceChildren(article);
  $('reader-scroll').scrollTop = 0;
  $('previous').disabled = position === 0;
  const next = state.order[position + 1];
  $('next-kicker').textContent = !next ? 'Last story' : next.topic !== current.topic ? 'Up next · ' + shortTopic(next.topic) : 'Up next';
  $('next-title').textContent = next ? next.card.headline : 'Finish the edition';
  setIcon($('next-icon'), next ? 'arrow' : 'check');
  $('reader-announcement').textContent = shortTopic(current.topic) + ', ' + (current.index + 1) + ' of ' + current.total + '. ' + current.card.headline;
  $('reader-title').focus({preventScroll:true});
}

function finish() {
  $('reader-scroll').hidden = true;
  $('reader-nav').hidden = true;
  $('reader-bar').hidden = true;
  $('reader-finish').hidden = false;
  $('reader').setAttribute('aria-labelledby', 'finish-title');
  $('finish-meta').textContent = state.order.length + ' stories, about ' + minutes(state.order) + ' minutes of reading. ' +
    (options.isLatest() ? 'The next edition arrives tomorrow around 10 AM.' : '');
  options.onFinish();
  $('finish-title').focus({preventScroll:true});
}

function move(step) {
  if (!$('reader').open || !$('reader-finish').hidden) return;
  const target = position + step;
  if (target < 0) return;
  settle(step > 0);
  if (target >= state.order.length) return finish();
  show(target, step);
}

export function openReader(trigger, index) {
  if (index < 0 || index >= state.order.length) return;
  if (!$('reader').open) {
    returnFocus = trigger;
    $('reader').showModal();
  }
  show(index);
}

async function share() {
  const current = story();
  if (!current) return;
  const url = new URL(location.origin + '/');
  url.searchParams.set('edition', state.edition.date);
  url.searchParams.set('story', current.key);
  const data = {title:current.card.headline, text:current.card.headline + ' — Morning Edition', url:url.href};
  try {
    if (navigator.share) await navigator.share(data);
    else {
      await navigator.clipboard.writeText(url.href);
      $('reader-announcement').textContent = 'Link copied';
    }
  } catch { /* The share sheet was dismissed. */ }
}

export function initReader(settings) {
  options = settings;
  const reader = $('reader');
  for (const id of ['reader-close', 'finish-close', 'finish-x']) $(id).addEventListener('click', () => reader.close());
  $('previous').addEventListener('click', () => move(-1));
  $('next').addEventListener('click', () => move(1));
  $('reader-share').addEventListener('click', share);
  // Tap an underlined word to see what it means; tap anywhere else or scroll to dismiss.
  $('reader-scroll').addEventListener('click', event => {
    const word = event.target.closest('.term');
    if (word) showTerm(word);
    else hideTerm();
  });
  $('reader-scroll').addEventListener('scroll', hideTerm, {passive:true});
  $('term-tip-close').addEventListener('click', hideTerm);
  reader.addEventListener('close', () => {
    hideTerm();
    if ($('reader-finish').hidden) settle(false);
    $('reader-announcement').textContent = '';
    if (returnFocus?.isConnected) returnFocus.focus({preventScroll:true});
  });
  reader.addEventListener('keydown', event => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.target.closest('a, summary, .table-scroll')) return;
    const step = {ArrowLeft:-1, ArrowRight:1}[event.key];
    if (step) { event.preventDefault(); move(step); }
  });

  // Swipe sideways to change story; swipe down from the top bar, or from the top of a story, to close.
  const start = event => {
    const point = event.touches[0];
    touch = event.touches.length === 1 && !event.target.closest('.table-scroll, .tiles') ?
      {x:point.clientX, y:point.clientY, top:$('reader-scroll').scrollTop <= 0, bar:!!event.target.closest('.reader-bar')} : null;
  };
  const end = event => {
    if (!touch) return;
    const point = event.changedTouches[0];
    const dx = point.clientX - touch.x;
    const dy = point.clientY - touch.y;
    const began = touch;
    touch = null;
    if (Math.abs(dx) >= 60 && Math.abs(dx) > Math.abs(dy) * 1.6) return move(dx < 0 ? 1 : -1);
    if (dy > 110 && Math.abs(dy) > Math.abs(dx) * 2 && (began.bar || began.top)) reader.close();
  };
  for (const area of [$('reader-scroll'), $('reader-bar')]) {
    area.addEventListener('touchstart', start, {passive:true});
    area.addEventListener('touchend', end, {passive:true});
    area.addEventListener('touchcancel', () => { touch = null; }, {passive:true});
  }
}
