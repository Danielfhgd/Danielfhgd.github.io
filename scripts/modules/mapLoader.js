// Módulo para cargar mapas como IMAGEN + canvas y proporcionar navegación raster

class MapLoader {
    constructor() {
        this.currentMap = null;
        this.img = document.getElementById('map-image');
        this.canvas = document.getElementById('map-canvas');
        this.ctx = this.canvas ? this.canvas.getContext('2d') : null;

        this.grid = [];
        this.TILE = 4; // tamaño de celda

        if (!this.img || !this.canvas) {
            console.error('No se encontraron los elementos de imagen/canvas del mapa (#map-image, #map-canvas)');
        }
    }

    /**
     * Carga una imagen de mapa (PNG/SVG) y escanea píxeles para navegación
     * @param {string} mapPath
     * @returns {Promise<boolean>}
     */
    async loadMap(mapPath) {
        return new Promise((resolve) => {
            if (!this.img || !this.canvas) {
                resolve(false);
                return;
            }

            this.img.onload = () => {
                // Ajustar canvas al tamaño natural de la imagen
                this.canvas.width = this.img.naturalWidth || this.img.width || 800;
                this.canvas.height = this.img.naturalHeight || this.img.height || 600;

                // Escanear para generar la grid de navegación
                this.scanMap();

                this.currentMap = mapPath;
                resolve(true);
            };

            this.img.onerror = (e) => {
                console.error('Error cargando imagen de mapa:', e);
                resolve(false);
            };

            // Iniciar carga
            this.img.src = mapPath;
        });
    }

    /**
     * Escanea la imagen y construye la malla (grid) para navegación
     */
    scanMap() {
        if (!this.img || !this.canvas) return;

        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');
        tempCanvas.width = this.canvas.width;
        tempCanvas.height = this.canvas.height;
        tempCtx.drawImage(this.img, 0, 0, tempCanvas.width, tempCanvas.height);

        const imgData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height).data;
        const cols = Math.floor(tempCanvas.width / this.TILE);
        const rows = Math.floor(tempCanvas.height / this.TILE);

        this.grid = Array(cols).fill().map(() => Array(rows).fill(0));

        // PASO 1: Detección estricta de paredes finas
        for (let x = 0; x < cols; x++) {
            for (let y = 0; y < rows; y++) {
                let esPared = false;
                const puntos = [{ ox: .2, oy: .2 }, { ox: .8, oy: .2 }, { ox: .2, oy: .8 }, { ox: .8, oy: .8 }, { ox: .5, oy: .5 }];

                for (let p of puntos) {
                    const pxX = Math.floor(x * this.TILE + this.TILE * p.ox);
                    const pxY = Math.floor(y * this.TILE + this.TILE * p.oy);
                    const i = (pxY * tempCanvas.width + pxX) * 4;
                    if (imgData[i + 3] > 50 && (imgData[i] + imgData[i + 1] + imgData[i + 2]) / 3 < 160) {
                        esPared = true; break;
                    }
                }
                if (esPared) this.grid[x][y] = 999;
            }
        }

        // PASO 2: Campo de fuerza
        const RADIO = 4;
        for (let x = 0; x < cols; x++) {
            for (let y = 0; y < rows; y++) {
                if (this.grid[x][y] === 999) continue;
                let costoExtra = 0;
                for (let dx = -RADIO; dx <= RADIO; dx++) {
                    for (let dy = -RADIO; dy <= RADIO; dy++) {
                        const nx = x + dx, ny = y + dy;
                        if (nx >= 0 && nx < cols && ny >= 0 && ny < rows && this.grid[nx][ny] === 999) {
                            const dist = Math.sqrt(dx * dx + dy * dy);
                            if (dist <= RADIO) {
                                costoExtra = Math.max(costoExtra, (RADIO + 1 - dist) * 20);
                            }
                        }
                    }
                }
                this.grid[x][y] = costoExtra;
            }
        }
    }

    /**
     * Calcula ruta entre dos puntos en coordenadas del mapa.
     * coords pueden ser [x,y] en pixeles o [xNorm,yNorm] (0..1)
     */
    drawRouteFromCoords(coordsA, coordsB) {
        if (!coordsA || !coordsB || !this.grid || !this.ctx || !this.canvas) return false;

        const toPixel = (c) => {
            let x = c[0]; let y = c[1];
            if (x <= 1 && y <= 1) {
                // Normalizado
                x = Math.round(x * this.canvas.width);
                y = Math.round(y * this.canvas.height);
            }
            return { x: Math.round(x), y: Math.round(y) };
        };

        const aPix = toPixel(coordsA);
        const bPix = toPixel(coordsB);

        const start = { x: Math.floor(aPix.x / this.TILE), y: Math.floor(aPix.y / this.TILE) };
        const end = { x: Math.floor(bPix.x / this.TILE), y: Math.floor(bPix.y / this.TILE) };

        const path = this.aStar(start, end);
        if (path) {
            this.drawPath(path);
            return true;
        }

        console.warn('No se encontró camino entre puntos dados');
        return false;
    }

    /**
     * A* (copiado y adaptado desde la versión raster)
     */
    aStar(start, end) {
        let openSet = [start];
        let cameFrom = new Map();
        let gScore = new Map();
        let fScore = new Map();
        const key = (p) => `${p.x},${p.y}`;
        const h = (a, b) => Math.sqrt(Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2));

        gScore.set(key(start), 0);
        fScore.set(key(start), h(start, end));

        while (openSet.length > 0) {
            let index = 0;
            for (let i = 1; i < openSet.length; i++) {
                if (fScore.get(key(openSet[i])) < fScore.get(key(openSet[index]))) index = i;
            }

            let current = openSet.splice(index, 1)[0];

            if (current.x === end.x && current.y === end.y) {
                let path = [current];
                while (cameFrom.has(key(current))) {
                    current = cameFrom.get(key(current));
                    path.push(current);
                }
                return path;
            }

            const vecinos = [
                { x: current.x + 1, y: current.y }, { x: current.x - 1, y: current.y },
                { x: current.x, y: current.y + 1 }, { x: current.x, y: current.y - 1 },
                { x: current.x + 1, y: current.y + 1 }, { x: current.x - 1, y: current.y + 1 },
                { x: current.x + 1, y: current.y - 1 }, { x: current.x - 1, y: current.y - 1 }
            ];

            for (let v of vecinos) {
                if (v.x < 0 || v.x >= this.grid.length || v.y < 0 || v.y >= this.grid[0].length) continue;
                if (this.grid[v.x][v.y] === 999) continue;

                // Bloqueo estricto de esquinas
                if (v.x !== current.x && v.y !== current.y) {
                    if (this.grid[current.x][v.y] === 999 || this.grid[v.x][current.y] === 999) continue;
                }

                const pesoDist = (v.x !== current.x && v.y !== current.y) ? 1.41 : 1;
                let tentativeG = gScore.get(key(current)) + pesoDist + (this.grid[v.x][v.y] || 0);

                if (tentativeG < (gScore.get(key(v)) ?? Infinity)) {
                    cameFrom.set(key(v), current);
                    gScore.set(key(v), tentativeG);
                    fScore.set(key(v), tentativeG + h(v, end));

                    if (!openSet.some(p => p.x === v.x && p.y === v.y)) {
                        openSet.push(v);
                    }
                }
            }
        }
        return null;
    }

    /**
     * Dibuja la ruta (render) en el canvas de overlay
     */
    /**
     * Dibuja la ruta (render) en el canvas de overlay con ANIMACIÓN
     */
    drawPath(path) {
        if (!path || path.length < 2 || !this.ctx) return;

        // Limpiar animación previa si existe
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
        }

        const pDestino = path[0];
        const indexReferencia = Math.min(path.length - 1, 4);
        const pReferencia = path[indexReferencia];

        const xDestino = pDestino.x * this.TILE + this.TILE / 2;
        const yDestino = pDestino.y * this.TILE + this.TILE / 2;
        const xRef = pReferencia.x * this.TILE + this.TILE / 2;
        const yRef = pReferencia.y * this.TILE + this.TILE / 2;
        const angulo = Math.atan2(yDestino - yRef, xDestino - xRef);

        let offset = 0;

        const animate = () => {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

            // Dibujar Línea
            this.ctx.beginPath();
            this.ctx.strokeStyle = "#d32f2f";
            this.ctx.lineWidth = 5;
            this.ctx.lineCap = "round";
            this.ctx.setLineDash([10, 10]);
            this.ctx.lineDashOffset = -offset; // Movimiento

            this.ctx.moveTo(path[path.length - 1].x * this.TILE + this.TILE / 2, path[path.length - 1].y * this.TILE + this.TILE / 2);
            for (let i = path.length - 2; i >= indexReferencia; i--) {
                this.ctx.lineTo(path[i].x * this.TILE + this.TILE / 2, path[i].y * this.TILE + this.TILE / 2);
            }
            this.ctx.stroke();

            // Dibujar Flecha
            this.ctx.setLineDash([]);
            this.ctx.fillStyle = "#d32f2f";
            this.ctx.save();
            this.ctx.translate(xDestino, yDestino);
            this.ctx.rotate(angulo);
            this.ctx.beginPath();
            this.ctx.moveTo(0, 0);
            this.ctx.lineTo(-18, -10);
            this.ctx.lineTo(-18, 10);
            this.ctx.closePath();
            this.ctx.fill();
            this.ctx.restore();

            // Actualizar offset
            offset += 0.5;
            if (offset > 20) offset = 0;

            this.animationFrameId = requestAnimationFrame(animate);
        };

        animate();
    }

    getCurrentMap() {
        return this.img;
    }

    getCurrentMapPath() {
        return this.currentMap;
    }
}

export default MapLoader;
