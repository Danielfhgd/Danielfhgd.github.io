// Módulo para gestionar la búsqueda y validación de rutas

class RouteSearch {
    constructor(mapLoader) {
        // Map loader (opcional) para trazar rutas
        this.mapLoader = mapLoader;

        // Lista de ubicaciones disponibles (objetos con {name, coords})
        this.locations = [];
        
        this.originInput = document.getElementById('origin-search');
        this.destinationInput = document.getElementById('destination-search');
        this.originSuggestions = document.getElementById('origin-suggestions');
        this.destinationSuggestions = document.getElementById('destination-suggestions');
        this.originError = document.getElementById('origin-error');
        this.destinationError = document.getElementById('destination-error');
        this.calculateBtn = document.getElementById('route-calculate-btn');
        
        this.selectedOrigin = null;
        this.selectedDestination = null;
        
        this.init();
    }

    /**
     * Inicializa los event listeners
     */
    init() {
        if (!this.originInput || !this.destinationInput) {
            console.error('No se encontraron los elementos de búsqueda');
            return;
        }

        // Event listeners para el buscador de origen
        this.originInput.addEventListener('input', (e) => {
            this.handleSearch(e.target.value, 'origin');
            this.clearError('origin');
        });

        this.originInput.addEventListener('focus', () => {
            this.handleSearch(this.originInput.value, 'origin');
        });

        // Event listeners para el buscador de destino
        this.destinationInput.addEventListener('input', (e) => {
            this.handleSearch(e.target.value, 'destination');
            this.clearError('destination');
        });

        this.destinationInput.addEventListener('focus', () => {
            this.handleSearch(this.destinationInput.value, 'destination');
        });

        // Cerrar sugerencias al hacer clic fuera
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.route-search-wrapper')) {
                this.hideSuggestions('origin');
                this.hideSuggestions('destination');
            }
        });

        // Botón calcular
        if (this.calculateBtn) {
            this.calculateBtn.addEventListener('click', () => {
                this.validateAndCalculate();
            });
            console.log('RouteSearch: botón calcular adjuntado', !!this.calculateBtn);
        } else {
            console.warn('RouteSearch: botón calcular no encontrado');
        }
    }

    /**
     * Maneja la búsqueda y muestra sugerencias
     * @param {string} query - Texto de búsqueda
     * @param {string} type - 'origin' o 'destination'
     */
    handleSearch(query, type) {
        const input = type === 'origin' ? this.originInput : this.destinationInput;
        const suggestionsContainer = type === 'origin' ? this.originSuggestions : this.destinationSuggestions;
        
        if (!query || query.trim() === '') {
            // Mostrar todas las ubicaciones cuando el campo está vacío y enfocado
            this.showSuggestions(this.locations.map(loc => loc.name), type);
            return;
        }

        // Filtrar ubicaciones que coincidan con la búsqueda
        const filtered = this.locations.filter(location => 
            location.name.toLowerCase().includes(query.toLowerCase())
        );

        if (filtered.length > 0) {
            this.showSuggestions(filtered.map(loc => loc.name), type);
        } else {
            this.hideSuggestions(type);
        }
    }

    /**
     * Muestra las sugerencias
     * @param {Array<string>} suggestions - Lista de sugerencias
     * @param {string} type - 'origin' o 'destination'
     */
    showSuggestions(suggestions, type) {
        const suggestionsContainer = type === 'origin' ? this.originSuggestions : this.destinationSuggestions;
        
        suggestionsContainer.innerHTML = '';
        suggestionsContainer.classList.add('active');

        suggestions.forEach(suggestion => {
            const item = document.createElement('div');
            item.className = 'route-suggestion-item';
            item.textContent = suggestion;
            item.addEventListener('click', () => {
                this.selectLocation(suggestion, type);
            });
            suggestionsContainer.appendChild(item);
        });
    }

    /**
     * Oculta las sugerencias
     * @param {string} type - 'origin' o 'destination'
     */
    hideSuggestions(type) {
        const suggestionsContainer = type === 'origin' ? this.originSuggestions : this.destinationSuggestions;
        suggestionsContainer.classList.remove('active');
    }

    /**
     * Selecciona una ubicación de las sugerencias
     * @param {string} locationName - Nombre de la ubicación seleccionada
     * @param {string} type - 'origin' o 'destination'
     */
    selectLocation(locationName, type) {
        const input = type === 'origin' ? this.originInput : this.destinationInput;
        
        input.value = locationName;
        this.hideSuggestions(type);
        this.clearError(type);
        
        // Encontrar el objeto completo de la ubicación
        const locationObj = this.locations.find(loc => loc.name === locationName);
        
        if (type === 'origin') {
            this.selectedOrigin = locationObj;
        } else {
            this.selectedDestination = locationObj;
        }
    }

    /**
     * Valida los campos y calcula la ruta
     */
    validateAndCalculate() {
        const originValue = this.originInput.value.trim();
        const destinationValue = this.destinationInput.value.trim();
        
        let hasErrors = false;

        // Validar origen
        if (!originValue) {
            this.showError('origin', 'Por favor, ingrese un origen');
            hasErrors = true;
        } else if (!this.isValidLocation(originValue)) {
            this.showError('origin', 'La ubicación ingresada no es válida. Por favor, seleccione una opción de la lista.');
            hasErrors = true;
        } else {
            this.clearError('origin');
            this.selectedOrigin = this.locations.find(loc => loc.name.toLowerCase() === originValue.toLowerCase());
        }

        // Validar destino
        if (!destinationValue) {
            this.showError('destination', 'Por favor, ingrese un destino');
            hasErrors = true;
        } else if (!this.isValidLocation(destinationValue)) {
            this.showError('destination', 'La ubicación ingresada no es válida. Por favor, seleccione una opción de la lista.');
            hasErrors = true;
        } else {
            this.clearError('destination');
            this.selectedDestination = this.locations.find(loc => loc.name.toLowerCase() === destinationValue.toLowerCase());
        }

        // Si no hay errores, calcular la ruta
        if (!hasErrors) {
            console.log('Calculando ruta desde:', this.selectedOrigin.name, 'coordenadas:', this.selectedOrigin.coords, 
                       'hasta:', this.selectedDestination.name, 'coordenadas:', this.selectedDestination.coords);
            // Intentar trazar la ruta en el mapa si el mapLoader está disponible
            if (this.mapLoader && this.selectedOrigin && this.selectedDestination) {
                try {
                    this.mapLoader.drawRouteFromCoords(this.selectedOrigin.coords, this.selectedDestination.coords);
                } catch (e) {
                    console.warn('Error trazando ruta en el mapa:', e);
                }
            }
        }
    }

    /**
     * Verifica si una ubicación es válida
     * @param {string} locationName - Nombre de la ubicación a validar
     * @returns {boolean}
     */
    isValidLocation(locationName) {
        return this.locations.some(loc => loc.name.toLowerCase() === locationName.toLowerCase());
    }

    /**
     * Muestra un mensaje de error
     * @param {string} type - 'origin' o 'destination'
     * @param {string} message - Mensaje de error
     */
    showError(type, message) {
        const errorElement = type === 'origin' ? this.originError : this.destinationError;
        const input = type === 'origin' ? this.originInput : this.destinationInput;
        
        if (errorElement) {
            errorElement.textContent = message;
            errorElement.classList.add('active');
        }
        
        if (input) {
            input.classList.add('error');
        }
    }

    /**
     * Limpia el mensaje de error
     * @param {string} type - 'origin' o 'destination'
     */
    clearError(type) {
        const errorElement = type === 'origin' ? this.originError : this.destinationError;
        const input = type === 'origin' ? this.originInput : this.destinationInput;
        
        if (errorElement) {
            errorElement.classList.remove('active');
        }
        
        if (input) {
            input.classList.remove('error');
        }
    }

    /**
     * Establece la lista de ubicaciones disponibles
     * @param {Array<Object>} locations - Lista de objetos con {name, coords}
     */
    setLocations(locations) {
        this.locations = locations;
    }

    /**
     * Obtiene el origen seleccionado
     * @returns {Object|null} - Objeto con {name, coords} o null
     */
    getOrigin() {
        return this.selectedOrigin;
    }

    /**
     * Obtiene el destino seleccionado
     * @returns {Object|null} - Objeto con {name, coords} o null
     */
    getDestination() {
        return this.selectedDestination;
    }
}

export default RouteSearch;
