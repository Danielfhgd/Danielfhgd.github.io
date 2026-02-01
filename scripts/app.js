// Main application entry point

import MapLoader from './modules/mapLoader.js';
import FloorManager from './modules/floorManager.js';
import ZoomController from './modules/zoomController.js';
import RouteModal from './modules/routeModal.js';
import RouteSearch from './modules/routeSearch.js';
import ServiceWorkerManager from './modules/serviceWorkerManager.js';
import FloorTitleManager from './modules/floorTitleManager.js';
import AdminProfileManager from './modules/adminProfileManager.js';
import AdminMapEditor from './modules/adminMapEditor.js';
import RouteManager from './modules/routeManager.js';

// Inicializar la aplicación cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {

    // Inicializar el Service Worker (debe ser lo primero)
    try {
        const serviceWorkerManager = new ServiceWorkerManager();
    } catch (e) {
        console.error('Error inicializando ServiceWorkerManager:', e);
    }

    // Inicializar Profile Manager
    let adminProfileManager;
    try {
        adminProfileManager = new AdminProfileManager();
    } catch (e) {
        console.error('Error inicializando AdminProfileManager:', e);
    }

    // Inicializar Map Editor (Agregar ubicaciones)
    let adminMapEditor;
    try {
        adminMapEditor = new AdminMapEditor();
        // Sincronizar estado inicial
        if (document.body.classList.contains('admin-mode-active')) {
            adminMapEditor.setAdminState(true);
        }
    } catch (e) {
        console.error('Error inicializando AdminMapEditor:', e);
    }

    // Inicializar el cargador de mapas
    let mapLoader;
    try {
        mapLoader = new MapLoader();
    } catch (e) {
        console.error('Error inicializando MapLoader:', e);
    }

    // Inicializar el gestor de títulos de piso (Header)
    let floorTitleManager;
    try {
        floorTitleManager = new FloorTitleManager();
    } catch (e) {
        console.error('Error inicializando FloorTitleManager:', e);
    }

    // Inicializar el gestor de pisos
    let floorManager;
    try {
        if (mapLoader) {
            floorManager = new FloorManager(mapLoader);

            // Sincronizar el título inicial y cambios futuros (solo si ambos existen)
            if (floorTitleManager) {
                const originalUpdateDisplay = floorManager.updateFloorDisplay.bind(floorManager);
                floorManager.updateFloorDisplay = (displayText) => {
                    originalUpdateDisplay(displayText);
                    floorTitleManager.updateFloorTitle(displayText);
                };

                // Forzar actualización inicial
                setTimeout(() => {
                    try {
                        floorTitleManager.updateFloorTitle(floorManager.getCurrentFloor().display);
                    } catch (err) { console.warn('No se pudo actualizar titulo inicial', err); }
                }, 500);
            }
        }
    } catch (e) {
        console.error('Error inicializando FloorManager:', e);
    }

    // Inicializar el controlador de zoom
    try {
        const mapContainer = document.getElementById('map-wrapper');
        const zoomController = new ZoomController(mapContainer);
    } catch (e) {
        console.error('CRITICAL: Error inicializando ZoomController:', e);
    }

    // Inicializar el buscador de rutas (NUEVO RouteManager)
    let routeManager;
    try {
        if (mapLoader && floorManager) {
            routeManager = new RouteManager(mapLoader, floorManager);
        }
    } catch (e) {
        console.error('Error inicializando RouteManager:', e);
    }


    // Inicializar el modal de rutas y admin
    try {

        // --- LOGICA DE ADMIN MODE ---
        // Observador para cambios de clase en el body (detectar admin-mode)
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.attributeName === 'class') {
                    const isAdmin = document.body.classList.contains('admin-mode-active');
                    if (adminProfileManager) adminProfileManager.setAdminState(isAdmin);
                    if (adminMapEditor) adminMapEditor.setAdminState(isAdmin);

                    // Actualizar texto del botón de candado
                    const adminBtnText = document.querySelector('[data-action="admin"] .item-text');
                    if (adminBtnText) {
                        adminBtnText.textContent = isAdmin ? 'Salir Modo Admin' : 'Modo Admin';
                    }
                }
            });
        });
        observer.observe(document.body, { attributes: true });

        // Chequeo inicial
        if (document.body.classList.contains('admin-mode-active') && adminProfileManager) {
            adminProfileManager.setAdminState(true);
        }
    } catch (e) {
        console.error('Error inicializando RouteModal / AdminLogic:', e);
    }

    // Inicializar modo inmersivo
    try {
        initImmersiveMode();
    } catch (e) {
        console.error('Error inicializando Modo Inmersivo:', e);
    }

    // Inicializar menú desplegable
    try {
        initDropdownMenu(adminProfileManager);
    } catch (e) {
        console.error('Error inicializando Menú Desplegable:', e);
    }

    console.log('Aplicación operativa');
});

/**
 * Inicializa el modo inmersivo
 */
function initImmersiveMode() {
    const immersiveBtn = document.getElementById('immersive-btn');
    const body = document.body;

    if (!immersiveBtn) {
        console.warn('Botón de modo inmersivo no encontrado');
        return;
    }

    // Estado del modo inmersivo
    let isImmersiveMode = false;

    // Toggle del modo inmersivo
    immersiveBtn.addEventListener('click', () => {
        isImmersiveMode = !isImmersiveMode;
        const iconSpan = immersiveBtn.querySelector('.immersive-icon');

        if (isImmersiveMode) {
            // Activar modo inmersivo
            body.classList.add('immersive-mode');
            immersiveBtn.classList.add('immersive-mode');
            immersiveBtn.setAttribute('aria-label', 'Salir del modo inmersivo');
            if (iconSpan) iconSpan.textContent = '👁️‍🗨️';
        } else {
            // Desactivar modo inmersivo
            body.classList.remove('immersive-mode');
            immersiveBtn.classList.remove('immersive-mode');
            immersiveBtn.setAttribute('aria-label', 'Modo inmersivo');
            if (iconSpan) iconSpan.textContent = '👁️';
        }
    });

    // Salir del modo inmersivo al presionar ESC
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && isImmersiveMode) {
            isImmersiveMode = false;
            body.classList.remove('immersive-mode');
            immersiveBtn.classList.remove('immersive-mode');
            immersiveBtn.setAttribute('aria-label', 'Modo inmersivo');
            const iconSpan = immersiveBtn.querySelector('.immersive-icon');
            if (iconSpan) iconSpan.textContent = '👁️';
        }
    });

    // Salir del modo inmersivo cuando se abre el modal
    const routeModal = document.getElementById('route-modal');
    if (routeModal) {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                    if (routeModal.classList.contains('active') && isImmersiveMode) {
                        // Salir del modo inmersivo cuando se abre el modal
                        isImmersiveMode = false;
                        body.classList.remove('immersive-mode');
                        immersiveBtn.classList.remove('immersive-mode');
                        immersiveBtn.setAttribute('aria-label', 'Modo inmersivo');
                        const iconSpan = immersiveBtn.querySelector('.immersive-icon');
                        if (iconSpan) iconSpan.textContent = '👁️';
                    }
                }
            });
        });
        observer.observe(routeModal, { attributes: true });
    }

}

/**
 * Inicializa el menú desplegable del header
 */
/**
 * Inicializa el menú desplegable del header
 * @param {AdminProfileManager} adminProfileManager - Instancia del gestor de perfil
 */
function initDropdownMenu(adminProfileManager) {
    const dropdownToggle = document.querySelector('.dropdown-toggle');
    const dropdownContent = document.querySelector('.dropdown-content');

    if (!dropdownToggle || !dropdownContent) {
        console.warn('Elementos del menú desplegable no encontrados');
        return;
    }

    // Toggle del menú desplegable
    dropdownToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdownContent.classList.toggle('active');
        dropdownToggle.setAttribute('aria-expanded', dropdownContent.classList.contains('active'));
    });

    // Cerrar el menú al hacer click fuera
    document.addEventListener('click', (e) => {
        if (!dropdownToggle.contains(e.target) && !dropdownContent.contains(e.target)) {
            dropdownContent.classList.remove('active');
            dropdownToggle.setAttribute('aria-expanded', 'false');
        }
    });

    // Cerrar el menú al presionar ESC
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && dropdownContent.classList.contains('active')) {
            dropdownContent.classList.remove('active');
            dropdownToggle.setAttribute('aria-expanded', 'false');
        }
    });

    // Manejar navegación por teclado
    dropdownContent.addEventListener('keydown', (e) => {
        const items = dropdownContent.querySelectorAll('.dropdown-item');
        const currentIndex = Array.from(items).findIndex(item => item === document.activeElement);

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                const nextIndex = currentIndex < items.length - 1 ? currentIndex + 1 : 0;
                items[nextIndex].focus();
                break;
            case 'ArrowUp':
                e.preventDefault();
                const prevIndex = currentIndex > 0 ? currentIndex - 1 : items.length - 1;
                items[prevIndex].focus();
                break;
            case 'Enter':
            case ' ':
                e.preventDefault();
                document.activeElement.click();
                break;
        }
    });

    // Manejar clicks en los items del menú
    const menuItems = dropdownContent.querySelectorAll('.dropdown-item');
    menuItems.forEach(item => {
        item.addEventListener('click', (e) => {
            const action = item.dataset.action;

            switch (action) {
                case 'menu':
                    // Aquí puedes agregar navegación al menú principal
                    window.location.href = 'menu.html';
                    break;
                case 'help':
                    showHelpModal();
                    break;
                case 'admin':
                    if (document.body.classList.contains('admin-mode-active')) {
                        if (confirm('¿Quieres salir del modo admin?')) {
                            document.body.classList.remove('admin-mode-active');
                            console.log('Modo admin desactivado');
                        }
                    } else {
                        showAdminModal();
                    }
                    break;
                case 'admin-profile':
                    if (adminProfileManager) {
                        adminProfileManager.abrirPanel();
                    } else {
                        console.error('AdminProfileManager no disponible');
                    }
                    break;
            }

            dropdownContent.classList.remove('active');
            dropdownToggle.setAttribute('aria-expanded', 'false');
        });
    });

}


/**
 * Muestra el modal de ayuda
 */
function showHelpModal() {
    const helpModal = document.getElementById('help-modal');
    const helpModalClose = document.getElementById('help-modal-close');
    const helpModalOverlay = document.getElementById('help-modal-overlay');

    if (!helpModal) {
        console.warn('Modal de ayuda no encontrado');
        return;
    }

    // Mostrar el modal
    helpModal.classList.add('active');

    // Función para cerrar el modal
    const closeModal = () => {
        helpModal.classList.remove('active');
    };

    // Event listeners para cerrar el modal
    helpModalClose.addEventListener('click', closeModal);
    helpModalOverlay.addEventListener('click', closeModal);

    // Cerrar con tecla ESC
    const handleEscape = (e) => {
        if (e.key === 'Escape') {
            closeModal();
            document.removeEventListener('keydown', handleEscape);
        }
    };
    document.addEventListener('keydown', handleEscape);

    // Remover event listeners cuando se cierre el modal
    helpModal.addEventListener('transitionend', () => {
        if (!helpModal.classList.contains('active')) {
            helpModalClose.removeEventListener('click', closeModal);
            helpModalOverlay.removeEventListener('click', closeModal);
        }
    }, { once: true });

}

/**
 * Muestra el modal de inicio de sesión de administrador
 */
function showAdminModal() {
    const adminModal = document.getElementById('admin-modal');
    const adminModalClose = document.getElementById('admin-modal-close');
    const adminModalOverlay = document.getElementById('admin-modal-overlay');
    const adminLoginForm = document.getElementById('admin-login-form');
    const adminErrorMessage = document.getElementById('admin-error-message');

    if (!adminModal) {
        console.warn('Modal de administrador no encontrado');
        return;
    }

    // Limpiar errores previos
    if (adminErrorMessage) adminErrorMessage.classList.remove('active');
    if (adminLoginForm) adminLoginForm.reset();

    // Mostrar el modal
    adminModal.classList.add('active');

    // Función para cerrar el modal
    const closeModal = () => {
        adminModal.classList.remove('active');
    };

    // Event listeners para cerrar el modal
    adminModalClose.addEventListener('click', closeModal);
    adminModalOverlay.addEventListener('click', closeModal);

    // Cerrar con tecla ESC
    document.addEventListener('keydown', function handleEscape(e) {
        if (e.key === 'Escape') {
            closeModal();
            document.removeEventListener('keydown', handleEscape);
        }
    });

    // Manejar el envío del formulario
    const handleSubmit = (e) => {
        e.preventDefault();
        const user = document.getElementById('admin-user').value;
        const pass = document.getElementById('admin-password').value;

        // Validación de credenciales
        if (user === 'admin' && pass === 'admin@123') {
            alert('¡Bienvenido, Administrador!');
            closeModal();
            // Aquí se activaría el modo administrador real en el futuro
            document.body.classList.add('admin-mode-active');
        } else {
            console.warn('Credenciales de administrador incorrectas');
            if (adminErrorMessage) {
                adminErrorMessage.classList.add('active');
                // Vibración visual si falla
                adminModal.querySelector('.route-modal-content').animate([
                    { transform: 'translateX(-5px)' },
                    { transform: 'translateX(5px)' },
                    { transform: 'translateX(-5px)' },
                    { transform: 'translateX(0)' }
                ], { duration: 300 });
            }
        }
    };

    adminLoginForm.addEventListener('submit', handleSubmit, { once: true });
}

