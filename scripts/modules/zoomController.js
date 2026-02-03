/**
 * ZoomController.js
 * Sistema de zoom y paneo rediseñado para centrado perfecto y geometría sagrada.
 * Coordenadas basadas en el centro (0,0 = centro de la pantalla).
 */

class ZoomController {
    constructor(mapContainer) {
        this.mapContainer = mapContainer;
        this.mapSvg = document.getElementById('map-svg');
        this.mapImg = document.getElementById('map-image');
        this.mapWrapper = document.getElementById('map-image-wrapper');
        // Preferimos transformar el wrapper si existe (contiene img + canvas) para mantener overlay sincronizado
        this.mapElement = this.mapSvg || this.mapWrapper || this.mapImg; // elemento a transformar (SVG / wrapper / IMG)

        // Estado (Coordenadas relativas al centro)
        this.transform = {
            x: 0, // Desplazamiento desde el centro
            y: 0,
            scale: 1,
            rotation: 0
        };

        this.target = { ...this.transform };

        // Configuración
        this.minZoom = 0.1;
        this.maxZoom = 8;
        this.zoomStep = 0.4;
        this.friction = 0.96; // Más ligero, desliza más tiempo

        // Estado interno
        this.isDragging = false;
        this.velocity = { x: 0, y: 0 };
        this.lastMouse = { x: 0, y: 0 }; // Relativo al centro
        this.rafId = null;

        // Touch tracking
        this.touches = [];
        this.lastTouchDist = 0;
        this.lastTouchCenter = { x: 0, y: 0 };

        this.init();
    }

    init() {
        if (!this.mapContainer || !this.mapElement) return;

        // 1. Aplicar estilos base para CENTRADO ABSOLUTO
        Object.assign(this.mapElement.style, {
            position: 'absolute',
            left: '50%',
            top: '50%',
            transformOrigin: 'center center',
            transition: 'none' // Asegurar que CSS no interfiera
        });

        // Estilos del contenedor
        Object.assign(this.mapContainer.style, {
            overflow: 'hidden',
            position: 'relative',
            touchAction: 'none',
            cursor: 'grab',
            backgroundColor: '#f8fafc' // Fondo ligero
        });

        // 2. Event Listeners
        this.setupMouseEvents();
        this.setupTouchEvents();
        this.setupControls();

        // 3. Observer para cambios en el SVG o load para imagen
        if (this.mapSvg) {
            try {
                const observer = new MutationObserver(() => setTimeout(() => this.fitToScreen(), 50));
                observer.observe(this.mapSvg, { childList: true, attributes: true, attributeFilter: ['viewBox'] });
            } catch (e) { console.warn('ZoomController: Error attaching observer to SVG', e); }
        }

        if (this.mapImg) {
            this.mapImg.addEventListener('load', () => setTimeout(() => this.fitToScreen(), 50));
            // Si existe un wrapper, también esperamos su layout
            if (this.mapWrapper) {
                setTimeout(() => this.fitToScreen(), 60);
            }
        }

        // 4. Loop y Fit inicial
        this.startLoop();

        // Fit inicial robusto
        setTimeout(() => this.fitToScreen(), 100);
        window.addEventListener('resize', () => this.fitToScreen());
    }

    fitToScreen() {
        if (!this.mapContainer || !this.mapElement) return;

        // Obtener dimensiones
        const rect = this.mapContainer.getBoundingClientRect();
        const svgSize = this.getMapSize(); // { w, h }

        // IMPORTANTE: Para que nuestras matematicas de escala (Screen/SVG) funcionen,
        // el elemento SVG debe tener un tamaño base conocido (su viewBox W/H).
        // Si dejamos que sea 100% (responsive), la escala se multiplica doblemente.
        this.mapElement.style.width = `${svgSize.w}px`;
        this.mapElement.style.height = `${svgSize.h}px`;

        // Dimensiones visuales dependiendo de la rotación
        const rot = (this.target.rotation % 360 + 360) % 360;
        const isRotated = Math.abs(rot % 180) === 90;

        const visualW = isRotated ? svgSize.h : svgSize.w;
        const visualH = isRotated ? svgSize.w : svgSize.h;

        // Calcular escala
        // 'CONTAIN': Que quepa todo
        const scaleX = rect.width / visualW;
        const scaleY = rect.height / visualH;
        let fitScale = Math.min(scaleX, scaleY) * 0.85;

        // Aplicar estado perfecto: Centro (0,0) y Escala calculada
        this.target.x = 0;
        this.target.y = 0;
        this.target.scale = fitScale;

        // Reset velocity
        this.velocity = { x: 0, y: 0 };

        this.minZoom = fitScale * 0.5; // Ajustar límite inferior

        // Sincronizar instantáneamente
        this.transform = { ...this.target };
        this.updateTransform();
    }

    getMapSize() {
        // Intenta obtener tamaño real, fallback a 1000x1000
        let w = 0, h = 0;

        // Prioridad visual: Wrapper (contenedor definitivo en la nueva lógica)
        if (this.mapWrapper) {
            // Si usamos wrapper, a veces es mejor usar el tamaño de la imagen interna
            // pero si el wrapper tiene dimensiones explicitas, usarlas.
        }

        if (this.mapSvg) {
            const vb = this.mapSvg.getAttribute('viewBox');
            if (vb) {
                const parts = vb.split(/[\s,]+/);
                if (parts.length === 4) {
                    w = parseFloat(parts[2]);
                    h = parseFloat(parts[3]);
                }
            }

            if (!w || !h) {
                try {
                    const bbox = this.mapSvg.getBBox();
                    w = bbox.width; h = bbox.height;
                } catch (e) { }
            }

            if (!w || !h) {
                w = parseFloat(this.mapSvg.getAttribute('width'));
                h = parseFloat(this.mapSvg.getAttribute('height'));
            }
        }

        // Fallback a imagen si SVG no dio dimensiones o no existe
        if ((!w || !h) && this.mapImg) {
            w = this.mapImg.naturalWidth || this.mapImg.width;
            h = this.mapImg.naturalHeight || this.mapImg.height;
        }

        return { w: w || 1000, h: h || 1000 };
    }
    // --- Core Logic ---

    // Convierte evento de mouse a coordenadas relativas al CENTRO del contenedor
    getMouseFromCenter(e) {
        const rect = this.mapContainer.getBoundingClientRect();
        // clientX - (Left + Width/2)
        return {
            x: e.clientX - (rect.left + rect.width / 2),
            y: e.clientY - (rect.top + rect.height / 2)
        };
    }

    zoomToPoint(factor, centerX, centerY) {
        // centerX, centerY son relativos al centro del contenedor
        const oldScale = this.target.scale;
        const newScale = Math.min(Math.max(oldScale * factor, this.minZoom), this.maxZoom);

        // Math: x' = mx - (mx - x) * (s'/s)
        // Simplificado: x' = x + (mx - x) * (1 - s'/s) -> No, la formula de pan es:
        // offsetNew = center - (center - offsetOld) * (new/old)
        // donde 'center' es el punto del mouse.

        const sRatio = newScale / oldScale;

        this.target.scale = newScale;
        this.target.x = centerX - (centerX - this.target.x) * sRatio;
        this.target.y = centerY - (centerY - this.target.y) * sRatio;

        this.constrain();
    }

    rotate(angle) {
        // Rotación simple. Al estar centrados por CSS y transform-origin, 
        // solo cambiamos el ángulo y gira sobre el centro visual.
        this.target.rotation = Math.round(this.target.rotation + angle);

        // Opcional: Re-fit si se quiere que siempre quepa entero al rotar
        // this.fitToScreen(); 
        // Pero el usuario pidió "girar la mesa", lo cual implica mantener posición y zoom si es posible.
        // Haremos un clamp por si acaso las nuevas dimensiones hacen que se salga.
        this.constrain();
    }

    constrain() {
        // Evita que el mapa se salga de la vista ("huecos grises")
        // PERO siempre permite que se centre si es más pequeño que la vista.

        const rect = this.mapContainer.getBoundingClientRect();
        const svgSize = this.getMapSize();

        // Tamaño visual actual
        const rot = (this.target.rotation % 360 + 360) % 360;
        const isRotated = Math.abs(rot % 180) === 90;
        const visualW = (isRotated ? svgSize.h : svgSize.w) * this.target.scale;
        const visualH = (isRotated ? svgSize.w : svgSize.h) * this.target.scale;

        const limX = Math.max(0, (visualW - rect.width) / 2);
        const limY = Math.max(0, (visualH - rect.height) / 2);

        this.target.x = Math.max(-limX, Math.min(limX, this.target.x));
        this.target.y = Math.max(-limY, Math.min(limY, this.target.y));
    }

    // --- Loop ---

    startLoop() {
        const loop = () => {
            if (!this.mapElement) return;

            if (!this.isDragging) {
                // Inercia suave
                this.target.x += this.velocity.x;
                this.target.y += this.velocity.y;
                this.velocity.x *= this.friction;
                this.velocity.y *= this.friction;

                if (Math.abs(this.velocity.x) < 0.05) this.velocity.x = 0;
                if (Math.abs(this.velocity.y) < 0.05) this.velocity.y = 0;

                this.constrain();
            }

            // Interpolación para efectos de zoom y pequeños ajustes
            const kPos = 0.25;
            const kScale = 0.2;
            const kRot = 0.15;

            this.transform.x += (this.target.x - this.transform.x) * kPos;
            this.transform.y += (this.target.y - this.transform.y) * kPos;
            this.transform.scale += (this.target.scale - this.transform.scale) * kScale;
            this.transform.rotation += (this.target.rotation - this.transform.rotation) * kRot;

            this.updateTransform();
            this.rafId = requestAnimationFrame(loop);
        };
        this.rafId = requestAnimationFrame(loop);
    }

    updateTransform() {
        const { x, y, scale, rotation } = this.transform;
        // IMPORTANTE: El orden de CSS transform se lee de izq a derecha en composición visual,
        // pero matemáticamente es Matrix multiplication.
        // translate(-50%, -50%) centra el elemento (propio).
        // translate(x, y) mueve ese centro.
        // rotate(r) gira sobre ese centro (por transform-origin center).
        // scale(s) escala desde ese centro.
        this.mapElement.style.transform =
            `translate(-50%, -50%) translate3d(${x}px, ${y}px, 0) rotate(${rotation}deg) scale(${scale})`;
    }

    // --- Inputs ---

    setupMouseEvents() {
        const c = this.mapContainer;

        c.addEventListener('wheel', (e) => {
            e.preventDefault();
            const { x, y } = this.getMouseFromCenter(e);
            // Signo: deltaY positivo es scroll down -> zoom out normalmente.
            // Pero queremos "Google Maps style": Scroll Up -> Zoom In.
            const direction = -Math.sign(e.deltaY);
            const factor = direction > 0 ? (1 + this.zoomStep) : (1 / (1 + this.zoomStep));

            this.zoomToPoint(factor, x, y);
        }, { passive: false });

        c.addEventListener('mousedown', (e) => {
            if (e.button !== 0) return;
            this.isDragging = true;
            this.velocity = { x: 0, y: 0 };
            const m = this.getMouseFromCenter(e);
            this.lastMouse = m;
            c.style.cursor = 'grabbing';
            // Snap animation
            this.target = { ...this.transform };
        });

        window.addEventListener('mousemove', (e) => {
            if (!this.isDragging) return;
            e.preventDefault();
            const m = this.getMouseFromCenter(e);
            const dx = m.x - this.lastMouse.x;
            const dy = m.y - this.lastMouse.y;

            this.target.x += dx;
            this.target.y += dy;
            this.velocity = { x: dx, y: dy };

            this.lastMouse = m;
            this.constrain();

            // Direct update for responsiveness
            this.transform.x = this.target.x;
            this.transform.y = this.target.y;
        });

        window.addEventListener('mouseup', () => {
            this.isDragging = false;
            c.style.cursor = 'grab';
        });
    }

    setupTouchEvents() {
        const c = this.mapContainer;

        // Helper
        const getTouchCenter = (touches) => {
            if (touches.length === 1) {
                return this.getMouseFromCenter(touches[0]);
            }
            const t1 = this.getMouseFromCenter(touches[0]);
            const t2 = this.getMouseFromCenter(touches[1]);
            return { x: (t1.x + t2.x) / 2, y: (t1.y + t2.y) / 2 };
        };
        const getDist = (touches) => {
            const t1 = touches[0], t2 = touches[1];
            return Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
        };

        c.addEventListener('touchstart', (e) => {
            if (e.target.closest('button')) return;
            // e.preventDefault(); // Eliminado para permitir eventos de clic en móviles
            this.isDragging = true;
            this.velocity = { x: 0, y: 0 };
            this.touches = Array.from(e.touches);

            if (this.touches.length > 0) {
                this.lastTouchCenter = getTouchCenter(this.touches);
                if (this.touches.length === 2) {
                    this.lastTouchDist = getDist(this.touches);
                }
            }
            // Snap
            this.target = { ...this.transform };
        }, { passive: false });

        c.addEventListener('touchmove', (e) => {
            if (!this.isDragging) return;
            e.preventDefault();
            const touches = Array.from(e.touches);
            const center = getTouchCenter(touches);

            // Pan
            const dx = center.x - this.lastTouchCenter.x;
            const dy = center.y - this.lastTouchCenter.y;

            this.target.x += dx;
            this.target.y += dy;
            this.velocity = { x: dx, y: dy };

            // Zoom (Pinch)
            if (touches.length === 2) {
                const dist = getDist(touches);
                const scaleFactor = dist / (this.lastTouchDist || 1);

                // Aplicar zoom sobre el centro del pinch
                // Nota: ya hemos aplicado Pan, asi que el "center" actual corresponde al nuevo punto bajo los dedos
                this.zoomToPoint(scaleFactor, center.x, center.y);

                this.lastTouchDist = dist;
            }

            this.lastTouchCenter = center;
            this.constrain();

            // Direct update
            this.transform.x = this.target.x;
            this.transform.y = this.target.y;
            this.transform.scale = this.target.scale;

        }, { passive: false });

        c.addEventListener('touchend', (e) => {
            this.touches = Array.from(e.touches);
            if (this.touches.length === 0) {
                this.isDragging = false;
            } else {
                // Reset center to avoid jumps
                this.lastTouchCenter = getTouchCenter(this.touches);
            }
        });
    }

    setupControls() {
        const bind = (id, fn) => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('click', fn);
                console.log('ZoomController: attached control', id);
            } else {
                console.warn('ZoomController: missing control', id);
            }
        };

        bind('zoom-in', () => this.zoomToPoint(1 + this.zoomStep, 0, 0));
        bind('zoom-out', () => this.zoomToPoint(1 / (1 + this.zoomStep), 0, 0));
        bind('zoom-reset', () => this.fitToScreen());
        bind('rotate-left', () => this.rotate(-90));
        bind('rotate-right', () => this.rotate(90));
    }

    // API pública para otros módulos si necesitan
    getCurrentZoom() { return this.transform.scale; }
    resetZoom() { this.fitToScreen(); }
}

export default ZoomController;
