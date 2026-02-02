# Mapa Digital Interactivo - Universidad Bolivariana de Venezuela

Sistema de navegación y guiado digital para el interior de edificios, desarrollado como una Progressive Web App (PWA) que funciona completamente offline.

## 📋 Descripción del Proyecto

Este proyecto consiste en un mapa digital interactivo diseñado para facilitar la navegación dentro de las instalaciones de la Universidad Bolivariana de Venezuela. La aplicación permite a los usuarios visualizar los diferentes pisos del edificio, buscar puntos de interés y calcular rutas óptimas entre dos ubicaciones.

### Fases de Desarrollo

- **Prototipo (Fase Actual)**: 3 pisos
- **Versión Final**: 10 pisos + sótano (11 pisos en total)

## 🎯 Funcionalidades Principales

- **Menú Principal**: Página de bienvenida con información general y acceso al mapa
- **Mapa Dinámico**: Visualización interactiva de los diferentes pisos del edificio mediante archivos SVG
- **Sistema de Guiado/Rutas**: Calcula y muestra la ruta óptima entre dos puntos seleccionados
- **Búsqueda de Puntos de Interés**: Permite localizar y navegar hacia ubicaciones específicas dentro del edificio
- **Interfaz Visual Intuitiva**: Diseño claro y fácil de usar para una experiencia de usuario óptima
- **Funcionamiento Offline**: PWA con Service Worker que permite usar la aplicación sin conexión a internet

## 🗺️ Sistema de Navegación y Rutas

### Detección de Caminos

El sistema utiliza los archivos SVG de cada piso para determinar las áreas transitables:
- **Áreas Blancas**: Zonas caminables donde el usuario puede desplazarse
- **Áreas Negras**: Paredes y obstáculos no transitables

Esta diferenciación permite al algoritmo de rutas calcular trayectorias válidas evitando colisiones con las estructuras del edificio.

### Sistema de Selección de Rutas

Dado que la aplicación funciona en interiores (sin GPS), el sistema utiliza un enfoque de selección manual:

- **Punto A (Desde)**: Punto de origen seleccionado por el usuario
- **Punto B (Hasta)**: Punto de destino seleccionado por el usuario

El sistema calculará automáticamente la ruta más eficiente entre estos dos puntos.

### Algoritmos de Ruta Considerados

Para el cálculo de rutas, se están evaluando las siguientes opciones:

1. **Algoritmo A\***: Eficiente para encontrar el camino más corto, especialmente útil cuando se conoce la ubicación del destino
2. **Algoritmo de Dijkstra**: Garantiza encontrar el camino más corto, aunque puede ser más lento en espacios grandes
3. **Alternativas más sencillas**: Se está evaluando si existe una solución más simple que se adapte mejor a las necesidades específicas del proyecto

La decisión final se tomará basándose en el rendimiento, la simplicidad de implementación y los requisitos específicos del edificio.

## 🔧 Tecnologías y Arquitectura

### Progressive Web App (PWA)

La aplicación está diseñada como una PWA para permitir:
- Instalación en dispositivos móviles y de escritorio
- Funcionamiento completo sin conexión a internet
- Actualización automática del contenido cuando hay conexión disponible

### Service Worker

El Service Worker gestiona:
- Caché de recursos estáticos (HTML, CSS, JavaScript, SVG)
- Funcionalidad offline completa
- Actualización de contenido en segundo plano

## 📁 Estructura del Proyecto

```
├── menu.html              # Página principal del menú
├── map.html               # Aplicación del mapa interactivo
├── manifest.json          # Manifest para PWA
├── service-worker.js      # Service Worker para funcionalidad offline
├── data/
│   └── dataUBV.json       # Datos de ubicaciones y coordenadas
├── assets/
│   └── icons/             # Iconos de la aplicación
├── scripts/
│   ├── menu.js            # Funcionalidad del menú principal
│   ├── app.js             # Punto de entrada de la aplicación del mapa
│   └── modules/           # Módulos JavaScript modulares
├── styles/
│   ├── menu.css           # Estilos del menú principal
│   └── main.css           # Estilos de la aplicación del mapa
└── README.md              # Este archivo
```

## 🚀 Instalación y Uso

*(Instrucciones de instalación y uso se agregarán durante el desarrollo)*

## 📝 Notas de Desarrollo

- Los archivos SVG de cada piso deben seguir el esquema de colores: blanco para áreas transitables, negro para paredes
- El sistema de rutas debe ser capaz de manejar múltiples pisos (navegación vertical)
- Se debe considerar la accesibilidad y usabilidad en diferentes dispositivos

## 🔄 Control de Versiones y Actualizaciones

### Actualizar la Versión de la Aplicación

Para forzar la actualización del caché en todos los dispositivos, sigue estos pasos:

1. **Actualizar la versión en `service-worker.js`**:
   ```javascript
   const APP_VERSION = '1.0.1'; // Cambiar a la nueva versión
   ```

2. **Actualizar el query string en `index.html`** (opcional, para forzar recarga de CSS):
   ```html
   <link rel="stylesheet" href="styles/main.css?v=1.0.1">
   ```

3. **Desplegar los cambios**: Al desplegar, el Service Worker detectará la nueva versión y actualizará automáticamente el caché.

### Funcionamiento del Service Worker

- **Offline First**: La app funciona completamente sin conexión a internet
- **Actualización Automática**: Verifica actualizaciones cada 5 minutos cuando hay conexión
- **Control de Versiones**: Cada cambio de versión fuerza la actualización del caché
- **Cache Inteligente**: Cachea todos los recursos necesarios (HTML, CSS, JS, SVG, imágenes)

## 👥 Desarrollo

Proyecto desarrollado para la **Universidad Bolivariana de Venezuela**.

## 🚀 Próximas Actualizaciones (Post-Prototipo)

Las siguientes funcionalidades están planificadas para futuras versiones del sistema:

### Información Detallada de Puntos de Interés
- Implementación de descripciones completas para cada punto de interés (POI)
- Información específica de salones, oficinas, laboratorios y áreas administrativas
- Detalles sobre horarios de atención, servicios disponibles y contactos

### Menú Principal Mejorado
- Sistema de navegación principal intuitivo
- Acceso rápido a funciones frecuentes
- Panel de configuración y personalización de la aplicación

### Galería Multimedia
- Incorporación de imágenes para puntos de interés importantes
- Visualización de fotografías de espacios destacados

### Expansión del Mapa
- Implementación de los 10 pisos completos más el sótano (11 pisos totales)
- Inclusión de edificios adicionales de la universidad
- Mapeo del área exterior de la universidad
- Conexión entre diferentes edificios y áreas externas

---

*Última actualización: Fase de prototipo (3 pisos)*
