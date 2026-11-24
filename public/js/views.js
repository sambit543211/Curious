// Tab switching (tabs at the top) and the section shortcuts in the bottom bar, which follow your scroll.
import { $ } from './dom.js';

const tabs = ['today', 'editions', 'stocks', 'settings'];
const titles = {editions:'Editions', stocks:'Stocks', settings:'Settings'};
let active = 'today';
let onShow;
let todayTitle = '';
let ticking = false;

export const currentTab = () => tabs.includes(location.hash.slice(1)) ? location.hash.slice(1) : 'today';
export const setTodayTitle = title => { todayTitle = title; if (active === 'today') $('topbar-title').textContent = title; };

export function showTab(tab, {scroll = true} = {}) {
  active = tabs.includes(tab) ? tab : 'today';
  for (const name of tabs) $('view-' + name).hidden = name !== active;
  for (const link of document.querySelectorAll('[data-tab]')) {
    if (link.dataset.tab === active) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }
  $('resume').hidden = active !== 'today';
  $('sectionbar').hidden = active !== 'today';
  $('topbar-title').textContent = active === 'today' ? todayTitle : titles[active];
  $('topbar-meta').hidden = active !== 'today';
  if (scroll) window.scrollTo({top:0});
  onShow?.(active);
  update();
}

function update() {
  ticking = false;
  if (active !== 'today') return;
  const barBottom = $('topbar').getBoundingClientRect().bottom;
  let current = null;
  for (const section of document.querySelectorAll('#sections .topic')) {
    if (section.getBoundingClientRect().top <= barBottom + 64) current = section.dataset.topic;
  }
  for (const chip of $('chips').children) {
    const on = chip.dataset.topic === current;
    if (on && chip.getAttribute('aria-current') !== 'true') {
      const strip = $('chips');
      strip.scrollTo({left:chip.offsetLeft - (strip.clientWidth - chip.offsetWidth) / 2, behavior:'smooth'});
    }
    chip.setAttribute('aria-current', String(on));
  }
}

export function initViews(settings) {
  onShow = settings.onShow;
  window.addEventListener('hashchange', () => showTab(currentTab()));
  window.addEventListener('scroll', () => {
    if (!ticking) { ticking = true; requestAnimationFrame(update); }
  }, {passive:true});
  window.addEventListener('resize', update);
}
