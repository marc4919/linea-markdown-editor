# Línea

Un espacio local y tranquilo para escribir Markdown. Línea combina edición y vista previa, varios documentos en pestañas y recuperación automática sin necesitar una cuenta.

## Funciones

- Pestañas independientes que se restauran al recargar.
- Formato reversible: negrita, cursiva, enlaces, listas, citas y código.
- Selector de párrafo y cabeceras H1–H6.
- Atajos de teclado para formato, documentos y comandos.
- Apertura de uno o varios archivos con selector o arrastrando sobre la app.
- Confirmación antes de cerrar o reemplazar trabajo sin exportar.
- Exportación a Markdown y HTML.
- Esquema navegable de encabezados.
- Vista Editar, Dividir y Vista previa; comportamiento adaptado para móvil.
- Paleta de comandos con `⌘K` o `Ctrl+K`.
- Modo concentración y guía rápida.
- Guardado automático local con estado real de éxito o error.

## Ejecutar

Requiere Node.js 22.12 o superior.

```bash
npm install
npm run dev
```

## Comprobar

```bash
npm run check
```

El comando ejecuta las pruebas del motor de formato y del modelo de pestañas, seguido del build de producción.

## Privacidad

El contenido se guarda en el almacenamiento local del navegador. No se envía a servidores y la interfaz no carga tipografías ni recursos externos. “Guardado en Línea” significa que la sesión puede recuperarse; “Exportado” indica que existe una copia descargada por el usuario.
