/**
 * floorTitleManager.js
 * Módulo para gestionar el título del piso actual en el header.
 */

class FloorTitleManager {
    constructor() {
        this.titleElement = document.getElementById('current-floor-title');
    }

    /**
     * Actualiza el texto del título del piso
     * @param {number|string} floorNumber - El número o identificador del piso
     */
    updateFloorTitle(floorNumber) {
        if (!this.titleElement) return;

        // Convertir el identificador de piso a un nombre amigable
        // Dependiendo de cómo FloorManager maneje los pisos (normalmente 1, 0, -1 etc)
        let floorName = '';

        const floorStr = String(floorNumber).toLowerCase();

        if (floorStr === '1' || floorStr === 'piso1' || floorStr === 'piso 1') {
            floorName = 'Piso 1';
        } else if (floorStr === '0' || floorStr === 'sotano' || floorStr === 'sótano') {
            floorName = 'Sótano';
        } else {
            floorName = `Piso ${floorNumber}`;
        }

        this.titleElement.textContent = floorName;

        // Pequeña animación de feedback
        this.titleElement.animate([
            { opacity: 0, transform: 'translateY(-5px)' },
            { opacity: 1, transform: 'translateY(0)' }
        ], { duration: 300, easing: 'ease-out' });
    }
}

export default FloorTitleManager;
