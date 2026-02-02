// Header hide/show on scroll for mobile devices

document.addEventListener('DOMContentLoaded', () => {
    // Only apply on mobile devices and touch screens
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
                    ('ontouchstart' in window);

    if (!isMobile) return; // Skip on desktop

    const header = document.querySelector('.header');
    if (!header) return;

    let lastScrollTop = 0;
    let scrollThreshold = 10; // Minimum scroll distance to trigger
    let isHeaderHidden = false;

    // Throttle function to limit execution frequency
    function throttle(func, limit) {
        let inThrottle;
        return function() {
            const args = arguments;
            const context = this;
            if (!inThrottle) {
                func.apply(context, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        }
    }

    // Handle scroll event
    const handleScroll = throttle(() => {
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;

        // Don't hide header if we're at the very top
        if (scrollTop <= 0) {
            header.classList.remove('header-hidden');
            isHeaderHidden = false;
            return;
        }

        // Determine scroll direction
        if (Math.abs(lastScrollTop - scrollTop) <= scrollThreshold) {
            return; // Ignore small movements
        }

        if (scrollTop > lastScrollTop && !isHeaderHidden) {
            // Scrolling down - hide header
            header.classList.add('header-hidden');
            isHeaderHidden = true;
        } else if (scrollTop < lastScrollTop && isHeaderHidden) {
            // Scrolling up - show header
            header.classList.remove('header-hidden');
            isHeaderHidden = false;
        }

        lastScrollTop = scrollTop;
    }, 16); // ~60fps

    // Add scroll event listener
    window.addEventListener('scroll', handleScroll, { passive: true });

    // Show header when user touches/clicks (accessibility)
    const showHeaderOnInteraction = () => {
        if (isHeaderHidden) {
            header.classList.remove('header-hidden');
            isHeaderHidden = false;
        }
    };

    // Show header when focusing on inputs or buttons
    document.addEventListener('focusin', (e) => {
        if (e.target.matches('input, button, select, textarea')) {
            showHeaderOnInteraction();
        }
    });

    // Show header when modal opens
    const routeModal = document.getElementById('route-modal');
    if (routeModal) {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                    if (routeModal.classList.contains('active')) {
                        showHeaderOnInteraction();
                    }
                }
            });
        });
        observer.observe(routeModal, { attributes: true });
    }

    console.log('Header hide/show on scroll initialized for mobile');
});