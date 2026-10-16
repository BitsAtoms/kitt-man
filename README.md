# KITT-MAN

Juego independiente extraído de `BitsAtoms/juego-coches-sr` (commit `ff6bfd7cbc901c3ce545511180687815a4e6de5d`).

## Ejecutar

Sirve esta carpeta con un servidor HTTP estático y abre `index.html`.
Por ejemplo, con Python instalado:

```sh
python -m http.server 8000
```

Abre http://localhost:8000. No necesita instalación de dependencias ni compilación.

## Comportamiento

La experiencia empieza automáticamente y mantiene la lógica de demostración del original.
Incluye únicamente este juego y sus recursos, sin selector de vehículos, conexión RFID,
pantalla de portada ni enlaces al expositor. Se conservan las cuentas atrás,
cinemáticas, marcadores y finales que forman parte del juego.

Los navegadores pueden bloquear el sonido automático hasta el primer clic o pulsación.
La tipografía se carga desde Google Fonts; sin conexión se usa la fuente alternativa.

El código y los recursos conservan la procedencia del repositorio original;
esta extracción no añade una licencia nueva.
