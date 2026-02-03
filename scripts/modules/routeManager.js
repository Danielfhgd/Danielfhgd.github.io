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

        // Helper de normalización (compartido internamente)
        this.normKey = (name) => {
            if (!name) return '';
            return name.toLowerCase().trim()
                .replace(/[áäâà]/g, 'a').replace(/[éëêè]/g, 'e').replace(/[íïîì]/g, 'i').replace(/[óöôò]/g, 'o').replace(/[úüûù]/g, 'u')
                .replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '').replace('stano', 'sotano');
        };

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

        // Escuchar actualización de datos (Sincronización en tiempo real)
        document.addEventListener('mapDataUpdated', () => {
            console.log("RouteManager: detectada actualización de datos, recargando...");
            this.loadData();
        });
    }

    handleFloorChanged(e) {
        if (!this.mapLoader || !this.mapLoader.ctx) return;

        // Limpiar siempre al entrar a un piso si hay algo activo
        if (this.mapLoader.animationFrameId) {
            cancelAnimationFrame(this.mapLoader.animationFrameId);
        }
        this.mapLoader.ctx.clearRect(0, 0, this.mapLoader.canvas.width, this.mapLoader.canvas.height);

        if (!this.currentRouteState || !this.floorManager) return;

        const { detail } = e;
        const currentFloorName = detail.floorName;
        const currentKey = this.normKey(currentFloorName);

        if (this.currentRouteState.type === 'multifloor') {
            const { pisoOrigin, pisoDest, pOrigin, pDest, stairName } = this.currentRouteState;
            const keyO = this.normKey(pisoOrigin);
            const keyD = this.normKey(pisoDest);
            const floorOrder = this.floorManager.floorOrder;
            const idxO = floorOrder.indexOf(keyO);
            const idxD = floorOrder.indexOf(keyD);
            const idxC = floorOrder.indexOf(currentKey);

            if (currentKey === keyO) {
                // Estamos en el ORIGEN: Dibujar hacia la escalera
                const stair = this.findStairGeneric(pisoOrigin, stairName === "Escalera Izquierda" ? "escalera_izquierda" : "escalera_derecha", floorOrder[idxO < idxD ? idxO + 1 : idxO - 1]);
                if (this.statusBar) this.statusBar.innerText = `➡️ Diríjase a la ${stairName} para ir al ${pisoDest}`;
                this.drawRoute(pOrigin, stair);
            }
            else if (currentKey === keyD) {
                // Estamos en el DESTINO: Dibujar desde la escalera
                const stair = this.findStairGeneric(pisoDest, stairName === "Escalera Izquierda" ? "escalera_izquierda" : "escalera_derecha", floorOrder[idxD < idxO ? idxD + 1 : idxD - 1]);
                if (this.statusBar) this.statusBar.innerText = `🏁 Llegada: Diríjase a ${this.destInput.value}`;
                this.drawRoute(stair, pDest);
            }
            else if ((idxC > idxO && idxC < idxD) || (idxC < idxO && idxC > idxD)) {
                // PISO INTERMEDIO: Dibujar entre escaleras
                const stairFrom = this.findStairGeneric(currentFloorName, stairName === "Escalera Izquierda" ? "escalera_izquierda" : "escalera_derecha", floorOrder[idxC < idxO ? idxC + 1 : idxC - 1]);
                const stairTo = this.findStairGeneric(currentFloorName, stairName === "Escalera Izquierda" ? "escalera_izquierda" : "escalera_derecha", floorOrder[idxC < idxD ? idxC + 1 : idxC - 1]);

                if (this.statusBar) this.statusBar.innerText = `⬇️ Siga por ${stairName} hacia el ${pisoDest}`;
                this.drawRoute(stairFrom, stairTo);
            }
            else {
                // Piso ajeno a la ruta
                if (this.mapLoader.ctx) {
                    this.mapLoader.ctx.clearRect(0, 0, this.mapLoader.canvas.width, this.mapLoader.canvas.height);
                    if (this.mapLoader.animationFrameId) cancelAnimationFrame(this.mapLoader.animationFrameId);
                }
                if (this.statusBar) this.statusBar.innerText = `Navegación activa. Suba/Baje para ir al ${pisoDest}.`;
            }
        }
        else {
            // Ruta simple (mismo piso)
            const { pisoOrigin, pOrigin, pDest } = this.currentRouteState;
            if (currentKey === this.normKey(pisoOrigin)) {
                this.drawRoute(pOrigin, pDest);
            } else {
                if (this.mapLoader.ctx) {
                    this.mapLoader.ctx.clearRect(0, 0, this.mapLoader.canvas.width, this.mapLoader.canvas.height);
                    if (this.mapLoader.animationFrameId) cancelAnimationFrame(this.mapLoader.animationFrameId);
                }
            }
        }
    }

    findStairGeneric(pisoName, baseName, targetKey) {
        const specificName = `${baseName}_${targetKey}`;
        // Buscar en todas las zonas posibles
        let res = this.getLocationCoords(pisoName, 'Ala_Este', specificName);
        if (!res) res = this.getLocationCoords(pisoName, 'Ala_Oeste', specificName);
        if (!res) res = this.getLocationCoords(pisoName, 'Centro', specificName);
        if (!res) res = this.getLocationCoords(pisoName, 'Ala_Este', baseName);
        if (!res) res = this.getLocationCoords(pisoName, 'Ala_Oeste', baseName);
        if (!res) res = this.getLocationCoords(pisoName, 'Centro', baseName);
        return res;
    }

    showSuggestions(query, type) {
        const container = type === 'origin' ? this.originSuggestions : this.destSuggestions;
        if (!container) return;

        container.innerHTML = '';

        let filtered = [];
        if (!query) {
            // Mostrar sugerencias de todos los pisos, ordenadas por el actual
            const currentFloorName = this.floorManager ? this.floorManager.getCurrentFloor().name : null;
            filtered = [...this.locations].sort((a, b) => {
                if (a.floor === currentFloorName && b.floor !== currentFloorName) return -1;
                if (a.floor !== currentFloorName && b.floor === currentFloorName) return 1;
                return 0;
            }).slice(0, 30);
        } else {
            const q = query.toLowerCase().trim();
            filtered = this.locations.filter(loc =>
                loc.name.toLowerCase().includes(q) || loc.floor.toLowerCase().includes(q)
            ).slice(0, 20);
        }

        if (filtered.length === 0) {
            container.style.display = 'none';
            return;
        }

        filtered.forEach(loc => {
            const div = document.createElement('div');
            div.className = 'route-suggestion-item';
            div.innerHTML = `<strong>${loc.name}</strong> <small style="color:#666; float:right; background:#f0f0f0; padding:2px 6px; border-radius:10px; font-size:10px;">${loc.floor}</small>`;
            div.dataset.id = loc.id;
            div.style.padding = '12px 15px';
            div.style.cursor = 'pointer';
            div.style.borderBottom = '1px solid #eee';
            div.style.backgroundColor = 'white';

            div.addEventListener('click', () => {
                const input = type === 'origin' ? this.originInput : this.destInput;
                input.value = loc.name;
                input.dataset.selectedId = loc.id;
                container.innerHTML = '';
                container.style.display = 'none';
            });

            div.addEventListener('mouseover', () => div.style.background = '#f9f9f9');
            div.addEventListener('mouseout', () => div.style.background = 'white');

            container.appendChild(div);
        });

        container.style.display = 'block';
        container.style.background = 'white';
        container.style.border = '1px solid #ddd';
        container.style.boxShadow = '0 6px 16px rgba(0,0,0,0.12)';
        container.style.position = 'absolute';
        container.style.left = '0';
        container.style.right = '0';
        container.style.zIndex = '2000';
        container.style.borderRadius = '0 0 12px 12px';
        container.style.maxHeight = '350px';
        container.style.overflowY = 'auto';
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

                    // Filtro universal: no mostrar escaleras en el buscador (son solo para conexión)
                    if (lowerLugar.startsWith('escalera')) return;
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
        // Limpiar mapa inmediatamente para evitar confusión
        if (this.mapLoader && this.mapLoader.ctx) {
            if (this.mapLoader.animationFrameId) cancelAnimationFrame(this.mapLoader.animationFrameId);
            this.mapLoader.ctx.clearRect(0, 0, this.mapLoader.canvas.width, this.mapLoader.canvas.height);
        }

        const [pisoO, zonaO, lugarO] = originId.split('|');
        const [pisoD, zonaD, lugarD] = destId.split('|');

        const pA = this.getLocationCoords(pisoO, zonaO, lugarO);
        const pB = this.getLocationCoords(pisoD, zonaD, lugarD);

        if (!pA || !pB) {
            alert("Error obteniendo coordenadas.");
            return;
        }

        const targetFloorKey = this.normKey(pisoO);

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
            // 1. Obtener claves normalizadas
            const floorOrder = this.floorManager.floorOrder;
            const keyO = this.normKey(pisoO);
            const keyD = this.normKey(pisoD);
            const idxO = floorOrder.indexOf(keyO);
            const idxD = floorOrder.indexOf(keyD);

            // 2. Determinar el SIGUIENTE piso en la secuencia lógica
            let nextStepIdx = idxO < idxD ? idxO + 1 : idxO - 1;
            const nextFloorKey = floorOrder[nextStepIdx];

            // La "meta intermedia" es el siguiente piso en el orden
            const targetFloorKey = nextFloorKey;

            // Helper para buscar coordenadas de escalera de forma robusta
            const findStairCoords = (piso, zona, baseName, targetKey) => {
                // 1. Intentar nombre específico: "escalera_derecha_sotano"
                const specificName = `${baseName}_${targetKey}`;
                let res = this.getLocationCoords(piso, zona, specificName);

                // 2. Intentar nombre genérico: "escalera_derecha"
                if (!res) res = this.getLocationCoords(piso, zona, baseName);

                // 3. Fallbacks de zona/case (compatibilidad)
                if (!res) res = this.getLocationCoords(piso, zona.toLowerCase(), baseName);
                if (!res) res = this.getLocationCoords(piso, zona.replace('_', '-'), baseName);
                if (!res) res = this.getLocationCoords(piso, 'Ala_Este', baseName);
                if (!res) res = this.getLocationCoords(piso, 'Ala_Oeste', baseName);

                return res;
            };

            // Buscar escaleras en origen que conecten con el SIGUIENTE paso
            let escIzq = findStairCoords(pisoO, 'Ala_Oeste', 'escalera_izquierda', targetFloorKey);
            let escDer = findStairCoords(pisoO, 'Ala_Este', 'escalera_derecha', targetFloorKey);

            if (!escIzq && !escDer) {
                this.statusBar.innerText = `⚠️ Falta escalera en ${pisoO} para ir al ${pisoD}.`;
                this.drawRoute(pA, pB);
                return;
            }

            // Buscar escaleras en el SIGUIENTE piso que conecten con el origen
            let escIzqD = findStairCoords(this.floorManager.floors[nextFloorKey].name, 'Ala_Oeste', 'escalera_izquierda', keyO);
            let escDerD = findStairCoords(this.floorManager.floors[nextFloorKey].name, 'Ala_Este', 'escalera_derecha', keyO);

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

            if (this.statusBar) this.statusBar.innerText = `➡️ Diríjase a ${nombreEscalera} para ir al ${pisoD}`;
        } else {
            // Mismo piso
            this.currentRouteState = {
                type: 'simple',
                pisoOrigin: pisoO,
                pOrigin: pA,
                pDest: pB
            };

            if (this.statusBar) {
                this.statusBar.innerText = `🏁 Destino en este piso: ${lugarD}`;
                this.statusBar.style.backgroundColor = '#e8f5e9'; // Verde éxito
            }
        }

        // Final Común: Asegurar que estamos en el piso de origen y dibujar
        const originFloorKey = this.normKey(pisoO);
        const currentFloor = this.floorManager ? this.floorManager.getCurrentFloor() : null;
        const currentFloorKey = currentFloor ? this.normKey(currentFloor.name) : '';

        if (this.floorManager && currentFloorKey !== originFloorKey) {
            await this.floorManager.loadFloor(originFloorKey);
            // El evento 'floorChanged' disparará handleFloorChanged automáticamente
        } else {
            // Ya estamos en el piso o no hay floorManager, forzar redibujado manual
            this.handleFloorChanged({ detail: { floorName: pisoO } });
        }
    }

    getLocationCoords(piso, zona, lugar) {
        try {
            // Normalizar el nombre del piso para la búsqueda
            const targetPisoKey = this.normKey(piso);
            const actualPisoKey = Object.keys(this.data).find(k => this.normKey(k) === targetPisoKey);

            if (!actualPisoKey) return null;

            let floorData = this.data[actualPisoKey];
            let data = floorData[zona]?.[lugar];

            // Si falló por zona, buscar de forma flexible
            if (!data) {
                const zKey = Object.keys(floorData).find(k => k.toLowerCase() === zona.toLowerCase());
                if (zKey) data = floorData[zKey][lugar];
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
