const CACHE_NAME = 'net-control-v2'; // قمنا برفع رقم الكاش الداخلي
const ASSETS = [
  'index.html',
  'style.css',
  'app.js',
  'manifest.json'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
});

// تنظيف الكاشات القديمة لعدم حدوث تعارض
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((response) => {
      return response || fetch(e.request);
    })
  );
});

// مستمع التحديث الفوري لتخطي الانتظار
self.addEventListener('message', (e) => {
  if (e.data.action === 'skipWaiting') {
    self.skipWaiting();
  }
});
