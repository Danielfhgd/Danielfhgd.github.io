/**
 * UBV - SISTEMA DE NAVEGACIÓN (VERSIÓN TOTAL)
 * Incluye: Inteligencia de escaleras por proximidad global y Modo Admin.
 */

let datosMapa = {};
let grid = [];
const TILE = 4; 
let modoAdminActivo = false;
let escaleraSeleccionadaGlobal = null;
let offsetAnimacion = 0; // Para el movimiento de la ruta

let rutaGlobal = {
    origen: null, 
    destino: null 
};

const img = document.getElementById('img-mapa');
const canvas = document.getElementById('canvas-ruta');
const ctx = canvas.getContext('2d');
const statusBar = document.getElementById('status-bar');

// 1. CARGA INICIAL
async function cargarDatos() {
    try {
        const res = await fetch('ubicaciones.json');
        const datosArchivo = await res.json();
        
        const localData = localStorage.getItem('mapaDataUBV');
        datosMapa = localData ? JSON.parse(localData) : datosArchivo;
        
        llenarSelectorPisos();
        llenarSelectoresUbicaciones();
        llenarSelectorEliminar();
        actualizarInfoUsuario();
    } catch (e) {
        console.error("Error:", e);
        statusBar.innerText = "❌ Error al cargar datos";
    }
}

// ACTUALIZACIÓN DE INTERFAZ
function actualizarInfoUsuario() {
    const user = localStorage.getItem('usuarioUBV') || "Invitado";
    const btnPerfil = document.getElementById('btn-perfil');
    const btnLogout = document.getElementById('btn-logout');
    const btnAdmin = document.getElementById('btn-admin');
    const display = document.getElementById('user-display');

    if(display) display.innerText = user;

    if (user === "Admin") {
        modoAdminActivo = true;
        if(btnPerfil) btnPerfil.style.display = 'inline-block';
        if(btnLogout) btnLogout.style.display = 'inline-block';
        if(btnAdmin) btnAdmin.style.display = 'none';
    }
}

function llenarSelectorPisos() {
    const selPiso = document.getElementById('sel-piso');
    if(!selPiso) return;
    selPiso.innerHTML = '<option value="">Seleccione Piso Actual</option>';
    Object.keys(datosMapa).forEach(p => {
        selPiso.innerHTML += `<option value="${p}">${p}</option>`;
    });
}

// Lugares que son solo conexión entre pisos (no aparecen en origen/destino)
const LUGARES_SOLO_CONEXION = ['escalera_izquierda', 'escalera_derecha'];

function llenarSelectoresUbicaciones() {
    const selOri = document.getElementById('sel-origen');
    const selDes = document.getElementById('sel-destino');
    if(!selOri || !selDes) return;

    let opciones = '<option value="">Seleccione ubicación...</option>';

    Object.keys(datosMapa).forEach(piso => {
        Object.keys(datosMapa[piso]).forEach(zona => {
            if (zona !== "imagen") {
                Object.keys(datosMapa[piso][zona]).forEach(lugar => {
                    if (LUGARES_SOLO_CONEXION.includes(lugar)) return; // no mostrar en selects
                    const valor = `${piso}|${zona}|${lugar}`;
                    opciones += `<option value="${valor}">${lugar} (${piso})</option>`;
                });
            }
        });
    });
    selOri.innerHTML = opciones;
    selDes.innerHTML = opciones;
}

// 2. GESTIÓN DEL MAPA
function actualizarPiso() {
    const p = document.getElementById('sel-piso').value;
    if (p && datosMapa[p]) {
        img.src = datosMapa[p].imagen;
    }
}

// MEJORA AQUÍ: Sincronización de resolución natural para que la ruta no se desvíe
img.onload = () => {
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;
    escanearMapa();
    if (rutaGlobal.origen && rutaGlobal.destino) {
        trazarRuta();
    }
};
function escanearMapa() {
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    tempCtx.drawImage(img, 0, 0, tempCanvas.width, tempCanvas.height);

    const imgData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height).data;
    const cols = Math.floor(tempCanvas.width / TILE);
    const rows = Math.floor(tempCanvas.height / TILE);
    
    grid = Array(cols).fill().map(() => Array(rows).fill(0));

    // PASO 1: Detección estricta de paredes finas
    for (let x = 0; x < cols; x++) {
        for (let y = 0; y < rows; y++) {
            let esPared = false;
            const puntos = [{ox:.2,oy:.2},{ox:.8,oy:.2},{ox:.2,oy:.8},{ox:.8,oy:.8},{ox:.5,oy:.5}];

            for (let p of puntos) {
                const pxX = Math.floor(x * TILE + TILE * p.ox);
                const pxY = Math.floor(y * TILE + TILE * p.oy);
                const i = (pxY * tempCanvas.width + pxX) * 4;
                if (imgData[i+3] > 50 && (imgData[i] + imgData[i+1] + imgData[i+2]) / 3 < 160) {
                    esPared = true; break;
                }
            }
            if (esPared) grid[x][y] = 999;
        }
    }

    // PASO 2: Campo de fuerza (El que hace que la ruta se centre)
    const RADIO = 4; 
    for (let x = 0; x < cols; x++) {
        for (let y = 0; y < rows; y++) {
            if (grid[x][y] === 999) continue;
            let costoExtra = 0;
            for (let dx = -RADIO; dx <= RADIO; dx++) {
                for (let dy = -RADIO; dy <= RADIO; dy++) {
                    const nx = x + dx, ny = y + dy;
                    if (nx >= 0 && nx < cols && ny >= 0 && ny < rows && grid[nx][ny] === 999) {
                        const dist = Math.sqrt(dx*dx + dy*dy);
                        if (dist <= RADIO) {
                            costoExtra = Math.max(costoExtra, (RADIO + 1 - dist) * 20);
                        }
                    }
                }
            }
            grid[x][y] = costoExtra;
        }
    }
    statusBar.innerText = "✅ Mapa de alta precisión listo";
}

// 3. LÓGICA DE RUTA INTELIGENTE
function prepararRuta() {
    rutaGlobal.origen = document.getElementById('sel-origen').value;
    rutaGlobal.destino = document.getElementById('sel-destino').value;
    escaleraSeleccionadaGlobal = null; 

    if (!rutaGlobal.origen || !rutaGlobal.destino) {
        alert("Seleccione origen y destino");
        return;
    }

    const [pisoO] = rutaGlobal.origen.split('|');
    const pisoActual = document.getElementById('sel-piso').value;

    if (pisoActual !== pisoO) {
        document.getElementById('sel-piso').value = pisoO;
        actualizarPiso();
    } else {
        trazarRuta();
    }
}

function trazarRuta() {
    const pisoVista = document.getElementById('sel-piso').value;
    if (!pisoVista || !rutaGlobal.origen || !rutaGlobal.destino) return;

    const [pisoO, zonaO, puntoO] = rutaGlobal.origen.split('|');
    const [pisoD, zonaD, puntoD] = rutaGlobal.destino.split('|');

    let pA, pB;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!escaleraSeleccionadaGlobal && pisoO !== pisoD) {
        const o = datosMapa[pisoO][zonaO][puntoO];
        const d = datosMapa[pisoD][zonaD][puntoD];

        // Todas las escaleras usan el mismo nombre por piso; el piso desambigua (no se confunde Sótano con Piso 2).
        const escIzqO = datosMapa[pisoO]?.["Ala_Oeste"]?.["escalera_izquierda"];
        const escDerO = datosMapa[pisoO]?.["Ala_Este"]?.["escalera_derecha"];
        const escIzqD = datosMapa[pisoD]?.["Ala_Oeste"]?.["escalera_izquierda"];
        const escDerD = datosMapa[pisoD]?.["Ala_Este"]?.["escalera_derecha"];

        const dist = (p1, p2) => (p1 && p2) ? Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2)) : Infinity;
        const totalIzq = dist(o, escIzqO) + dist(d, escIzqD);
        
        let totalDer = Infinity;
        if (escDerO && escDerD) {
            totalDer = dist(o, escDerO) + dist(d, escDerD);
        }

        escaleraSeleccionadaGlobal = (totalIzq <= totalDer) ? "IZQUIERDA" : "DERECHA";
    }

    if (pisoVista === pisoO && pisoVista !== pisoD) {
        pA = datosMapa[pisoO][zonaO][puntoO];
        pB = (escaleraSeleccionadaGlobal === "IZQUIERDA")
            ? datosMapa[pisoVista]?.["Ala_Oeste"]?.["escalera_izquierda"]
            : datosMapa[pisoVista]?.["Ala_Este"]?.["escalera_derecha"];
        statusBar.innerText = `➡️ Diríjase a la escalera ${escaleraSeleccionadaGlobal}`;
    }
    else if (pisoVista === pisoD) {
        pB = datosMapa[pisoD][zonaD][puntoD];
        if (pisoVista === pisoO) {
            pA = datosMapa[pisoO][zonaO][puntoO];
        } else {
            pA = (escaleraSeleccionadaGlobal === "IZQUIERDA")
                ? datosMapa[pisoVista]?.["Ala_Oeste"]?.["escalera_izquierda"]
                : datosMapa[pisoVista]?.["Ala_Este"]?.["escalera_derecha"];
        }
        statusBar.innerText = "🚩 Destino en este piso";
    }

    if (pA && pB) {
        const start = { x: Math.floor((pA.x * canvas.width) / TILE), y: Math.floor((pA.y * canvas.height) / TILE) };
        const end = { x: Math.floor((pB.x * canvas.width) / TILE), y: Math.floor((pB.y * canvas.height) / TILE) };
        const path = aStar(start, end);
        if (path) {
            if(window.animRuta) cancelAnimationFrame(window.animRuta);
            const animar = () => {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                dibujarRuta(path);
                window.animRuta = requestAnimationFrame(animar);
            };
            animar();
        }
        else statusBar.innerText = "❌ Camino obstruido o mapa no legible";
    }
}

// 4. ALGORITMO A* (Optimizado para evitar bloqueos)
function aStar(start, end) {
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
        for(let i = 1; i < openSet.length; i++) {
            if(fScore.get(key(openSet[i])) < fScore.get(key(openSet[index]))) index = i;
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
            {x:current.x+1, y:current.y}, {x:current.x-1, y:current.y},
            {x:current.x, y:current.y+1}, {x:current.x, y:current.y-1},
            {x:current.x+1, y:current.y+1}, {x:current.x-1, y:current.y+1},
            {x:current.x+1, y:current.y-1}, {x:current.x-1, y:current.y-1}
        ];

        for (let v of vecinos) {
            if (v.x < 0 || v.x >= grid.length || v.y < 0 || v.y >= grid[0].length) continue;
            if (grid[v.x][v.y] === 999) continue;

            // Bloqueo estricto de esquinas
            if (v.x !== current.x && v.y !== current.y) {
                if (grid[current.x][v.y] === 999 || grid[v.x][current.y] === 999) continue;
            }

            const pesoDist = (v.x !== current.x && v.y !== current.y) ? 1.41 : 1;
            let tentativeG = gScore.get(key(current)) + pesoDist + (grid[v.x][v.y] || 0);

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

// 5. RENDER (RUTA CON CORTE LIMPIO)
function dibujarRuta(path) {
    if (!path || path.length < 2) return;
    const pDestino = path[0];
    const indexReferencia = Math.min(path.length - 1, 4); 
    const pReferencia = path[indexReferencia];

    const xDestino = pDestino.x * TILE + TILE/2;
    const yDestino = pDestino.y * TILE + TILE/2;
    const xRef = pReferencia.x * TILE + TILE/2;
    const yRef = pReferencia.y * TILE + TILE/2;
    const angulo = Math.atan2(yDestino - yRef, xDestino - xRef);

    ctx.beginPath();
    ctx.strokeStyle = "#d32f2f"; 
    ctx.lineWidth = 5; 
    ctx.lineCap = "round";
    ctx.setLineDash([10, 10]);
    ctx.lineDashOffset = -offsetAnimacion;
    
    ctx.moveTo(path[path.length-1].x * TILE + TILE/2, path[path.length-1].y * TILE + TILE/2);
    for (let i = path.length - 2; i >= indexReferencia; i--) {
        ctx.lineTo(path[i].x * TILE + TILE/2, path[i].y * TILE + TILE/2);
    }
    ctx.stroke();

    ctx.setLineDash([]); 
    ctx.fillStyle = "#d32f2f";
    ctx.save();
    ctx.translate(xDestino, yDestino);
    ctx.rotate(angulo);
    ctx.beginPath();
    ctx.moveTo(0, 0); 
    ctx.lineTo(-18, -10); 
    ctx.lineTo(-18, 10);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    offsetAnimacion += 0.5; 
}

// 6. ADMIN & SESSION
const ZONAS_DISPONIBLES = ['Ala_Oeste', 'Centro', 'Ala_Este'];
let pendingAgregarPiso = null;
let pendingAgregarCoords = null;

function gestionarClicMapa(event) {
    if (!modoAdminActivo) return;
    const piso = document.getElementById('sel-piso').value;
    if (!piso) return alert("Selecciona un piso primero");
    
    const rect = img.getBoundingClientRect();
    const x = parseFloat(((event.clientX - rect.left) / rect.width).toFixed(3));
    const y = parseFloat(((event.clientY - rect.top) / rect.height).toFixed(3));
    
    pendingAgregarPiso = piso;
    pendingAgregarCoords = { x, y };
    document.getElementById('modal-agregar-nombre').value = '';
    document.getElementById('modal-agregar-sector').value = 'Ala_Oeste';
    document.getElementById('modal-agregar').style.display = 'flex';
    document.getElementById('modal-agregar-nombre').focus();
}

function confirmarAgregarUbicacion() {
    const nombre = document.getElementById('modal-agregar-nombre').value.trim();
    const sector = document.getElementById('modal-agregar-sector').value;
    if (!nombre) return alert("Escribe el nombre de la ubicación.");
    if (!pendingAgregarPiso || !pendingAgregarCoords) return;
    
    const piso = pendingAgregarPiso;
    if (!datosMapa[piso][sector]) datosMapa[piso][sector] = {};
    datosMapa[piso][sector][nombre] = { ...pendingAgregarCoords };
    localStorage.setItem('mapaDataUBV', JSON.stringify(datosMapa));
    llenarSelectoresUbicaciones();
    llenarSelectorEliminar();
    cerrarModalAgregar();
    alert("Punto guardado localmente.");
}

function cerrarModalAgregar() {
    document.getElementById('modal-agregar').style.display = 'none';
    pendingAgregarPiso = null;
    pendingAgregarCoords = null;
}

function llenarSelectorEliminar() {
    const sel = document.getElementById('sel-eliminar-ubicacion');
    if (!sel) return;
    sel.innerHTML = '<option value="">Seleccione ubicación a eliminar...</option>';
    Object.keys(datosMapa).forEach(piso => {
        Object.keys(datosMapa[piso]).forEach(zona => {
            if (zona !== "imagen") {
                Object.keys(datosMapa[piso][zona]).forEach(lugar => {
                    const valor = `${piso}|${zona}|${lugar}`;
                    sel.innerHTML += `<option value="${valor}">${lugar} — ${zona} (${piso})</option>`;
                });
            }
        });
    });
}

function eliminarUbicacionSeleccionada() {
    const sel = document.getElementById('sel-eliminar-ubicacion');
    if (!sel || !sel.value) return alert("Selecciona una ubicación para eliminar.");
    const [piso, zona, lugar] = sel.value.split('|');
    if (!piso || !zona || !lugar) return;
    if (!confirm(`¿Eliminar "${lugar}" de ${zona} (${piso})?`)) return;
    
    if (datosMapa[piso] && datosMapa[piso][zona]) {
        delete datosMapa[piso][zona][lugar];
        localStorage.setItem('mapaDataUBV', JSON.stringify(datosMapa));
        llenarSelectoresUbicaciones();
        llenarSelectorEliminar();
        alert("Ubicación eliminada.");
    }
}

function accesoAdmin() {
    const user = prompt("Usuario:");
    const pass = prompt("Contraseña:");
    if (user === "admin" && pass === "1234") {
        localStorage.setItem('usuarioUBV', 'Admin');
        actualizarInfoUsuario();
        alert("Acceso concedido.");
    } else {
        alert("Error de acceso.");
    }
}

function resetearMemoria() {
    if (confirm("¿Restablecer datos originales?")) {
        localStorage.removeItem('mapaDataUBV');
        location.reload();
    }
}

function abrirPanelAdmin() {
    const panel = document.getElementById('panel-admin');
    const area = document.getElementById('json-output-admin');
    if (!panel || !area) return;

    const data = localStorage.getItem('mapaDataUBV');
    area.value = data || "No hay cambios guardados.";
    
    // Cargar configuración de GitHub si existe
    const config = JSON.parse(localStorage.getItem('githubConfig') || '{}');
    const userInput = document.getElementById('github-user');
    const repoInput = document.getElementById('github-repo');
    const tokenInput = document.getElementById('github-token');
    
    if (userInput) userInput.value = config.user || '';
    if (repoInput) repoInput.value = config.repo || '';
    if (tokenInput) tokenInput.value = config.token || '';
    
    llenarSelectorEliminar();
    panel.style.display = 'block';
}

function cerrarPanelAdmin() {
    const panel = document.getElementById('panel-admin');
    if (panel) panel.style.display = 'none';
}

function copiarJSONAdmin() {
    const area = document.getElementById('json-output-admin');
    if (!area) return;
    area.select();
    document.execCommand('copy');
    alert("JSON copiado al portapapeles. Pégalo en tu archivo ubicaciones.json");
}

function descargarJSONAdmin() {
    const data = localStorage.getItem('mapaDataUBV');
    if (!data) {
        alert("No hay cambios guardados para descargar.");
        return;
    }

    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ubicaciones_mod.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function guardarConfigGitHub() {
    const user = document.getElementById('github-user').value.trim();
    const repo = document.getElementById('github-repo').value.trim();
    const token = document.getElementById('github-token').value.trim();
    
    if (!user || !repo || !token) {
        alert("Por favor completa todos los campos de configuración.");
        return;
    }
    
    localStorage.setItem('githubConfig', JSON.stringify({ user, repo, token }));
    alert("Configuración guardada. Ahora puedes usar 'Guardar en GitHub'.");
}

async function guardarEnGitHub() {
    const config = JSON.parse(localStorage.getItem('githubConfig') || '{}');
    const data = localStorage.getItem('mapaDataUBV');
    const statusDiv = document.getElementById('github-status');
    
    if (!config.user || !config.repo || !config.token) {
        if (statusDiv) statusDiv.innerHTML = '<span style="color:red;">⚠️ Configura primero GitHub (arriba)</span>';
        alert("Por favor configura primero tus datos de GitHub en el panel.");
        return;
    }
    
    if (!data) {
        if (statusDiv) statusDiv.innerHTML = '<span style="color:orange;">⚠️ No hay cambios para guardar</span>';
        alert("No hay cambios guardados localmente.");
        return;
    }
    
    // Validación adicional de seguridad
    const confirmacion = prompt("⚠️ SEGURIDAD: Escribe 'CONFIRMAR' para guardar en GitHub:");
    if (confirmacion !== 'CONFIRMAR') {
        if (statusDiv) statusDiv.innerHTML = '<span style="color:orange;">❌ Guardado cancelado</span>';
        return;
    }
    
    if (statusDiv) statusDiv.innerHTML = '<span style="color:blue;">⏳ Guardando en GitHub...</span>';
    
    try {
        // Paso 1: Obtener el SHA del archivo actual (necesario para actualizar)
        const getFileUrl = `https://api.github.com/repos/${config.user}/${config.repo}/contents/ubicaciones.json`;
        const getFileRes = await fetch(getFileUrl, {
            headers: {
                'Authorization': `token ${config.token}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });
        
        let sha = null;
        if (getFileRes.ok) {
            const fileData = await getFileRes.json();
            sha = fileData.sha;
        }
        
        // Paso 2: Actualizar el archivo
        const content = btoa(unescape(encodeURIComponent(data))); // Base64 encode
        const updateUrl = `https://api.github.com/repos/${config.user}/${config.repo}/contents/ubicaciones.json`;
        
        const updateBody = {
            message: `Actualización automática de ubicaciones - ${new Date().toLocaleString('es-ES')}`,
            content: content,
            branch: 'main' // o 'master' según tu repo
        };
        
        if (sha) {
            updateBody.sha = sha; // Necesario para actualizar archivo existente
        }
        
        const updateRes = await fetch(updateUrl, {
            method: 'PUT',
            headers: {
                'Authorization': `token ${config.token}`,
                'Accept': 'application/vnd.github.v3+json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(updateBody)
        });
        
        if (updateRes.ok) {
            const result = await updateRes.json();
            if (statusDiv) statusDiv.innerHTML = '<span style="color:green;">✅ Guardado exitosamente en GitHub</span>';
            
            // Limpiar cambios locales después de guardar exitosamente
            if (confirm("¿Deseas limpiar los cambios locales ahora que están guardados en GitHub?")) {
                localStorage.removeItem('mapaDataUBV');
                location.reload();
            }
        } else {
            const error = await updateRes.json();
            throw new Error(error.message || 'Error al guardar');
        }
    } catch (error) {
        console.error('Error:', error);
        if (statusDiv) statusDiv.innerHTML = `<span style="color:red;">❌ Error: ${error.message}</span>`;
        alert(`Error al guardar en GitHub: ${error.message}\n\nVerifica:\n- Token válido con permisos de escritura\n- Nombre de usuario y repo correctos\n- El archivo ubicaciones.json existe en el repo`);
    }
}

function logout() {
    if (!confirm("¿Cerrar sesión de administrador?")) return;

    localStorage.removeItem('usuarioUBV');
    modoAdminActivo = false;

    const btnPerfil = document.getElementById('btn-perfil');
    const btnLogout = document.getElementById('btn-logout');
    const btnAdmin = document.getElementById('btn-admin');
    const display = document.getElementById('user-display');

    if (btnPerfil) btnPerfil.style.display = 'none';
    if (btnLogout) btnLogout.style.display = 'none';
    if (btnAdmin) btnAdmin.style.display = 'inline-block';
    if (display) display.innerText = 'Invitado';

    cerrarPanelAdmin();
}

window.onload = () => {
    cargarDatos();
};