// Menu page functionality

document.addEventListener('DOMContentLoaded', () => {
    console.log('Menú principal cargado');

    // Detectar si está instalado como PWA
    const isPWA = window.matchMedia('(display-mode: standalone)').matches ||
                  window.navigator.standalone === true;

    if (isPWA) {
        console.log('Aplicación ejecutándose en modo PWA');
    }

    // Agregar efectos de hover mejorados para móviles
    const mainButton = document.querySelector('.main-button');
    if (mainButton) {
        mainButton.addEventListener('touchstart', () => {
            mainButton.style.transform = 'scale(0.98)';
        });

        mainButton.addEventListener('touchend', () => {
            setTimeout(() => {
                mainButton.style.transform = '';
            }, 150);
        });
    }

    // Animación de entrada para las tarjetas de características
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
            }
        });
    }, observerOptions);

    // Aplicar animación a las tarjetas de características
    const featureCards = document.querySelectorAll('.feature-card');
    featureCards.forEach(card => {
        card.style.opacity = '0';
        card.style.transform = 'translateY(20px)';
        card.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        observer.observe(card);
    });

    // Prevenir zoom en iOS cuando se hace doble tap
    let lastTouchEnd = 0;
    document.addEventListener('touchend', (event) => {
        const now = Date.now();
        if (now - lastTouchEnd <= 300) {
            event.preventDefault();
        }
        lastTouchEnd = now;
    }, false);

    // Agregar preload para la página del mapa
    const link = document.createElement('link');
    link.rel = 'preload';
    link.href = 'map.html';
    link.as = 'document';
    document.head.appendChild(link);
});