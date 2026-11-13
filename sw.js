// «Первое лето» on its own site: keeps the game on the device, so it opens without the network, and takes a new version when there is one.
// python3 build.py --site fills in VERSION (a hash of everything the site holds) and FILES; a new build is a new sw.js, so the browser installs it,
// it puts the whole new game aside, takes over and lets the old copy go. Saves are not here: they live in the page's own storage, which this never touches.
const VERSION = 'd63da224bd89';
const FILES = ["./", "index.html", "apple-touch-icon.png", "art/art.js", "icon-192.png", "icon-512.png", "manifest.webmanifest"];
const CACHE = 'leto-' + VERSION;
const FRESH = /(^|\/)(index\.html|art\/art\.js)?$/;   // the page and the list of drawings: asked from the network first, so an online start gets the new version at once

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES.map(f => new Request(f, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('leto-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

function keep(req, res){
  if (res && (res.ok || res.type === 'opaque')){ const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {}); }
  return res;
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url), here = url.origin === location.origin;
  const path = here ? url.pathname.slice(new URL(self.registration.scope).pathname.length) : null;
  if (req.mode === 'navigate' || (here && FRESH.test(path))){
    // network first, but never wait on it for long: after three seconds the copy on the device opens
    const key = req.mode === 'navigate' ? './' : req;
    e.respondWith(new Promise(done => {
      let over = false;
      const fallback = () => caches.match(key, { ignoreSearch: true }).then(r => r || caches.match('index.html'));
      const t = setTimeout(() => { fallback().then(r => { if (r && !over){ over = true; done(r); } }); }, 3000);
      fetch(req).then(res => { clearTimeout(t); if (res.ok) keep(key, res); if (!over){ over = true; done(res.ok ? res : fallback().then(r => r || res)); } })
        .catch(() => { clearTimeout(t); if (!over){ over = true; done(fallback().then(r => r || Response.error())); } });
    }));
    return;
  }
  // drawings, icons and the fonts: from the device, and from the network only the first time
  e.respondWith(caches.match(req).then(r => r || fetch(req).then(res => keep(req, res))));
});
