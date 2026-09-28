/* Service worker: menyimpan seluruh file aplikasi agar bisa dipakai tanpa internet.
   Naikkan VERSION setiap kali ada perubahan file supaya HP petugas mengambil versi baru. */
const VERSION = 'antro-anak-v2.2.0';
const FILES = [
  './', 'index.html', 'manifest.json', 'css/style.css',
  'js/cdc2000-data.js', 'js/who-data.js', 'js/growth.js', 'js/app.js',
  'vendor/html2canvas.min.js', 'vendor/jspdf.umd.min.js',
  'assets/logo-poltekkes-makassar.png',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/maskable-512.png', 'icons/apple-touch-icon.png'
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then(hit => hit || fetch(e.request).then(res => {
      if (res.ok && new URL(e.request.url).origin === location.origin) {
        const copy = res.clone(); caches.open(VERSION).then(c => c.put(e.request, copy));
      }
      return res;
    }).catch(() => caches.match('index.html')))
  );
});
