/**
 * Módulo para gestionar el cálculo de rutas y sugerencias
 * Migrado y adaptado de la "Nueva carpeta/script.js"
 */

class RouteManager {
    constructor(mapLoader, floorManager) {
        this.mapLoader = mapLoader;
        this.floorManager = floorManager;

        // Elementos UI del Modal de Rutas
        this.originInput = document.getElementById('origin-search');
        this.destInput = document.getElementById('destination-search');
        this.originSuggestions = document.getElementById('origin-suggestions');
        this.destSuggestions = document.getElementById('destination-suggestions');
        this.btnCalculate = document.getElementById('route-calculate-btn'); // Botón DENTRO del modal
        this.statusBar = document.getElementById('status-bar'); // Creado recientemente

        // Modal control
        this.modal = document.getElementById('route-modal');
        this.btnOpenModal = document.getElementById('calculate-route-btn'); // Botón en el mapa
        this.btnCloseModal = document.getElementById('route-modal-close');
        this.modalOverlay = document.getElementById('route-modal-overlay');

        // Constantes de filtrado
        this.LUGARES_CONEXION = ['escalera_izquierda', 'escalera_derecha'];

        // Estado
        this.locations = []; // Lista plana para búsqueda
        this.data = {}; // Datos crudos

        this.init();
    }

    bindEvents() {
        // Inputs de búsqueda
        if (this.originInput) {
            this.originInput.addEventListener('input', (e) => this.showSuggestions(e.target.value, 'origin'));
            this.originInput.addEventListener('focus', (e) => this.showSuggestions(e.target.value, 'origin'));
        }
        if (this.destInput) {
            this.destInput.addEventListener('input', (e) => this.showSuggestions(e.target.value, 'dest'));
            this.destInput.addEventListener('focus', (e) => this.showSuggestions(e.target.value, 'dest'));
        }

        // Clic fuera para cerrar sugerencias
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.route-search-wrapper')) {
                if (this.originSuggestions) this.originSuggestions.innerHTML = '';
                if (this.destSuggestions) this.destSuggestions.innerHTML = '';
            }
        });

        // Botón Calcular
        if (this.btnCalculate) {
            this.btnCalculate.addEventListener('click', (e) => {
                this.handleCalculate();
            });
        }

        // Modal opening button
        if (this.btnOpenModal) {
            this.btnOpenModal.addEventListener('click', () => {
                // Actualizar datos por si hubo cambios en el editor
                this.loadData();
                this.modal.classList.add('active');
            });
        }
        if (this.btnCloseModal) this.btnCloseModal.addEventListener('click', () => this.modal.classList.remove('active'));
        if (this.modalOverlay) this.modalOverlay.addEventListener('click', () => this.modal.classList.remove('active'));

        // Escuchar cambio de piso
        document.addEventListener('floorChanged', (e) => this.handleFloorChanged(e));
    }

    handleFloorChanged(e) {
        if (!this.currentRouteState) return;

        const { detail } = e;
        const currentFloorName = detail.floorName;

        if (this.currentRouteState.type === 'multifloor') {
            const { pisoOrigin, pisoDest, pOrigin, pDest, stairOrigin, stairDest } = this.currentRouteState;

            if (currentFloorName === pisoOrigin) {
                // Reset status info for origin
                if (this.statusBar) this.statusBar.innerText = `➡️ Diríjase a la escalera ${this.currentRouteState.stairName}`;
                // Importante: Volver a dibujar.
                this.drawRoute(pOrigin, stairOrigin);
            }
            else if (currentFloorName === pisoDest) {
                if (this.statusBar) this.statusBar.innerText = `🏁 Llegada: Diríjase a ${this.destInput.value}`;
                this.drawRoute(stairDest, pDest);
            }
            else {
                // Piso intermedio o ajeno
                if (this.mapLoader.ctx) {
                    this.mapLoader.ctx.clearRect(0, 0, this.mapLoader.canvas.width, this.mapLoader.canvas.height);
                    if (this.mapLoader.animationFrameId) cancelAnimationFrame(this.mapLoader.animationFrameId);
                }
                if (this.statusBar) this.statusBar.innerText = `Navegación activa. Vaya al piso ${pisoOrigin} o ${pisoDest}.`;
            }
        }
        else {
            // Ruta simple (mismo piso)
            const { pisoOrigin, pOrigin, pDest } = this.currentRouteState;
            if (currentFloorName === pisoOrigin) {
                this.drawRoute(pOrigin, pDest);
            } else {
                if (this.mapLoader.ctx) {
                    this.mapLoader.ctx.clearRect(0, 0, this.mapLoader.canvas.width, this.mapLoader.canvas.height);
                    if (this.mapLoader.animationFrameId) cancelAnimationFrame(this.mapLoader.animationFrameId);
                }
            }
        }
    }

    showSuggestions(query, type) {
        const container = type === 'origin' ? this.originSuggestions : this.destSuggestions;
        if (!container) return;

        container.innerHTML = '';
        if (!query && query !== '') return;

        const layout = this.locations.filter(loc =>
            loc.name.toLowerCase().includes(query.toLowerCase())
        ).slice(0, 5); // Max 5 sugerencias

        layout.forEach(loc => {
            const div = document.createElement('div');
            div.className = 'route-suggestion-item';
            div.textContent = loc.fullString;
            div.dataset.id = loc.id; // piso|zona|lugar
            div.style.padding = '8px';
            div.style.cursor = 'pointer';
            div.style.borderBottom = '1px solid #eee';

            div.addEventListener('click', () => {
                const input = type === 'origin' ? this.originInput : this.destInput;
                input.value = loc.name;
                input.dataset.selectedId = loc.id; // Guardamos el ID real
                container.innerHTML = '';
            });

            container.appendChild(div);
        });

        container.style.display = layout.length ? 'block' : 'none';
        if (layout.length) {
            container.style.background = 'white';
            container.style.border = '1px solid #ccc';
            container.style.position = 'absolute';
            container.style.width = '100%';
            container.style.zIndex = '100';
            container.style.borderRadius = '0 0 4px 4px';
        }
    }

    async init() {
        await this.loadData();
        this.bindEvents();
    }

    async loadData() {
        try {
            const local = localStorage.getItem('mapaDataUBV');
            if (local) {
                try {
                    this.data = JSON.parse(local);
                } catch (e) {
                    console.warn("Corrupt localStorage, falling back to JSON");
                    localStorage.removeItem('mapaDataUBV');
                }
            }

            if (!this.data || Object.keys(this.data).length === 0) {
                try {
                    let res = await fetch('./data/dataUBV.json');
                    if (!res.ok) res = await fetch('./Nueva carpeta/dataUBV.json');

                    if (res.ok) {
                        const text = await res.text();
                        try {
                            this.data = JSON.parse(text);
                        } catch (parseError) {
                            console.error("JSON Error:", parseError, "Content:", text.substring(0, 100));
                        }
                    }
                } catch (fetchError) {
                    console.error("Fetch Error:", fetchError);
                }
            }

            this.flattenLocations();

            // Fallback if empty
            if (this.locations.length === 0 && local) {
                let res = await fetch('./data/dataUBV.json');
                if (res.ok) {
                    this.data = await res.json();
                    this.flattenLocations();
                }
            }
        } catch (e) {
            console.error("RouteManager: Error cargando datos", e);
        }
    }

    flattenLocations() {
        this.locations = [];
        if (!this.data) return;

        Object.keys(this.data).forEach(piso => {
            Object.keys(this.data[piso]).forEach(zona => {
                if (zona === 'imagen' || zona === 'svg' || zona === 'image') return;

                const contenido = this.data[piso][zona];
                const items = Array.isArray(contenido) ?
                    contenido.reduce((acc, item) => ({ ...acc, [Object.keys(item)[0]]: Object.values(item)[0] }), {}) :
                    contenido;

                if (!items) return;

                Object.keys(items).forEach(lugar => {
                    const lowerLugar = lugar.toLowerCase().trim();
                    if (this.LUGARES_CONEXION.some(c => c === lowerLugar)) return;

                    this.locations.push({
                        name: lugar,
                        floor: piso,
                        zone: zona,
                        coords: items[lugar].coordenadas || items[lugar],
                        fullString: `${lugar} (${piso})`,
                        id: `${piso}|${zona}|${lugar}`
                    });
                });
            });
        });
    }

    handleCalculate() {
        let originId = this.originInput.dataset.selectedId;
        let destId = this.destInput.dataset.selectedId;

        if (!originId && this.originInput.value) {
            const val = this.originInput.value.toLowerCase().trim();
            const found = this.locations.find(l => l.name.toLowerCase() === val);
            if (found) originId = found.id;
        }
        if (!destId && this.destInput.value) {
            const val = this.destInput.value.toLowerCase().trim();
            const found = this.locations.find(l => l.name.toLowerCase() === val);
            if (found) destId = found.id;
        }

        if (!originId || !destId) {
            alert("Por favor selecciona origen y destino válidos de la lista.");
            return;
        }

        this.calculateRoute(originId, destId);
        this.modal.classList.remove('active');
    }

    async calculateRoute(originId, destId) {
        const [pisoO, zonaO, lugarO] = originId.split('|');
        const [pisoD, zonaD, lugarD] = destId.split('|');

        const pA = this.getLocationCoords(pisoO, zonaO, lugarO);
        const pB = this.getLocationCoords(pisoD, zonaD, lugarD);

        if (!pA || !pB) {
            alert("Error obteniendo coordenadas.");
            return;
        }

        const targetFloorKey = pisoO.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '');

        if (this.floorManager) {
            await this.floorManager.loadFloor(targetFloorKey);
            const display = pisoO.match(/\d+/) ? pisoO.match(/\d+/)[0] : pisoO.charAt(0);
            this.floorManager.updateFloorDisplay(display);
        }

        if (this.statusBar) {
            this.statusBar.style.position = 'absolute';
            this.statusBar.style.top = '10px';
            this.statusBar.style.left = '50%';
            this.statusBar.style.transform = 'translateX(-50%)';
            this.statusBar.style.zIndex = '1000';
            this.statusBar.style.marginTop = '0';
            this.statusBar.style.maxWidth = '90%';
            this.statusBar.style.width = 'auto';
            this.statusBar.style.bottom = 'auto';
        }

        // Pequeño delay extra para asegurar renderizado del canvas
        await new Promise(r => setTimeout(r, 100));

        // Comprobación de pisos más robusta (ignora espacios y mayúsculas)
        const diffFloors = pisoO.replace(/\s+/g, '').toLowerCase() !== pisoD.replace(/\s+/g, '').toLowerCase();

        if (diffFloors) {
            // Obtener claves técnicas de los pisos para buscar escaleras específicas
            const keyO = pisoO.toLowerCase().trim().replace(/[^a-z0-9]/g, '_');
            const keyD = pisoD.toLowerCase().trim().replace(/[^a-z0-9]/g, '_');

            // Helper para buscar coordenadas de escalera de forma robusta
            const findStairCoords = (piso, zona, baseName, targetFloorKey) => {
                // 1. Intentar nombre específico: "escalera_derecha_sotano"
                const specificName = `${baseName}_${targetFloorKey}`;
                let res = this.getLocationCoords(piso, zona, specificName);

                // 2. Intentar nombre genérico: "escalera_derecha"
                if (!res) res = this.getLocationCoords(piso, zona, baseName);

                // 3. Fallbacks de zona/case (mantener compatibilidad)
                if (!res) res = this.getLocationCoords(piso, zona.toLowerCase(), baseName);
                if (!res) res = this.getLocationCoords(piso, zona.replace('_', '-'), baseName);
                if (!res) res = this.getLocationCoords(piso, 'Ala_Este', baseName);
                if (!res) res = this.getLocationCoords(piso, 'Ala_Oeste', baseName);

                return res;
            };

            // Buscar escaleras en origen que conecten con el destino
            let escIzq = findStairCoords(pisoO, 'Ala_Oeste', 'escalera_izquierda', keyD);
            let escDer = findStairCoords(pisoO, 'Ala_Este', 'escalera_derecha', keyD);

            if (!escIzq && !escDer) {
                this.statusBar.innerText = `⚠️ Falta escalera en ${pisoO} para ir al ${pisoD}.`;
                this.drawRoute(pA, pB);
                return;
            }

            // Buscar escaleras en destino que conecten con el origen
            let escIzqD = findStairCoords(pisoD, 'Ala_Oeste', 'escalera_izquierda', keyO);
            let escDerD = findStairCoords(pisoD, 'Ala_Este', 'escalera_derecha', keyO);

            // Calcular distancias
            const dist = (p1, p2) => Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));

            let costoIzq = Infinity;
            let costoDer = Infinity;

            const toObj = (val) => {
                if (!val) return null;
                return Array.isArray(val) ? { x: val[0], y: val[1] } : (val.coordenadas ? { x: val.coordenadas[0], y: val.coordenadas[1] } : val);
            };

            const oObj = toObj(pA);
            const dObj = toObj(pB);

            if (escIzq && escIzqD) {
                costoIzq = dist(oObj, toObj(escIzq)) + dist(dObj, toObj(escIzqD));
            }
            if (escDer && escDerD) {
                costoDer = dist(oObj, toObj(escDer)) + dist(dObj, toObj(escDerD));
            }

            // Si no hay escaleras en el destino que coincidan, usar lo que haya disponible
            if (costoIzq === Infinity && costoDer === Infinity) {
                if (escIzq) costoIzq = 0;
                else if (escDer) costoDer = 0;
            }

            const usarIzquierda = costoIzq <= costoDer;
            const destinoEscalera = usarIzquierda ? escIzq : escDer;
            const nombreEscalera = usarIzquierda ? "Escalera Izquierda" : "Escalera Derecha";

            if (!destinoEscalera) {
                this.statusBar.innerText = "⚠️ Error calculando ruta a escalera.";
                return;
            }

            // GUARDAR ESTADO DE LA RUTA GLOBAL
            this.currentRouteState = {
                type: 'multifloor',
                pisoOrigin: pisoO,
                pisoDest: pisoD,
                pOrigin: pA,
                pDest: pB,
                stairOrigin: destinoEscalera,
                stairDest: usarIzquierda ? escIzqD : escDerD,
                stairName: nombreEscalera
            };

            const formatDest = (name) => {
                if (/sotano/i.test(name)) return "al Sótano";
                return `al ${name}`;
            };

            if (this.statusBar) this.statusBar.innerText = `➡️ Diríjase a ${nombreEscalera} para ir ${formatDest(pisoD)}`;

            // Dibujar ruta: Origen -> Escalera seleccionada
            this.drawRoute(pA, destinoEscalera);

        } else {
            // Mismo piso
            // Limpia estado multifloor previo si existía
            this.currentRouteState = {
                type: 'simple',
                pisoOrigin: pisoO,
                pOrigin: pA,
                pDest: pB
            };

            // Simplificado: Solo nombre del lugar, sin zona
            if (this.statusBar) this.statusBar.innerText = `🏁 Destino en este piso: ${lugarD}`;
            if (this.statusBar) this.statusBar.style.backgroundColor = '#e8f5e9'; // Verde éxito
            this.drawRoute(pA, pB);
        }
    }

    getLocationCoords(piso, zona, lugar) {
        // Helper flexible para encontrar datos
        try {
            // Intentar acceso directo
            let data = this.data[piso]?.[zona]?.[lugar];

            // Si falló, buscar case-insensitive en zonas
            if (!data && this.data[piso]) {
                const zKey = Object.keys(this.data[piso]).find(k => k.toLowerCase() === zona.toLowerCase());
                if (zKey) data = this.data[piso][zKey][lugar];
            }

            // Manejo estructura vieja (Array de objetos)
            // "ala-este": [ {"Aula": {...}}, ... ]
            if (!data && this.data[piso]) {
                const zonaObj = this.data[piso][zona] || Object.values(this.data[piso]).find(z => Array.isArray(z));
                if (Array.isArray(zonaObj)) {
                    const item = zonaObj.find(i => i[lugar]);
                    if (item) data = item[lugar];
                }
            }

            // Retorno normalizado
            if (data) {
                if (data.coordenadas) return data.coordenadas; // Estructura vieja {coordenadas: [x,y]}
                if (data.x !== undefined) return data; // Estructura nueva {x:0, y:0}
                if (Array.isArray(data)) return data; // Raw [x,y]
            }
        } catch (e) { console.error("Error buscando coords", e); }
        return null;
    }

    drawRoute(startData, endData) {
        // Normalizar a coordenadas 0-1 para el MapLoader
        // Si vienen en pixeles ( > 1), normalizar usando tamaño imagen actual?
        // MapLoader espera coords. Si son pixeles (data vieja), MapLoader.drawRouteFromCoords maneja arrays [x,y].
        // Pero si la imagen cargada ahora tiene resolución distinta a la original, fallará.
        // Asunción: dataUBV original coordenadas en pixeles sobre imagen original.

        let start = startData;
        let end = endData;

        // Convertir a Array [x, y] si es objeto
        if (start.x !== undefined) start = [start.x, start.y];
        else if (start.coordenadas) start = start.coordenadas;

        if (end.x !== undefined) end = [end.x, end.y];
        else if (end.coordenadas) end = end.coordenadas;

        // Normalizar!
        // El script viejo usaba coordenadas fijas (ej 450, 320).
        // Necesitamos saber dimensiones base. El script viejo usaba `img.naturalWidth`.
        // Vamos a pasar las coordenadas tal cual, y MapLoader decidirá.
        // Pero MapLoader tiene `toPixel`. Si recibe > 1, asume pixel.
        // PERO: Si la imagen se muestra reescalada en CSS, MapLoader usa el canvas size interno (natural size), así que debería funcionar.

        this.mapLoader.drawRouteFromCoords(start, end);
    }
}

export default RouteManager;
