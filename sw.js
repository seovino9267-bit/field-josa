// 현장조서 오프라인 캐시 — 앱 화면은 새 판을 먼저 받고(끊기면 저장본), 라이브러리·항공사진은 저장본을 먼저 쓴다.
// 라이브러리는 앱 폴더(lib/)에 사본을 두어, 한 번 열어 두면 인터넷 없이도 열리고 Word가 만들어진다.
const APP = 'josa-app-v6';
const TILES = 'josa-tiles';
const TILE_MAX = 6000;
const SHELL = [
  './', './index.html', './config.js', './manifest.webmanifest', './icon.svg', './icon-192.png', './icon-512.png',
  './lib/leaflet-1.9.4.min.css', './lib/leaflet-1.9.4.min.js', './lib/jszip-3.10.1.min.js',
  './lib/polygon-clipping-0.15.7.umd.min.js', './lib/docx-9.8.1.esm.js',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(APP).then(c => Promise.all(SHELL.map(u => c.add(u).catch(() => null)))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== APP && k !== TILES).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

let trimming = false;
async function trimTiles() {
  if (trimming) return; trimming = true;
  try { const c = await caches.open(TILES); const keys = await c.keys(); for (let i = 0; i < keys.length - TILE_MAX; i++) await c.delete(keys[i]); }
  finally { trimming = false; }
}
async function cacheFirst(req, name) {
  const c = await caches.open(name); const hit = await c.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) { c.put(req, res.clone()); if (name === TILES && Math.random() < 0.02) trimTiles(); }
  return res;
}
async function networkFirst(req) {
  const c = await caches.open(APP);
  try { const res = await fetch(req); if (res.ok) c.put(req, res.clone()); return res; }
  catch { return (await c.match(req, { ignoreSearch: true })) || (req.mode === 'navigate' ? await c.match('./index.html') : null) || Response.error(); }
}

self.addEventListener('fetch', e => {
  const req = e.request; if (req.method !== 'GET') return;
  const u = new URL(req.url);
  if (u.hostname === 'api.vworld.kr') return; // 주소·지적 조회는 늘 새로
  if (u.hostname === 'xdworld.vworld.kr' || u.hostname === 'server.arcgisonline.com') { e.respondWith(cacheFirst(req, TILES)); return; }
  if (u.origin === location.origin) { e.respondWith(u.pathname.includes('/lib/') ? cacheFirst(req, APP) : networkFirst(req)); return; }
  if (u.hostname === 'fonts.googleapis.com' || u.hostname === 'fonts.gstatic.com') e.respondWith(cacheFirst(req, APP));
});
