// Módulo para gestionar el modal de calcular ruta

class RouteModal {
    constructor(routeSearch) {
        this.modal = document.getElementById('route-modal');
        this.overlay = document.getElementById('route-modal-overlay');
        this.closeBtn = document.getElementById('route-modal-close');
        this.openBtn = document.getElementById('calculate-route-btn');
        this.routeSearch = routeSearch;

        this.init();
    }

    /**
     * Inicializa los event listeners
     */
    init() {
        if (!this.modal || !this.openBtn) {
            console.error('No se encontraron los elementos del modal de rutas');
            return;
        }

        // Abrir modal al presionar el botón
        this.openBtn.addEventListener('click', () => {
            this.open();
        });

        // Cerrar modal con el botón X
        if (this.closeBtn) {
            this.closeBtn.addEventListener('click', () => {
                this.close();
            });
        }

        // Cerrar modal al hacer clic en el overlay
        if (this.overlay) {
            this.overlay.addEventListener('click', () => {
                this.close();
            });
        }

        // Cerrar modal con la tecla ESC
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isOpen()) {
                this.close();
            }
        });

        // Prevenir cierre al hacer clic dentro del contenido
        const modalContent = this.modal.querySelector('.route-modal-content');
        if (modalContent) {
            modalContent.addEventListener('click', (e) => {
                e.stopPropagation();
            });
        }
    }

    /**
     * Abre el modal
     */
    open() {
        if (this.modal) {
            this.modal.classList.add('active');
            document.body.style.overflow = 'hidden';
        }
    }

    /**
     * Cierra el modal
     */
    close() {
        if (this.modal) {
            this.modal.classList.remove('active');
            document.body.style.overflow = '';
            
            // Limpiar errores y sugerencias al cerrar
            if (this.routeSearch) {
                this.routeSearch.clearError('origin');
                this.routeSearch.clearError('destination');
                this.routeSearch.hideSuggestions('origin');
                this.routeSearch.hideSuggestions('destination');
            }
        }
    }

    /**
     * Verifica si el modal está abierto
     * @returns {boolean}
     */
    isOpen() {
        return this.modal && this.modal.classList.contains('active');
    }
}

export default RouteModal;
