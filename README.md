# Gap to Token - Plugin de Figma

Plugin de Figma que permite escanear el gap de frames y autolayouts seleccionados y vincularlos automáticamente a tokens de diseño (variables).

## Descripción

Este plugin te permite:
- Escanear gaps de AutoLayout (itemSpacing, counterAxisSpacing)
- Escanear valores de padding
- Vincular gaps a tokens de diseño (variables de Figma)
- Crear nuevos tokens automáticamente si no existen

## Instalación

1. Abre Figma Desktop
2. Ve a `Plugins > Development > Import plugin from manifest...`
3. Selecciona el archivo `manifest.json` de este proyecto

## Uso

1. Selecciona un Frame o AutoLayout en tu diseño
2. Abre el plugin "Gap to Token"
3. El plugin mostrará automáticamente todos los gaps detectados
4. Ingresa un nombre para el token (ej: `spacing-md`, `gap-16`)
5. Haz clic en "Vincular a Token" para vincular el gap deseado

## Requisitos

- Figma Desktop (las variables solo están disponibles en la versión de escritorio)
- Una cuenta de Figma con acceso a Variables (Design Tokens)

## Estructura del Proyecto

- `code.js` - Código principal del plugin (JavaScript)
- `ui.html` - Interfaz de usuario del plugin
- `manifest.json` - Configuración del plugin

## Desarrollo

Este plugin está escrito en JavaScript puro, sin dependencias de TypeScript.

Para desarrollar:
1. Edita `code.js` para modificar la lógica del plugin
2. Edita `ui.html` para modificar la interfaz
3. Recarga el plugin en Figma para ver los cambios

## Notas

- El plugin solo funciona en Figma (no en FigJam, Slides o Buzz)
- Las variables de Figma deben estar habilitadas en tu cuenta
- Los tokens se crean automáticamente si no existen con el nombre especificado
