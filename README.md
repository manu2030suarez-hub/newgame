# Survival Playa — versión web (v49)

Esta edición está preparada para ejecutarse en un navegador web y publicarse como sitio estático (por ejemplo, GitHub Pages) o servirse desde XAMPP/htdocs.

## Cómo jugar en tu computadora

1. Descarga o descomprime todos los archivos del proyecto en una misma carpeta.
2. Abre una terminal dentro de esa carpeta y ejecuta:

   ```bash
   python3 -m http.server 8000
   ```

3. Abre `http://localhost:8000` en Chrome, Edge, Firefox o Safari.

No abras `index.html` haciendo doble clic: el juego carga módulos JavaScript y modelos GLB, por lo que necesita servirse mediante HTTP/HTTPS.

## Publicar en GitHub Pages

1. Sube **todo el contenido de esta carpeta** al directorio raíz del repositorio, conservando juntos `index.html`, los archivos `.js` y los modelos `.glb`.
2. En GitHub, entra en **Settings → Pages**.
3. En **Build and deployment**, elige **Deploy from a branch**.
4. Selecciona la rama principal (`main`) y la carpeta raíz (`/root`), y guarda.
5. Espera a que GitHub Pages publique el sitio y abre la URL que indique esa sección.

## Importante

- Mantén los nombres de archivos exactamente iguales (incluidas mayúsculas y minúsculas); los servidores web distinguen entre ellas.
- Se necesita conexión a Internet para descargar Three.js y sus módulos desde jsDelivr.
- El barco del naufragio y los demás modelos 3D están incluidos en el proyecto.
- Esta carpeta no contiene instaladores ni lanzadores exclusivos de macOS: se inicia desde un servidor web.
- El archivo `.nojekyll` evita que GitHub Pages omita recursos cuyo nombre comience con punto.

## Versión

v49 — conserva los sistemas y recursos de la versión de escritorio v49; se retiraron únicamente los archivos auxiliares de lanzamiento específicos de macOS y documentación antigua de instalación local.
