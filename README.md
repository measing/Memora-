# Memora+

Página institucional de estimulación cognitiva con ejercicios de memoria visual, asociación semántica, memoria temporal, secuencias y contenidos cotidianos.

## Archivos activos

- `index.html`: estructura principal de la experiencia.
- `style.css`: interfaz accesible y responsive.
- `main.js`: soporte de viewport, service worker e inicialización.
- `login.html`: página separada para ingresar, crear cuenta o continuar con Google.
- `account.js`: gestión local de cuentas y sesión.
- `firebase-config.js`: credenciales del proyecto Firebase.
- `firebase-service.js`: conexión con Firebase Authentication, Google y Firestore.
- `memora-plus.js`: lógica de ejercicios y métricas locales.
- `utils.js`: utilidades compartidas.
- `manifest.webmanifest`: configuración PWA.
- `service-worker.js`: caché básico de la página.

## Uso local

Abre `index.html` directamente o sirve la carpeta con un servidor local.

## Firebase

1. Copia la configuración web de Firebase en `firebase-config.js`.
2. Crea Firestore Database para guardar perfiles y progreso.
3. Activa Authentication con correo/contraseña y Google.
4. Autoriza `localhost` en Authentication > Settings > Authorized domains para probar en local.
