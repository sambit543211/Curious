const shellCache = 'morning-edition-shell-v5';
const dataCache = 'morning-edition-data-v1';
const shell = [
  '/', '/app.js', '/edition-format.js', '/style.css', '/manifest.webmanifest',
  '/fonts/dm-sans.woff2',
  '/images/icon-192.png', '/images/icon-512.png',
  ...['india','world','markets','tech','mind','marketing'].map(id => '/images/' + id + '.jpg')
];
const seeds = ['/editions/index.json', '/first-edition.json', '/editions/2026-11-14.json'];

self.addEventListener('install', event => event.waitUntil(
  Promise.all([
    caches.open(shellCache).then(cache => cache.addAll(shell)),
    caches.open(dataCache).then(cache => cache.addAll(seeds))
  ]).then(() => self.skipWaiting())
));
self.addEventListener('activate', event => event.waitUntil(
  caches.keys().then(keys => Promise.all(keys.filter(key =>
    key.startsWith('morning-edition-') && key !== shellCache && key !== dataCache
  ).map(key => caches.delete(key)))).then(() => self.clients.claim())
));
self.addEventListener('fetch', event => {
  const {request} = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  const isData = seeds.includes(url.pathname) || ['/api/edition','/api/editions'].includes(url.pathname) ||
    /^\/editions\/\d{4}-\d{2}-\d{2}\.json$/.test(url.pathname);
  const isShell = shell.includes(url.pathname) || url.pathname.startsWith('/images/') || request.mode === 'navigate';
  if (!isData && !isShell) return;
  event.respondWith((async () => {
    const cache = await caches.open(isData ? dataCache : shellCache);
    try {
      const response = await fetch(request);
      if (!response.ok) return (await cache.match(request)) || response;
      await cache.put(request.mode === 'navigate' ? '/' : request, response.clone()).catch(() => {});
      return response;
    } catch {
      return (await cache.match(request)) || (request.mode === 'navigate' && await cache.match('/')) || Response.error();
    }
  })());
});
self.addEventListener('push', event => {
  let date = '';
  try { date = event.data.json().date || ''; } catch {}
  event.waitUntil(self.registration.showNotification('Your morning briefing is ready', {
    body:'30 stories across India, world news, markets, AI, human behaviour and marketing.',
    icon:'/images/icon-192.png', tag:'briefing-' + date, data:{date}
  }));
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const date = event.notification.data?.date;
  const target = /^\d{4}-\d{2}-\d{2}$/.test(date || '') ? '/?edition=' + date : '/';
  event.waitUntil(self.clients.matchAll({type:'window', includeUncontrolled:true}).then(async windows => {
    const existing = windows.find(window => new URL(window.url).origin === self.location.origin);
    if (existing) { await existing.navigate(target); return existing.focus(); }
    return self.clients.openWindow(target);
  }));
});
