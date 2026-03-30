self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

// A simple fetch handler is strictly required by Chromium to pass the PWA installability criteria.
// We are explicitly passing through all requests since we don't want to offline cache Supabase payloads.
self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request).catch(() => new Response('Offline.')));
});
