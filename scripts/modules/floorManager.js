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
        } else {
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
        } else {
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
     * Carga configuración de pisos desde JSON. Preferencia por 'Nueva carpeta/dataUBV.json'.
     */
    async loadConfig() {
        try {
            let data = null;
            // Intentar primero el JSON de la versión raster
            try {
                const res = await fetch('./data/dataUBV.json');
                if (res.ok) data = await res.json();
            } catch (e) {
                // ignorar
            }


            if (!data) {
                console.error('No se pudo cargar ningún JSON de configuración de mapas');
                return;
            }

            const keys = Object.keys(data);
            this.floorOrder = [];

            keys.forEach((floorName, idx) => {
                const key = floorName.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '');

                // Determinar display (número o S etc.)
                let display = '';
                const m = floorName.match(/Piso\s*(\d+)/i);
                if (m) display = m[1];
                else if (/sotano/i.test(floorName)) display = 'S';
                else display = floorName.charAt(0).toUpperCase();

                // Determinar ruta del recurso (priorizar 'imagen' o 'svg')
                let path = null;
                if (data[floorName].imagen) {
                    const raw = data[floorName].imagen;
                    path = raw.includes('/') ? raw : `Nueva carpeta/${raw}`;
                } else if (data[floorName].image) {
                    const raw = data[floorName].image;
                    path = raw.includes('/') ? raw : `Nueva carpeta/${raw}`;
                } else if (data[floorName].svg) {
                    path = data[floorName].svg; // puede ser .svg en assets
                }

                // Fallback genérico
                if (!path) path = 'assets/mapa-planta.svg';

                this.floors[key] = {
                    name: floorName,
                    display: display,
                    path: path,
                    index: idx
                };

                this.floorOrder.push(key);
            });

            // Ordenar floorOrder de abajo a arriba: Sótano ('S') primero, luego pisos numéricos ascendentes
            const orderWeight = (k) => {
                const d = this.floors[k].display;
                if (!d) return Number.MAX_SAFE_INTEGER;
                const s = String(d).trim();
                if (/^s$/i.test(s)) return -1; // sótano por debajo
                const n = parseInt(s, 10);
                if (!isNaN(n)) return n;
                return Number.MAX_SAFE_INTEGER;
            };

            this.floorOrder.sort((a, b) => orderWeight(a) - orderWeight(b));

            // Reasignar índices coherentes tras ordenar
            this.floorOrder.forEach((k, idx) => { this.floors[k].index = idx; });

            // Intentar seleccionar 'Piso 1' por defecto si existe
            const defaultIndex = this.floorOrder.findIndex(k => this.floors[k].name.toLowerCase().includes('piso 1'));
            this.currentFloorIndex = defaultIndex >= 0 ? defaultIndex : 0;

            // Actualizar display y botones
            this.updateFloorDisplay(this.getCurrentFloor().display);

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
