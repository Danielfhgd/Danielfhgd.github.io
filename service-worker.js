
// Service Worker con control de versiones
// IMPORTANTE: Cambiar esta versión cuando se actualice la app para forzar actualización del caché
// Ejemplo: '1.0.1', '1.0.2', '1.1.0', etc.
const APP_VERSION = '1.0.10';
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
    './assets/mapa-planta.svg',
    './assets/mapa-sotano.svg',
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

    // Estrategia: Cache First, luego Network
    // Esto asegura funcionamiento offline, pero actualiza cuando hay conexión
    event.respondWith(
        caches.match(event.request)
            .then((cachedResponse) => {
                // Si está en caché, devolverlo inmediatamente
                if (cachedResponse) {
                    // En segundo plano, intentar actualizar desde la red
                    fetch(event.request)
                        .then((networkResponse) => {
                            if (networkResponse && networkResponse.status === 200) {
                                const responseClone = networkResponse.clone();
                                caches.open(CACHE_NAME)
                                    .then((cache) => {
                                        cache.put(event.request, responseClone);
                                    });
                            }
                        })
                        .catch(() => {
                            // Si falla la red, mantener el caché
                        });

                    return cachedResponse;
                }

                // Si no está en caché, intentar obtenerlo de la red
                return fetch(event.request)
                    .then((response) => {
                        // Verificar que la respuesta sea válida
                        if (!response || response.status !== 200 || response.type === 'error') {
                            return response;
                        }

                        // Cachear la respuesta para uso futuro
                        const responseToCache = response.clone();
                        caches.open(CACHE_NAME)
                            .then((cache) => {
                                cache.put(event.request, responseToCache);
                            });

                        return response;
                    })
                    .catch(() => {
                        // Si falla la red y no hay caché, devolver una respuesta offline básica
                        if (event.request.destination === 'document' ||
                            event.request.url.endsWith('.html') ||
                            event.request.url === self.location.origin + '/' ||
                            event.request.url === self.location.origin + '/index.html') {
                            return caches.match('./index.html');
                        }

                        // Para otros recursos, devolver error
                        return new Response('Recurso no disponible offline', {
                            status: 503,
                            statusText: 'Service Unavailable',
                            headers: { 'Content-Type': 'text/plain' }
                        });
                    });
            })
    );
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
