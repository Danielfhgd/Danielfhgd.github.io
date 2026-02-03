/**
 * Módulo para gestionar el perfil de administrador (Panel de Control)
 * Migrado del proyecto anterior.
 */

class AdminProfileManager {
    constructor() {
        this.panel = document.getElementById('panel-admin-profile');
        this.jsonOutput = document.getElementById('json-output-admin');
        this.githubStatus = document.getElementById('github-status');

        this.btnOpen = document.querySelector('[data-action="admin-profile"]'); // El botón del menú
        this.btnClose = document.getElementById('close-admin-profile');

        this.init();
    }

    init() {
        // Encontrar botón en el menú (puede haberse creado dinámicamente o estar en HTML)
        // El usuario agregó: <button class="dropdown-item" data-action="">...Perfil Admin</button>
        // Debemos buscarlo y asignarle el data-action correcto si no lo tiene, o buscar por texto
        this.setupMenuButton();

        // Event Listeners para botones del panel
        this.bindEvents();
    }

    setupMenuButton() {
        // Buscar el botón por su data-action específico
        // Solo necesitamos la referencia para controlar su visibilidad (display block/none)
        // El evento de click ahora es manejado centralmente por initDropdownMenu en app.js
        this.btnOpen = document.querySelector('[data-action="admin-profile"]');

        if (this.btnOpen) {
            this.btnOpen.style.display = 'none'; // Ocultar por defecto
        }
    }

    bindEvents() {
        // Cerrar panel
        if (this.btnClose) {
            this.btnClose.addEventListener('click', () => this.cerrarPanel());
        }

        // Botones de acción dentro del panel
        const btnCopy = document.getElementById('btn-copy-json');
        if (btnCopy) btnCopy.addEventListener('click', () => this.copiarJSON());

        const btnDownload = document.getElementById('btn-download-json');
        if (btnDownload) btnDownload.addEventListener('click', () => this.descargarJSON());

        const btnSaveGithub = document.getElementById('btn-save-github');
        if (btnSaveGithub) btnSaveGithub.addEventListener('click', () => this.guardarEnGitHub());

        const btnSaveConfig = document.getElementById('btn-save-github-config');
        if (btnSaveConfig) btnSaveConfig.addEventListener('click', () => this.guardarConfigGitHub());

        const btnReset = document.getElementById('btn-reset-local');
        if (btnReset) btnReset.addEventListener('click', () => this.resetearMemoria());

        const btnEliminar = document.getElementById('btn-eliminar-ubicacion');
        if (btnEliminar) btnEliminar.addEventListener('click', () => this.eliminarUbicacion());

        // Escuchar actualización de datos (Sincronización en tiempo real)
        document.addEventListener('mapDataUpdated', (e) => {
            console.log("AdminProfileManager: detectada actualización de datos");
            if (this.jsonOutput && e.detail?.data) {
                this.jsonOutput.value = JSON.stringify(e.detail.data, null, 2);
            }
            this.llenarSelectorEliminar();
        });
    }

    /**
     * Muestra el botón de Perfil Admin si el usuario es administrador
     * @param {boolean} isAdmin 
     */
    setAdminState(isAdmin) {
        if (this.btnOpen) {
            this.btnOpen.style.display = isAdmin ? 'flex' : 'none';
        }
    }

    abrirPanel() {
        if (!this.panel) return;

        // Cargar datos actuales
        const data = localStorage.getItem('mapaDataUBV'); // Usamos la misma clave que el proyecto viejo para compatibilidad
        if (this.jsonOutput) {
            this.jsonOutput.value = data || "No hay cambios guardados localmente.";
        }

        // Llenar selector de eliminar ubicación
        this.llenarSelectorEliminar();

        // Cargar config de GitHub
        const config = JSON.parse(localStorage.getItem('githubConfig') || '{}');
        const userIn = document.getElementById('github-user');
        const repoIn = document.getElementById('github-repo');
        const tokenIn = document.getElementById('github-token');
        const branchIn = document.getElementById('github-branch');
        const pathIn = document.getElementById('github-path');

        if (userIn) userIn.value = config.user || '';
        if (repoIn) repoIn.value = config.repo || '';
        if (tokenIn) tokenIn.value = config.token || '';
        if (branchIn) branchIn.value = config.branch || 'main';
        if (pathIn) pathIn.value = config.path || 'data/dataUBV.json';

        this.panel.classList.add('active');
    }

    cerrarPanel() {
        if (this.panel) {
            this.panel.classList.remove('active');
        }
    }

    copiarJSON() {
        if (!this.jsonOutput) return;
        this.jsonOutput.select();
        document.execCommand('copy'); // Fallback antiguo pero funcional
        alert("JSON copiado al portapapeles.");
    }

    descargarJSON() {
        const data = localStorage.getItem('mapaDataUBV');
        if (!data) {
            alert("No hay cambios guardados para descargar.");
            return;
        }
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'dataUBV_mod.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    guardarConfigGitHub() {
        const user = document.getElementById('github-user').value.trim();
        const repo = document.getElementById('github-repo').value.trim();
        const token = document.getElementById('github-token').value.trim();
        const branch = document.getElementById('github-branch').value.trim() || 'main';
        const path = document.getElementById('github-path').value.trim() || 'data/dataUBV.json';

        if (!user || !repo || !token) {
            alert("Completa todos los campos de configuración.");
            return;
        }

        localStorage.setItem('githubConfig', JSON.stringify({ user, repo, token, branch, path }));
        alert("Configuración de GitHub guardada.");
    }

    async guardarEnGitHub() {
        const config = JSON.parse(localStorage.getItem('githubConfig') || '{}');
        const data = localStorage.getItem('mapaDataUBV');

        if (!config.user || !config.repo || !config.token) {
            alert("Configura primero GitHub (Usuario, Repo, Token, Archivo).");
            return;
        }
        if (!data) {
            alert("No hay datos locales para guardar.");
            return;
        }

        if (!confirm("Se sobrescribirá el archivo 'dataUBV.json' en el repositorio. ¿Continuar?")) return;

        if (this.githubStatus) this.githubStatus.innerHTML = '<span style="color:blue">⏳ Guardando...</span>';

        try {
            // 1. Obtener SHA actual (especificando la rama para evitar confusiones)
            const path = config.path || 'data/dataUBV.json';
            const branch = config.branch || 'main';
            const url = `https://api.github.com/repos/${config.user}/${config.repo}/contents/${path}?ref=${branch}`;

            if (this.githubStatus) this.githubStatus.innerHTML = `<span style="color:blue">⏳ Conectando con GitHub (Ruta: ${path})...</span>`;

            let sha = null;
            try {
                const res = await fetch(url, {
                    headers: { 'Authorization': `token ${config.token}`, 'Accept': 'application/vnd.github.v3+json' }
                });
                if (res.ok) {
                    const json = await res.json();
                    sha = json.sha;
                }
            } catch (e) { }

            // 2. Actualizar
            const contentEncoded = btoa(unescape(encodeURIComponent(data)));
            const body = {
                message: `Update via GeoUBV Admin Panel - ${new Date().toLocaleString()}`,
                content: contentEncoded,
                branch: branch
            };
            if (sha) body.sha = sha;

            const updateRes = await fetch(`https://api.github.com/repos/${config.user}/${config.repo}/contents/${path}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `token ${config.token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(body)
            });

            if (updateRes.ok) {
                if (this.githubStatus) this.githubStatus.innerHTML = '<span style="color:green">✅ Guardado OK</span>';

                // NOTIFICAR CAMBIO (Sincronizar otros módulos después de guardar en GitHub)
                document.dispatchEvent(new CustomEvent('mapDataUpdated', { detail: { data: JSON.parse(data) } }));

                alert("Guardado exitosamente en GitHub.");
            } else {
                throw new Error((await updateRes.json()).message);
            }

        } catch (error) {
            console.error(error);
            if (this.githubStatus) this.githubStatus.innerHTML = '<span style="color:red">❌ Error</span>';
            alert("Error al guardar en GitHub: " + error.message);
        }
    }

    resetearMemoria() {
        if (confirm("¿Borrar cambios locales y recargar datos originales?")) {
            localStorage.removeItem('mapaDataUBV');
            location.reload();
        }
    }

    async llenarSelectorEliminar() {
        const sel = document.getElementById('sel-eliminar-ubicacion');
        let dataStr = localStorage.getItem('mapaDataUBV');
        let datosMapa = null;

        if (dataStr) {
            datosMapa = JSON.parse(dataStr);
        } else {
            // Si no hay locales, sugerir cargar los estáticos
            sel.innerHTML = '<option value="">Cargando datos del sistema...</option>';
            try {
                let response = await fetch('./data/dataUBV.json');
                if (!response.ok) response = await fetch('./Nueva carpeta/dataUBV.json');
                if (response.ok) {
                    datosMapa = await response.json();
                }
            } catch (e) { console.error(e); }
        }

        if (!sel || !datosMapa) {
            if (sel) sel.innerHTML = '<option value="">No hay datos disponibles...</option>';
            return;
        }

        sel.innerHTML = '<option value="">Seleccione ubicación a eliminar...</option>';

        Object.keys(datosMapa).forEach(piso => {
            Object.keys(datosMapa[piso]).forEach(zona => {
                // Filtrar propiedades de imagen
                if (zona !== "imagen" && zona !== "svg" && zona !== "image") {
                    const contenido = datosMapa[piso][zona];

                    // Manejar Arrays (formato original)
                    if (Array.isArray(contenido)) {
                        contenido.forEach(item => {
                            const lugar = Object.keys(item)[0]; // { "Aula": {...} }
                            const valor = `${piso}|${zona}|${lugar}`;
                            sel.innerHTML += `<option value="${valor}">${lugar} — ${zona} (${piso})</option>`;
                        });
                    }
                    // Manejar Objetos (formato editado)
                    else if (contenido && typeof contenido === 'object') {
                        Object.keys(contenido).forEach(lugar => {
                            const valor = `${piso}|${zona}|${lugar}`;
                            sel.innerHTML += `<option value="${valor}">${lugar} — ${zona} (${piso})</option>`;
                        });
                    }
                }
            });
        });
    }

    async eliminarUbicacion() {
        const sel = document.getElementById('sel-eliminar-ubicacion');
        if (!sel || !sel.value) {
            alert("Selecciona una ubicación para eliminar.");
            return;
        }

        const [piso, zona, lugar] = sel.value.split('|');
        if (!piso || !zona || !lugar) return;

        if (!confirm(`¿Eliminar "${lugar}" de ${zona} (${piso})?`)) return;

        // Cargar TODO en memoria, igual que en el MapEditor
        let datosMapa = JSON.parse(localStorage.getItem('mapaDataUBV') || 'null');

        if (!datosMapa) {
            // Importar estáticos antes de borrar para no perder el resto
            try {
                let response = await fetch('./data/dataUBV.json');
                if (!response.ok) response = await fetch('./Nueva carpeta/dataUBV.json');
                if (response.ok) datosMapa = await response.json();
            } catch (e) { }
        }

        if (!datosMapa) {
            alert("Error crítico: No se pudieron cargar datos para editar.");
            return;
        }

        let borrado = false;

        if (datosMapa[piso] && datosMapa[piso][zona]) {
            const contenido = datosMapa[piso][zona];

            // Si es Array (original), convertir a objeto, borrar el item, y guardar como objeto
            if (Array.isArray(contenido)) {
                const obj = {};
                contenido.forEach(item => {
                    const key = Object.keys(item)[0];
                    if (key !== lugar) { // COPIAR si no es el borrado
                        obj[key] = item[key];
                    } else {
                        borrado = true;
                    }
                });
                datosMapa[piso][zona] = obj;
            }
            // Si es Objeto (ya editado)
            else if (contenido[lugar]) {
                delete datosMapa[piso][zona][lugar];
                borrado = true;
            }
        }

        if (borrado) {
            localStorage.setItem('mapaDataUBV', JSON.stringify(datosMapa));

            this.llenarSelectorEliminar();
            if (this.jsonOutput) this.jsonOutput.value = JSON.stringify(datosMapa, null, 2);

            alert("Ubicación eliminada permanentemente de la vista local.");
        } else {
            alert("No se encontró la ubicación en la estructura de datos.");
        }
    }
}

export default AdminProfileManager;
