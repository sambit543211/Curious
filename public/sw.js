// Network first, so a new deploy is always picked up; the cache is the offline fallback.
// Anything the app fetches from this site is kept for offline reading.
const cacheName = 'morning-edition-v9';
const shell = ['/', '/style.css', '/app.js', '/theme.js', '/manifest.webmanifest', '/editions/index.json'];

self.addEventListener('install', event => event.waitUntil(
  caches.open(cacheName).then(cache => cache.addAll(shell)).then(() => self.skipWaiting())
));
self.addEventListener('activate', event => event.waitUntil(
  caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('morning-edition-') && key !== cacheName)
    .map(key => caches.delete(key)))).then(() => self.clients.claim())
));
self.addEventListener('fetch', event => {
  const {request} = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;
  const key = request.mode === 'navigate' ? url.pathname : request;
  event.respondWith((async () => {
    const cache = await caches.open(cacheName);
    try {
      const response = await fetch(request);
      if (response.ok) await cache.put(key, response.clone()).catch(() => {});
      return response.ok ? response : (await cache.match(key)) || response;
    } catch {
      return (await cache.match(key)) || (request.mode === 'navigate' && await cache.match('/')) || Response.error();
    }
  })());
});
self.addEventListener('push', event => {
  let date = '';
  try { date = event.data.json().date || ''; } catch {}
  event.waitUntil(self.registration.showNotification('Your morning briefing is ready', {
    body:'Today’s news, market briefing and stock research are ready to read.',
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
