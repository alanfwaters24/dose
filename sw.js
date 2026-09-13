// DOSE service worker — v1.0.0
// Purpose: (1) let the app be installed as a standalone PWA, (2) allow
// showNotification to surface reminders even when the tab isn't focused
// (as long as the browser process is still running).
const CACHE_NAME = 'dose-v1.4.1';
const ASSETS = ['index.html', 'manifest.json', 'icon-192.png', 'icon-512.png'];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.all(ASSETS.map((a) =>
        fetch(a, { cache: 'no-store' }).then((res) => cache.put(a, res)).catch(() => {})
      ))
    )
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  // Network-first for same-origin GETs, falling back to cache when offline.
  // Core files (html/js/json — the app itself) explicitly bypass the browser's
  // own HTTP cache so a republish is never masked by a stale disk cache.
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  const isCore = /\.(html|js|json)$/i.test(url.pathname) || url.pathname.endsWith('/');
  const fetchInit = isCore ? { cache: 'no-store' } : {};
  event.respondWith(
    fetch(event.request, fetchInit)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(event.request))
  );
});

// Let the page ask this worker to pop a notification (works even if the
// worker's own execution context has no direct DOM access).
self.addEventListener('message', (event) => {
  const msg = event.data || {};
  if (msg.type === 'SHOW_NOTIFICATION') {
    const { title, body, tag, requireInteraction } = msg.payload || {};
    self.registration.showNotification(title || 'DOSE', {
      body: body || '',
      tag: tag || undefined,
      icon: 'icon-192.png',
      badge: 'icon-192.png',
      requireInteraction: !!requireInteraction,
      vibrate: [80, 40, 80]
    }).catch(() => {});
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const c of clients) {
        if ('focus' in c) return c.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow('index.html');
    })
  );
});
