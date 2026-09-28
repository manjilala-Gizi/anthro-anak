/* Service worker: menyimpan seluruh file aplikasi agar bisa dipakai tanpa internet.
   Naikkan VERSION setiap kali ada perubahan file supaya HP petugas mengambil versi baru. */
const VERSION = 'antro-anak-v2.3.0';
const FILES = [
  './', 'index.html', 'manifest.json', 'style.css',
  'cdc2000-data.js', 'who-data.js', 'growth.js', 'app.js',
  'html2canvas.min.js', 'jspdf.umd.min.js',
  'logo-poltekkes-makassar.png',
  'icon-192.png', 'icon-512.png', 'maskable-512.png', 'apple-touch-icon.png'
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
