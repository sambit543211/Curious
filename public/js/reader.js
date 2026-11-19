// The story-by-story reader. A story counts as read when you move on with Next,
// or after you've spent a few seconds on it.
import { topicName } from '../topics.js';
import { $, setIcon } from './dom.js';
import { isRead, state } from './state.js';
import { minutes } from './story.js';
import { renderArticle } from './story-view.js';

const dwell = 3000;
let position = 0;
let openedAt = 0;
let returnFocus;
let touch;
let onRead;

const story = () => state.order[position];

function settle(forward) {
  const current = story();
  if (current && !isRead(current) && (forward || performance.now() - openedAt >= dwell)) onRead(current);
}

function show(index) {
  position = index;
  openedAt = performance.now();
  const current = story();
  $('reader-finish').hidden = true;
  $('reader-scroll').hidden = false;
  $('reader-nav').hidden = false;
  $('reader').setAttribute('aria-labelledby', 'reader-title');
  $('reader-topic').textContent = topicName(current.topic);
  $('reader-position').textContent = (current.index + 1) + ' of ' + current.total;
  $('reader-fill').style.width = ((position + 1) / state.order.length * 100) + '%';
  $('reader-scroll').replaceChildren(renderArticle(current));
  $('reader-scroll').scrollTop = 0;
  $('previous').disabled = position === 0;
  const last = position === state.order.length - 1;
  $('next-label').textContent = last ? 'Finish' : 'Next';
  setIcon($('next-icon'), last ? 'check' : 'arrow');
  $('reader-announcement').textContent = topicName(current.topic) + ', ' + $('reader-position').textContent + '. ' + current.card.headline;
  $('reader-title').focus({preventScroll:true});
}

function finish() {
  $('reader-scroll').hidden = true;
  $('reader-nav').hidden = true;
  $('reader-finish').hidden = false;
  $('reader').setAttribute('aria-labelledby', 'finish-title');
  $('reader-fill').style.width = '100%';
  $('finish-meta').textContent = state.order.length + ' stories · about ' + minutes(state.order) + ' min of reading';
  $('finish-title').focus({preventScroll:true});
}

function move(step) {
  if (!$('reader').open || !$('reader-finish').hidden) return;
  const target = position + step;
  if (target < 0) return;
  settle(step > 0);
  if (target >= state.order.length) return finish();
  show(target);
}

export function openReader(trigger, index) {
  if (index < 0 || index >= state.order.length) return;
  if (!$('reader').open) {
    returnFocus = trigger;
    $('reader').showModal();
  }
  show(index);
}

export function initReader(options) {
  onRead = options.onRead;
  const reader = $('reader');
  $('reader-close').addEventListener('click', () => reader.close());
  $('finish-close').addEventListener('click', () => reader.close());
  $('previous').addEventListener('click', () => move(-1));
  $('next').addEventListener('click', () => move(1));
  reader.addEventListener('close', () => {
    if ($('reader-finish').hidden) settle(false);
    $('reader-announcement').textContent = '';
    if (returnFocus?.isConnected) returnFocus.focus({preventScroll:true});
  });
  reader.addEventListener('keydown', event => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.target.closest('a, summary, .table-scroll')) return;
    const step = {ArrowLeft:-1, ArrowRight:1}[event.key];
    if (step) { event.preventDefault(); move(step); }
  });
  const scroll = $('reader-scroll');
  scroll.addEventListener('touchstart', event => {
    const point = event.touches[0];
    touch = event.touches.length === 1 && !event.target.closest('.table-scroll') ? {x:point.clientX, y:point.clientY} : null;
  }, {passive:true});
  scroll.addEventListener('touchend', event => {
    if (!touch) return;
    const point = event.changedTouches[0];
    const dx = point.clientX - touch.x;
    const dy = point.clientY - touch.y;
    touch = null;
    if (Math.abs(dx) >= 60 && Math.abs(dx) > Math.abs(dy) * 1.6) move(dx < 0 ? 1 : -1);
  }, {passive:true});
  scroll.addEventListener('touchcancel', () => { touch = null; }, {passive:true});
}
