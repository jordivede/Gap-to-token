# Gap to Token - Plugin de Figma

Plugin de Figma que permite auditar y gestionar el valor GAP (itemSpacing) de Frames y AutoLayouts, vinculándolos automáticamente a tokens de diseño (variables de Figma).

## 🎯 Descripción

Este plugin te permite gestionar de forma eficiente los valores de espaciado (GAP) en tus diseños de Figma, asegurando que estén correctamente vinculados a tokens de diseño para mantener la consistencia en todo tu sistema de diseño.

## ✨ Funcionalidades

### 🔍 Auditoría de GAP
- **Detección automática**: Escanea automáticamente el GAP (itemSpacing) de Frames y AutoLayouts seleccionados
- **Información detallada**: Muestra el valor actual del GAP, el tipo de nodo, el modo de layout y el estado de tokenización
- **Detección de tokens**: Identifica si el GAP ya está vinculado a un token de diseño y muestra su nombre completo y valor

### 🔗 Vinculación de Tokens
- **Vincular a token existente**: Selecciona de una lista todos los tokens FLOAT disponibles en tu librería de variables
- **Crear nuevo token**: Crea nuevos tokens de diseño directamente desde el plugin
  - Selecciona la colección donde crear el token
  - Define el nombre del token
  - Establece el valor del GAP
  - El token se vincula automáticamente al GAP seleccionado

### 🔄 Gestión de Tokens
- **Revincular tokens**: Cambia fácilmente el token vinculado a un GAP existente
- **Visualización clara**: Muestra el path completo del token (colección/nombre) y su valor actual
- **Actualización en tiempo real**: La interfaz se actualiza automáticamente después de vincular o crear tokens

### 🎨 Interfaz Moderna
- **Tema oscuro**: Interfaz con diseño moderno y tema oscuro
- **Accesibilidad AAA**: Cumple con los estándares WCAG AAA para accesibilidad
- **Experiencia intuitiva**: Interfaz clara y fácil de usar

## 📋 Requisitos

- **Figma Desktop**: Las variables solo están disponibles en la versión de escritorio de Figma
- **Cuenta de Figma**: Con acceso a Variables (Design Tokens)
- **AutoLayout activo**: El plugin funciona con Frames que tengan AutoLayout habilitado

## 🚀 Instalación

1. Abre **Figma Desktop**
2. Ve a `Plugins > Development > Import plugin from manifest...`
3. Selecciona el archivo `manifest.json` de este proyecto
4. El plugin aparecerá en tu lista de plugins de desarrollo

## 📖 Uso

### Paso 1: Seleccionar un elemento
1. Selecciona un **Frame** o **AutoLayout** en tu diseño
2. Asegúrate de que el Frame tenga **AutoLayout activo**

### Paso 2: Abrir el plugin
1. Ve a `Plugins > Development > Gap to Token`
2. El plugin mostrará automáticamente la información del GAP seleccionado

### Paso 3: Gestionar el token

#### Si el GAP NO está tokenizado:
- **Opción A - Vincular a token existente**:
  1. Haz clic en "🔗 Vincula a una variable"
  2. Selecciona un token de la lista disponible
  3. Haz clic en "Vincular"
  
- **Opción B - Crear nuevo token**:
  1. Haz clic en "➕ Crea una variable"
  2. Selecciona la colección donde crear el token
  3. Ingresa el nombre del token
  4. Confirma el valor del GAP
  5. Haz clic en "Crear y Vincular"

#### Si el GAP YA está tokenizado:
- **Ver información**: El plugin muestra el token vinculado, su path completo y su valor
- **Cambiar token**: Haz clic en "Revincular" para cambiar el token vinculado

## 🏗️ Estructura del Proyecto

```
Gap-to-token/
├── code.js          # Lógica principal del plugin (JavaScript)
├── ui.html          # Interfaz de usuario del plugin
├── manifest.json    # Configuración del plugin
├── package.json     # Configuración del proyecto
└── README.md        # Documentación
```

## 🛠️ Desarrollo

Este plugin está escrito en **JavaScript puro**, sin dependencias de TypeScript.

### Para desarrollar:

1. Edita `code.js` para modificar la lógica del plugin
2. Edita `ui.html` para modificar la interfaz
3. Recarga el plugin en Figma para ver los cambios:
   - Ve a `Plugins > Development > Gap to Token`
   - O usa `Cmd/Ctrl + /` y busca el plugin

### Características técnicas:

- **API de Variables de Figma**: Utiliza `figma.variables` para gestionar tokens
- **Modo incremental**: Compatible con el modo incremental de Figma
- **Gestión de modos**: Soporta variables con múltiples modos
- **Asíncrono**: Todas las operaciones de API son asíncronas

## 📝 Notas Importantes

- ⚠️ El plugin solo funciona en **Figma Desktop** (no en FigJam, Slides o Buzz)
- ⚠️ Las variables de Figma deben estar habilitadas en tu cuenta
- ⚠️ Los tokens se crean automáticamente si no existen con el nombre especificado
- ⚠️ El plugin solo gestiona valores de tipo **FLOAT** para espaciado
- ⚠️ El valor del token se establece en el modo activo de la colección

## 🎯 Casos de Uso

### Diseño de Sistemas
- Mantén la consistencia de espaciado en todo tu sistema de diseño
- Gestiona tokens de espaciado de forma centralizada
- Facilita la actualización masiva de espaciados

### Trabajo en Equipo
- Asegura que todos los diseñadores usen los mismos tokens
- Facilita la documentación de espaciados
- Mejora la comunicación entre diseño y desarrollo

### Migración de Diseños
- Tokeniza rápidamente diseños existentes
- Identifica GAPs que no están tokenizados
- Facilita la migración a un sistema de tokens

## 🤝 Contribuir

Las contribuciones son bienvenidas. Por favor:

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 📄 Licencia

Este proyecto está bajo la licencia MIT.

## 🔗 Enlaces

- **Repositorio GitHub**: [https://github.com/jordivede/Gap-to-token](https://github.com/jordivede/Gap-to-token)
- **Documentación de Figma Variables**: [Figma API - Variables](https://www.figma.com/plugin-docs/api/properties/figma-variables/)

## 👤 Autor

**Jordi Vede**

---

⭐ Si este plugin te resulta útil, considera darle una estrella en GitHub!
