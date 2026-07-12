const CACHE_NAME = 'memora-plus-web-v24';

const LOCAL_ASSETS = [
  './',
  './index.html',
  './login.html',
  './style.css',
  './main.js',
  './memora-plus.js',
  './account.js',
  './firebase-config.js',
  './firebase-service.js',
  './utils.js',
  './manifest.webmanifest',
  './assets/logo-memora-plus.png',
  './assets/auth-background.mp4'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(LOCAL_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const { request } = event;
  if(request.method !== 'GET') return;

  const url = new URL(request.url);
  if(url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(request)
      .then(response => {
        if(response && response.ok){
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
        }
        return response;
      })
      .catch(() => caches.match(request))
  );
});
