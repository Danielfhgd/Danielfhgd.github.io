
// Service Worker con control de versiones
// IMPORTANTE: Cambiar esta versión cuando se actualice la app para forzar actualización del caché
// Ejemplo: '1.0.1', '1.0.2', '1.1.0', etc.
const APP_VERSION = '1.0.13';
const CACHE_NAME = `mapa-ubv-v${APP_VERSION}`;

// Recursos a cachear (usar rutas relativas)

const urlsToCache = [
    './',
    './index.html',
    './menu.html',
    './map.html',
    './styles/menu.css',
    './styles/main.css',
    './scripts/menu.js',
    './scripts/headerScroll.js',
    './scripts/app.js',
    './scripts/modules/mapLoader.js',
    './scripts/modules/floorManager.js',
    './scripts/modules/zoomController.js',
    './scripts/modules/routeModal.js',
    './scripts/modules/routeSearch.js',
    './scripts/modules/serviceWorkerManager.js',
    './data/dataUBV.json',
    './manifest.json',
    './service-worker.js',
    './assets/Mapa-Piso1.png',
    './assets/Mapa-Piso2.png',
    './assets/Mapa-Sotano.png',
    './assets/banner.webp',
    './assets/icons/icon-192x192.png',
    './assets/icons/icon-512x512.png',
    './assets/icons/ubvlogo.png'
];

// Instalación del Service Worker
self.addEventListener('install', (event) => {
    console.log(`[Service Worker] Instalando versión ${APP_VERSION}...`);

    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[Service Worker] Cacheando recursos...');
                return cache.addAll(urlsToCache.map(url => new Request(url, { cache: 'reload' })));
            })
            .then(() => {
                console.log('[Service Worker] Recursos cacheados correctamente');
                // Forzar activación inmediata del nuevo service worker
                return self.skipWaiting();
            })
            .catch((error) => {
                console.error('[Service Worker] Error al cachear recursos:', error);
            })
    );
});

// Activación del Service Worker
self.addEventListener('activate', (event) => {
    console.log(`[Service Worker] Activando versión ${APP_VERSION}...`);

    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                // Eliminar cachés antiguos
                return Promise.all(
                    cacheNames.map((cacheName) => {
                        if (cacheName !== CACHE_NAME) {
                            console.log('[Service Worker] Eliminando caché antiguo:', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            })
            .then(() => {
                console.log('[Service Worker] Cachés antiguos eliminados');
                // Tomar control inmediato de todas las páginas
                return self.clients.claim();
            })
    );
});

// Interceptar peticiones
self.addEventListener('fetch', (event) => {
    // Solo interceptar peticiones GET
    if (event.request.method !== 'GET') {
        return;
    }

    const url = new URL(event.request.url);

    // Solo cachear recursos de nuestro origen
    if (url.origin !== self.location.origin) {
        return;
    }

    // --- ESTRATEGIA DIFERENCIADA ---
    const isDataJson = url.pathname.endsWith('.json');

    if (isDataJson) {
        // Estrategia: Network First (para datos que cambian frecuentemente)
        event.respondWith(
            fetch(event.request)
                .then((networkResponse) => {
                    if (networkResponse && networkResponse.status === 200) {
                        const responseClone = networkResponse.clone();
                        caches.open(CACHE_NAME).then((cache) => {
                            cache.put(event.request, responseClone);
                        });
                        return networkResponse;
                    }
                    return networkResponse;
                })
                .catch(() => {
                    // Si falla la red (offline), intentar desde caché
                    return caches.match(event.request);
                })
        );
    } else {
        // Estrategia: Cache First (para assets estáticos como imágenes, estilos, scripts)
        event.respondWith(
            caches.match(event.request)
                .then((cachedResponse) => {
                    if (cachedResponse) {
                        // Actualizar en segundo plano
                        fetch(event.request)
                            .then((networkResponse) => {
                                if (networkResponse && networkResponse.status === 200) {
                                    const responseClone = networkResponse.clone();
                                    caches.open(CACHE_NAME).then((cache) => {
                                        cache.put(event.request, responseClone);
                                    });
                                }
                            }).catch(() => { });
                        return cachedResponse;
                    }
                    return fetch(event.request).then((networkResponse) => {
                        if (networkResponse && networkResponse.status === 200) {
                            const responseClone = networkResponse.clone();
                            caches.open(CACHE_NAME).then((cache) => {
                                cache.put(event.request, responseClone);
                            });
                        }
                        return networkResponse;
                    });
                })
        );
    }
});

// Escuchar mensajes desde la app para forzar actualización
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }

    if (event.data && event.data.type === 'CHECK_UPDATE') {
        // Verificar si hay una nueva versión disponible
        event.ports[0].postMessage({ version: APP_VERSION });
    }
});
