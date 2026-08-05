self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

// A simple fetch handler is strictly required by Chromium to pass the PWA installability criteria.
// We are explicitly passing through all requests since we don't want to offline cache Supabase payloads.
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Only handle same-origin requests. Cross-origin API calls (Supabase, Gemini, etc.)
  // are left untouched so their real network errors reach the app's own error handling
  // instead of being masked by a plain-text fallback that breaks response.json() parsing.
  if (url.origin !== self.location.origin) return;

  event.respondWith(fetch(event.request).catch(() => new Response('Offline.', { status: 503 })));
});
