// ============================================================
// SERVICE WORKER — Fiestas Pantano 2026
// Estrategia: Cache-First para assets estáticos,
//             Network-First para Firebase (datos dinámicos)
// ============================================================

const CACHE_NAME = 'pantano-v4';

// Páginas y assets que se cachean al instalar
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/panel.html',
  '/actividades.html',
  '/mis_inscripciones.html',
  '/perfil.html',
  '/festeros.html',
  '/rifa.html',
  '/info.html',
  '/migany.html',
  '/social.html',
  '/guia.html',
  '/codigos.html',
  '/terminos.html',
  '/privacidad.html',
  '/cookies.html',
  '/manifest.json'
];

// ── INSTALL: pre-cachear páginas principales ──────────────────
self.addEventListener('install', (event) => {
  console.log('[SW] Instalando...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Pre-cacheando páginas');
      // Usamos addAll con manejo de errores individuales
      return Promise.allSettled(
        PRECACHE_URLS.map(url => cache.add(url).catch(err => console.warn('[SW] No se pudo cachear:', url, err)))
      );
    }).then(() => self.skipWaiting())
  );
});

// ── ACTIVATE: limpiar caches antiguos ────────────────────────
self.addEventListener('activate', (event) => {
  console.log('[SW] Activando...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter(name => name !== CACHE_NAME)
          .map(name => {
            console.log('[SW] Borrando cache antigua:', name);
            return caches.delete(name);
          })
      );
    }).then(() => self.clients.claim())
  );
});

// ── FETCH: estrategia según tipo de recurso ───────────────────
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 1. Firebase / APIs externas → SIEMPRE red (nunca cachear)
  if (
    url.hostname.includes('firebaseio.com') ||
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('firebasestorage') ||
    url.hostname.includes('gstatic.com') ||
    url.hostname.includes('postimg.cc') ||
    url.hostname.includes('fonts.googleapis.com') ||
    url.hostname.includes('fonts.gstatic.com') ||
    url.hostname.includes('cdnjs.cloudflare.com')
  ) {
    // Network only, sin intervención
    return;
  }

  // 2. Páginas HTML → Network First (contenido fresco), Cache Fallback
  if (event.request.mode === 'navigate' || url.pathname.endsWith('.html') || url.pathname === '/') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Si la red responde bien, actualizamos el cache
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => {
          // Sin red → devolvemos la versión cacheada
          return caches.match(event.request).then(cached => {
            if (cached) return cached;
            // Fallback final: página de inicio
            return caches.match('/index.html');
          });
        })
    );
    return;
  }

  // 3. Resto de assets estáticos → Cache First, Network Fallback
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      });
    })
  );
});

// ── PUSH NOTIFICATIONS (para futuros avisos de eventos) ──────
self.addEventListener('push', (event) => {
  if (!event.data) return;
  const data = event.data.json();
  const options = {
    body: data.body || 'Nuevo aviso de Fiestas Pantano',
    icon: 'https://i.postimg.cc/VsG3cfP1/Whats-App-Image-2026-02-01-at-12-23-56.jpg',
    badge: 'https://i.postimg.cc/VsG3cfP1/Whats-App-Image-2026-02-01-at-12-23-56.jpg',
    vibrate: [100, 50, 100],
    data: { url: data.url || '/actividades.html' },
    actions: [
      { action: 'ver', title: 'Ver ahora' },
      { action: 'cerrar', title: 'Cerrar' }
    ]
  };
  event.waitUntil(
    self.registration.showNotification(data.title || '🎉 Fiestas Pantano', options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'ver' || !event.action) {
    const url = event.notification.data?.url || '/actividades.html';
    event.waitUntil(clients.openWindow(url));
  }
});
