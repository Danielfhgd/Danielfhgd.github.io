// Módulo para gestionar el cambio entre pisos

class FloorManager {
    constructor(mapLoader) {
        this.mapLoader = mapLoader;
        this.floors = {}; // se cargará desde data (imagen o svg)
        this.floorOrder = [];
        this.currentFloorIndex = 0; // se ajustará tras cargar configuración

        // Inicializamos controles (listeners) pero no cargamos un piso hasta que tengamos config
        this.init();

        // Cargar configuración de pisos desde JSON (preferencia: 'Nueva carpeta/dataUBV.json')
        // Exponer la promesa como `this.ready` para que otras partes esperen la carga
        this.ready = this.loadConfig();
    }

    /**
     * Inicializa los event listeners para los botones de cambio de piso
     */
    init() {
        const floorUpBtn = document.getElementById('floor-up');
        const floorDownBtn = document.getElementById('floor-down');
        const floorDisplay = document.getElementById('floor-display');

        if (!floorUpBtn || !floorDownBtn || !floorDisplay) {
            console.error('No se encontraron los elementos de control de piso');
            return;
        }

        // Event listener para subir de piso (funciona en PC y móvil)
        floorUpBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.goToNextFloor();
        });

        // También agregar touchstart para móviles
        floorUpBtn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.goToNextFloor();
        });

        // Event listener para bajar de piso (funciona en PC y móvil)
        floorDownBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.goToPreviousFloor();
        });

        // También agregar touchstart para móviles
        floorDownBtn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.goToPreviousFloor();
        });

        // No cargamos el piso aquí: se cargará cuando termine loadConfig()
    }

    /**
     * Carga un piso específico
     * @param {string} floorKey - Clave del piso ('sotano' o 'piso1')
     */
    async loadFloor(floorKey) {
        const floor = this.floors[floorKey];
        if (!floor) {
            console.error(`Piso no encontrado: ${floorKey}`);
            return;
        }

        const success = await this.mapLoader.loadMap(floor.path);
        if (success) {
            this.currentFloorIndex = floor.index;
            this.updateFloorDisplay(floor.display);

            // Notificar cambio de piso
            document.dispatchEvent(new CustomEvent('floorChanged', {
                detail: {
                    floorName: floor.name,
                    display: floor.display,
                    path: floor.path
                }
            }));
        } else {
            console.error(`Error al cargar el piso: ${floor.name}`);
        }
    }

    /**
     * Va al siguiente piso
     */
    goToNextFloor() {
        if (this.currentFloorIndex < this.floorOrder.length - 1) {
            this.currentFloorIndex++;
            const nextFloorKey = this.floorOrder[this.currentFloorIndex];
            this.loadFloor(nextFloorKey);
        }
    }

    /**
     * Va al piso anterior
     */
    goToPreviousFloor() {
        if (this.currentFloorIndex > 0) {
            this.currentFloorIndex--;
            const previousFloorKey = this.floorOrder[this.currentFloorIndex];
            this.loadFloor(previousFloorKey);
        }
    }

    /**
     * Actualiza la visualización del piso actual
     * @param {string} displayText - Texto a mostrar (S, 1, 2, etc.)
     */
    updateFloorDisplay(displayText) {
        const floorDisplay = document.getElementById('floor-display');
        if (floorDisplay) {
            floorDisplay.textContent = displayText;
        }

        // Actualizar estado de los botones
        this.updateFloorButtons();
    }

    /**
     * Actualiza el estado de los botones (habilitar/deshabilitar)
     */
    updateFloorButtons() {
        const floorUpBtn = document.getElementById('floor-up');
        const floorDownBtn = document.getElementById('floor-down');

        if (floorUpBtn) {
            floorUpBtn.disabled = this.currentFloorIndex >= this.floorOrder.length - 1;
            if (floorUpBtn.disabled) {
                floorUpBtn.style.opacity = '0.5';
                floorUpBtn.style.cursor = 'not-allowed';
            } else {
                floorUpBtn.style.opacity = '1';
                floorUpBtn.style.cursor = 'pointer';
            }
        }

        if (floorDownBtn) {
            floorDownBtn.disabled = this.currentFloorIndex <= 0;
            if (floorDownBtn.disabled) {
                floorDownBtn.style.opacity = '0.5';
                floorDownBtn.style.cursor = 'not-allowed';
            } else {
                floorDownBtn.style.opacity = '1';
                floorDownBtn.style.cursor = 'pointer';
            }
        }
    }

    /**
     * Obtiene el piso actual
     * @returns {Object} - Información del piso actual
     */
    getCurrentFloor() {
        const currentFloorKey = this.floorOrder[this.currentFloorIndex];
        return this.floors[currentFloorKey];
    }

    /**
     * Carga configuración de pisos desde JSON. Prioriza localStorage para reflejar cambios locales.
     */
    async loadConfig() {
        try {
            // 1. Intentar cargar desde localStorage (cambios del usuario)
            let dataStr = localStorage.getItem('mapaDataUBV');
            let data = dataStr ? JSON.parse(dataStr) : null;

            // 2. Si no hay en local, cargar el JSON estático del servidor
            if (!data) {
                try {
                    const res = await fetch('./data/dataUBV.json');
                    if (res.ok) data = await res.json();
                } catch (e) {
                    console.warn('No se pudo cargar dataUBV.json, intentando fallback...');
                    try {
                        const res2 = await fetch('./Nueva carpeta/dataUBV.json');
                        if (res2.ok) data = await res2.json();
                    } catch (e2) { }
                }
            }

            if (!data) {
                console.error('No se pudo cargar ningún JSON de configuración de mapas');
                return;
            }
            const keys = Object.keys(data);
            this.floorOrder = [];

            keys.forEach((floorName, idx) => {
                // Solo procesar si es un objeto de piso (tiene imagen/svg o sectores)
                if (typeof data[floorName] !== 'object' || Array.isArray(data[floorName])) return;

                // Generar una clave técnica robusta (p.ej. 'piso_2', 'sotano')
                let key = floorName.toLowerCase().trim().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
                // Caso especial para Sótano (quitar acentos manualmente si existen)
                if (/s[oót]ano/i.test(floorName)) key = 'sotano';

                // Determinar display (número o S etc.)
                let display = '';
                const m = floorName.match(/Piso\s*(\d+)/i);
                if (m) display = m[1];
                else if (/sotano/i.test(floorName)) display = 'S';
                else display = floorName.charAt(0).toUpperCase();

                // Determinar ruta del recurso
                let path = null;
                const fData = data[floorName];
                const rawPath = fData.imagen || fData.image || fData.svg;

                if (rawPath) {
                    path = rawPath.includes('/') ? rawPath : `assets/${rawPath}`;
                }

                // Fallback genérico
                if (!path) path = 'assets/Mapa-Piso1.png';

                this.floors[key] = {
                    name: floorName,
                    display: display,
                    path: path,
                    index: idx
                };

                this.floorOrder.push(key);
            });

            // Ordenar floorOrder: Sótano ('S') primero, luego pisos numéricos ascendentes
            const orderWeight = (k) => {
                const d = this.floors[k].display;
                if (d === 'S') return -1;
                const n = parseInt(d, 10);
                return isNaN(n) ? 999 : n;
            };

            this.floorOrder.sort((a, b) => orderWeight(a) - orderWeight(b));

            // Reasignar índices coherentes tras ordenar
            this.floorOrder.forEach((k, idx) => { this.floors[k].index = idx; });

            // Seleccionar 'Piso 1' por defecto
            const p1Index = this.floorOrder.findIndex(k =>
                this.floors[k].name.toLowerCase().trim() === 'piso 1' ||
                this.floors[k].display === '1'
            );

            this.currentFloorIndex = p1Index >= 0 ? p1Index : 0;

            // Cargar piso inicial
            this.loadFloor(this.floorOrder[this.currentFloorIndex]);
        } catch (error) {
            console.error('Error cargando configuración de pisos:', error);
        }
    }

    /**
     * Obtiene el índice del piso actual
     * @returns {number}
     */
    getCurrentFloorIndex() {
        return this.currentFloorIndex;
    }
}

export default FloorManager;
