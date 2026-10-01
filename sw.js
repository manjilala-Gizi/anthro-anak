/* Service worker AntroAnak.
   Strategi: ambil versi terbaru dari internet lebih dulu (network-first);
   salinan tersimpan hanya dipakai saat HP tidak tersambung internet.
   Naikkan VERSION setiap kali ada perubahan file. */
const VERSION = 'antro-anak-v2.6.0';
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
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req, { ignoreSearch: true }).then(hit => hit || caches.match('index.html')))
  );
});
