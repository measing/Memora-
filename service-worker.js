const CACHE_NAME = 'memora-plus-web-v78';

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
  './assets/card-back-memora.png',
  './assets/auth-background.mp4',
  './assets/cards/level1-apple.png',
  './assets/cards/level1-cup.png',
  './assets/cards/level1-flower.png',
  './assets/cards/level1-house.png',
  './assets/cards/level1-key.png',
  './assets/cards/level1-radio.png',
  './assets/cards/level2-bread.png',
  './assets/cards/level2-bus-stop.png',
  './assets/cards/level2-bus.png',
  './assets/cards/level2-butter.png',
  './assets/cards/level2-door.png',
  './assets/cards/level2-hammer.png',
  './assets/cards/level2-key.png',
  './assets/cards/level2-mate.png',
  './assets/cards/level2-nail.png',
  './assets/cards/level2-rain.png',
  './assets/cards/level2-thermos.png',
  './assets/cards/level2-umbrella.png',
  './assets/cards/level5-bakery.png',
  './assets/cards/level5-card.png',
  './assets/cards/level5-field.png',
  './assets/cards/level5-harvest.png',
  './assets/cards/level5-market.png',
  './assets/cards/level5-marraqueta.png',
  './assets/cards/level5-news.png',
  './assets/cards/level5-station.png',
  './assets/cards/level5-train.png',
  './assets/cards/level5-vegetables.png'
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
  if(request.headers.has('range') || url.pathname.endsWith('.mp4')){
    event.respondWith(fetch(request));
    return;
  }

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
