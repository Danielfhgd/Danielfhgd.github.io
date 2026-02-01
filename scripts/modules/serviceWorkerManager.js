// Módulo para gestionar el Service Worker y actualizaciones

class ServiceWorkerManager {
    constructor() {
        this.registration = null;
        this.updateCheckInterval = null;
        this.init();
    }

    /**
     * Inicializa el Service Worker
     */
    async init() {
        if ('serviceWorker' in navigator) {
            try {
                // Registrar el Service Worker
                this.registration = await navigator.serviceWorker.register('./service-worker.js', {
                    scope: './'
                });

                console.log('[Service Worker] Registrado correctamente:', this.registration.scope);

                // Escuchar actualizaciones
                this.setupUpdateListeners();

                // Verificar actualizaciones periódicamente (cada 5 minutos)
                this.updateCheckInterval = setInterval(() => {
                    this.checkForUpdates();
                }, 5 * 60 * 1000);

                // Verificar actualizaciones al cargar la página
                this.checkForUpdates();
            } catch (error) {
                console.error('[Service Worker] Error al registrar:', error);
            }
        } else {
            console.warn('[Service Worker] No soportado en este navegador');
        }
    }

    /**
     * Configura los listeners para actualizaciones
     */
    setupUpdateListeners() {
        // Escuchar cuando hay un nuevo service worker disponible
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            console.log('[Service Worker] Nueva versión activada, recargando página...');
            window.location.reload();
        });

        // Escuchar mensajes del service worker
        navigator.serviceWorker.addEventListener('message', (event) => {
            if (event.data && event.data.type === 'UPDATE_AVAILABLE') {
                this.showUpdateNotification();
            }
        });
    }

    /**
     * Verifica si hay actualizaciones disponibles
     */
    async checkForUpdates() {
        if (!this.registration) return;

        try {
            await this.registration.update();
            
            // Verificar si hay un service worker esperando
            if (this.registration.waiting) {
                console.log('[Service Worker] Nueva versión disponible');
                this.promptUserUpdate();
            } else if (this.registration.installing) {
                console.log('[Service Worker] Instalando nueva versión...');
                this.trackInstallingWorker();
            }
        } catch (error) {
            console.error('[Service Worker] Error al verificar actualizaciones:', error);
        }
    }

    /**
     * Rastrea el service worker que se está instalando
     */
    trackInstallingWorker() {
        if (!this.registration) return;

        const installingWorker = this.registration.installing;
        if (!installingWorker) return;

        installingWorker.addEventListener('statechange', () => {
            if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                console.log('[Service Worker] Nueva versión instalada, esperando activación...');
                this.promptUserUpdate();
            }
        });
    }

    /**
     * Solicita al usuario que actualice
     */
    promptUserUpdate() {
        // Por ahora solo recargamos automáticamente
        // En el futuro se puede agregar un diálogo de confirmación
        if (this.registration && this.registration.waiting) {
            // Enviar mensaje al service worker para que se active
            this.registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        }
    }

    /**
     * Muestra una notificación de actualización (para uso futuro)
     */
    showUpdateNotification() {
        // Esto se puede implementar con un toast o banner
        console.log('[Service Worker] Actualización disponible');
    }

    /**
     * Fuerza una verificación de actualización
     */
    async forceUpdateCheck() {
        await this.checkForUpdates();
    }
}

export default ServiceWorkerManager;
