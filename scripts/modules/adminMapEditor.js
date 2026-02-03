/**
 * Módulo para editar el mapa (Agregar ubicaciones)
 * Migrado del proyecto anterior.
 */

class AdminMapEditor {
    constructor() {
        this.ctx = null; // Canvas context (si necesitamos dibujar)
        this.svg = document.getElementById('map-svg'); // O la imagen
        this.mapContainer = document.getElementById('map-wrapper'); // Corregido: ID real en map.html
        this.imgWrapper = document.getElementById('map-image-wrapper');
        this.imgMapa = document.getElementById('map-image'); // La imagen del mapa

        // Modal elements
        this.modal = document.getElementById('modal-agregar');
        this.btnClose = document.getElementById('modal-agregar-close');
        this.btnCancel = document.getElementById('btn-cancelar-agregar');
        this.btnConfirm = document.getElementById('btn-confirmar-agregar');
        this.inputNombre = document.getElementById('modal-agregar-nombre');
        this.inputSector = document.getElementById('modal-agregar-sector');

        // State
        this.pendingPiso = null;
        this.pendingCoords = null;
        this.isAdmin = false;

        this.init();
    }

    init() {
        // Escuchar clics en el wrapper para asegurar captura
        if (this.imgWrapper) {
            this.imgWrapper.addEventListener('click', (e) => this.handleMapClick(e));
        } else if (this.imgMapa) {
            this.imgMapa.addEventListener('click', (e) => this.handleMapClick(e));
        }

        // Eventos del modal
        if (this.btnClose) this.btnClose.addEventListener('click', () => this.cerrarModal());
        if (this.btnCancel) this.btnCancel.addEventListener('click', () => this.cerrarModal());
        if (this.btnConfirm) this.btnConfirm.addEventListener('click', () => this.confirmarAgregar());
    }

    setAdminState(isAdmin) {
        this.isAdmin = isAdmin;
        if (this.mapContainer) {
            if (isAdmin) {
                this.mapContainer.style.cursor = 'crosshair'; // Indicador visual
            } else {
                this.mapContainer.style.cursor = 'default';
            }
        }
    }
    handleMapClick(event) {
        if (!this.isAdmin) return;
        const floorDisplay = document.getElementById('floor-display');
        let piso = null;

        if (floorDisplay) {
            const text = floorDisplay.textContent.trim();
            if (text === 'S' || text.toLowerCase() === 'sótano') {
                piso = 'Sótano';
            } else if (!isNaN(parseInt(text))) {
                piso = `Piso ${text}`;
            } else {
                piso = text; // Fallback
            }
        }

        if (!piso) {
            alert("No se pudo detectar el piso actual.");
            return;
        }

        // Usar la imagen como referencia para las coordenadas
        const img = document.getElementById('map-image');
        if (!img) return;

        const rect = img.getBoundingClientRect();

        // Calcular coordenadas relativas (0.0 a 1.0)
        // Clamp values 0-1
        let x = (event.clientX - rect.left) / rect.width;
        let y = (event.clientY - rect.top) / rect.height;

        x = Math.max(0, Math.min(1, parseFloat(x.toFixed(3))));
        y = Math.max(0, Math.min(1, parseFloat(y.toFixed(3))));

        this.pendingPiso = piso;
        this.pendingCoords = { x, y };

        // Abrir modal
        this.inputNombre.value = '';
        this.inputSector.value = 'Ala_Oeste'; // Default
        this.modal.classList.add('active');
        this.inputNombre.focus();
    }

    async confirmarAgregar() {
        const nombre = this.inputNombre.value.trim();
        const sector = this.inputSector.value;

        if (!nombre) {
            alert("Escribe el nombre de la ubicación.");
            return;
        }
        if (!this.pendingPiso || !this.pendingCoords) return;

        // Cargar datos actuales (Local o JSON estático si es la primera vez)
        let datosMapa = JSON.parse(localStorage.getItem('mapaDataUBV') || 'null');

        if (!datosMapa) {
            // Si no hay datos locales, cargar los del JSON para no perder las ubicaciones originales
            try {
                // Intentar cargar la base de datos original
                let response = await fetch('./data/dataUBV.json');
                if (!response.ok) response = await fetch('./Nueva carpeta/dataUBV.json');

                if (response.ok) {
                    datosMapa = await response.json();
                } else {
                    datosMapa = {}; // Empezar de cero si falla todo
                }
            } catch (e) {
                console.error("Error importando datos base:", e);
                datosMapa = {};
            }
        }

        const piso = this.pendingPiso;
        const targetSector = sector; // Usar directamente "Ala_Este", "Ala_Oeste", "Centro"

        if (!datosMapa[piso]) datosMapa[piso] = {};

        // Asegurar que el sector existe (y no es un array)
        if (!datosMapa[piso][targetSector]) {
            datosMapa[piso][targetSector] = {};
        } else if (Array.isArray(datosMapa[piso][targetSector])) {
            // Convertir Array -> Objeto si es necesario
            const obj = {};
            datosMapa[piso][targetSector].forEach(item => {
                const key = Object.keys(item)[0];
                obj[key] = item[key];
            });
            datosMapa[piso][targetSector] = obj;
        }

        // Normalización EXTRA: Limpiar posibles restos de claves en minúscula en todo el objeto
        Object.keys(datosMapa).forEach(p => {
            if (datosMapa[p]['ala-este']) {
                if (!datosMapa[p]['Ala_Este']) datosMapa[p]['Ala_Este'] = {};
                Object.assign(datosMapa[p]['Ala_Este'], datosMapa[p]['ala-este']);
                delete datosMapa[p]['ala-este'];
            }
            if (datosMapa[p]['ala-oeste']) {
                if (!datosMapa[p]['Ala_Oeste']) datosMapa[p]['Ala_Oeste'] = {};
                Object.assign(datosMapa[p]['Ala_Oeste'], datosMapa[p]['ala-oeste']);
                delete datosMapa[p]['ala-oeste'];
            }
            if (datosMapa[p]['centro']) {
                if (!datosMapa[p]['Centro']) datosMapa[p]['Centro'] = {};
                Object.assign(datosMapa[p]['Centro'], datosMapa[p]['centro']);
                delete datosMapa[p]['centro'];
            }
        });

        // Guardar nuevo punto
        datosMapa[piso][targetSector][nombre] = { ...this.pendingCoords };

        // Guardar en localStorage
        localStorage.setItem('mapaDataUBV', JSON.stringify(datosMapa));

        // NOTIFICAR CAMBIO (Para que otros módulos se actualicen sin recargar)
        document.dispatchEvent(new CustomEvent('mapDataUpdated', { detail: { data: datosMapa } }));

        this.cerrarModal();
        alert(`Punto "${nombre}" guardado localmente en ${piso} - ${targetSector}.`);

    }

    cerrarModal() {
        this.modal.classList.remove('active');
        this.pendingPiso = null;
        this.pendingCoords = null;
    }
}

export default AdminMapEditor;
