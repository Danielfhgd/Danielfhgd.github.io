// Configuración de la aplicación
// Cambiar esta versión cuando se actualice la app para forzar actualización del caché

export const APP_VERSION = '1.0.0';

// Configuración del Service Worker
export const SW_CONFIG = {
    version: APP_VERSION,
    cacheName: `mapa-ubv-v${APP_VERSION}`,
    updateCheckInterval: 5 * 60 * 1000 // 5 minutos
};
