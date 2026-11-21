# MCP remoto del mapa

URL de conexión prevista: **https://china.ariassouto.es/mcp**.
Usa MCP Streamable HTTP y OAuth con PKCE (SDK oficial de Model Context Protocol).
No requiere otro subdominio: Caddy enruta el MCP, los metadatos OAuth y el catálogo
hacia la API en el mismo stack. No se ha desplegado automáticamente en tu servidor.

## Activarlo en Portainer

1. Publicar esta versión en la rama de tu fork que sigue el stack.
2. En tu ordenador, desde el repositorio, generar el hash de una contraseña
   **exclusiva para autorizar clientes MCP**. Solo requiere Node, sin reinstalar dependencias:

   ```powershell
   npm --prefix server run password
   ```

   La consola solicita la contraseña sin mostrarla y devuelve una línea
   `MCP_PASSWORD_HASH=scrypt:...`. El formato nuevo usa dos puntos para evitar
   que Portainer o Compose interpreten partes del hash como variables.
   No enviar la contraseña al chat ni guardarla en Git.
   Alternativa tras un primer despliegue: consola interactiva del contenedor `api`,
   ejecutar `node password.mjs`.

3. En las variables del stack de Portainer:

   | Variable | Valor |
   | --- | --- |
   | `MCP_PUBLIC_URL` | `https://china.ariassouto.es` (sin `/mcp`) |
   | `MCP_PASSWORD_HASH` | Solo el valor `scrypt:...` generado; sin comillas añadidas |

   Si no se configura el hash, el MCP permanece **desactivado** y devuelve 503.
   La web y el catálogo público siguen funcionando. Las contraseñas anteriores de
   Basic Auth no se usan. El hash anterior con `$` también se admite si llega intacto,
   pero para nuevas configuraciones se recomienda el formato con `:`.

4. Ejecutar **Pull and redeploy**. El servidor instala sus dependencias desde
   `server/package-lock.json`. No se cambian los volúmenes existentes.
5. En un cliente compatible con **MCP remoto + OAuth + registro dinámico de clientes**,
   añadir `https://china.ariassouto.es/mcp` y seguir su flujo de conexión.
   En la página de autorización comprobar el nombre del cliente y su destino,
   introducir la contraseña del propietario y autorizar. La contraseña no se entrega
   al cliente: este recibe un token con permisos de lectura o lectura y edición.

No todos los productos de IA permiten añadir MCP remotos o este flujo de OAuth.
La URL no convierte en compatible a un cliente que no soporte estas funciones.
No se configura un token compartido dentro de la URL.

## Permisos y herramientas

- `map:read`: consultar catálogo, puntos, fotos, exportación e historial.
- `map:write`: crear, editar y eliminar puntos, fotos, regiones y zonas.

| Herramienta | Función |
| --- | --- |
| `get_catalog_info` | IDs válidos, categorías, tipos de toma, permisos y revisión |
| `list_places` / `get_place` | Buscar y leer fichas completas |
| `create_place` / `update_place` / `delete_place` | Todos los campos del esquema original |
| `add_photo` | Importar HTTPS público o base64; normalizar y generar miniaturas |
| `remove_photo` / `list_photos` | Desvincular, consultar y reutilizar fotos |
| `create_region` / `update_region` / `delete_region` | Gestionar regiones |
| `create_zone` / `update_zone` / `delete_zone` | Gestionar zonas |
| `export_catalog` | Obtener JSON completo con los cambios de producción |
| `get_edit_history` | Ver el antes/después de las ediciones |

Las fichas admiten nombres en ambos idiomas, ciudad, descripción (`why`), momento
recomendado (`when`), categoría, coordenadas WGS-84, búsqueda Amap, tipo de toma,
consejo principal (`tip`), consejos con fuentes (`tips`), fotos, procedencia de
coordenadas y **todos** los campos prácticos de `src/data/types.ts`.
No hay campos nuevos de pie de foto o autoría porque la app original no los contempla.

Flujo recomendado para una IA:

1. `get_catalog_info`: leer región, zona y revisión actual.
2. `list_places`: comprobar que el lugar no exista ya.
3. `create_place` con todos los campos obligatorios y `photos: []`.
4. `add_photo` con el ID creado, una URL HTTPS accesible o bytes base64 y la revisión devuelta.
5. `update_place` para completar horarios, recomendaciones y fuentes.
6. `get_place` para comprobar el resultado.

Las modificaciones requieren `expected_revision`. Si otra IA cambia el catálogo,
el servidor devuelve `CONFLICT`; consultar de nuevo y reintentar con los datos
actualizados. `practical` y `geo` se combinan al editar, o se eliminan pasando `null`.
Las listas `photos` y `tips` se reemplazan completas. Los IDs son estables y no se renombran.

## Fotos

Se aceptan JPEG, PNG, WebP y AVIF (y HEIF si lo soporta Sharp en la plataforma),
máximo 12 MB de entrada. Las imágenes se rotan según su orientación, se convierten
a JPEG sin EXIF y se limitan a 4096 px. Se generan las miniaturas de 160 y 480 px
y el manifiesto de colores que ya utiliza la interfaz.

Las URLs deben usar HTTPS en el puerto 443, sin credenciales. Se bloquean IPs
privadas, loopback y reservadas, también en redirecciones. Las IPs se fijan durante
la conexión para evitar DNS rebinding. Se rechazan SVG y otros formatos activos.
Las descargas tienen límite de tiempo y tamaño.

Una IA necesita disponer de una URL pública de la foto o poder pasar sus bytes;
no puede leer por sí sola un archivo privado de tu ordenador a través de este MCP.
`remove_photo` desvincula la foto, pero conserva el archivo para recuperación.
Las fotos subidas no se sobrescriben y pueden reutilizarse en varias fichas.

## Guardado y actualizaciones

Los JSON y las fotos del repo siguen siendo la base inicial. Las ediciones se
guardan como cambios persistentes en SQLite, dentro de `api_data`, y prevalecen
sobre la ficha correspondiente del repo. Los sitios sin editar siguen recibiendo
los cambios de Git. Una eliminación guarda una marca para que un redeploy no
resucite el sitio. Las fotos nuevas viven en `api_data:/data/media`.

La API sirve `/data/places.json` y `/data/thumbs/photos.json` con el catálogo
fusionado. Caddy conserva las rutas originales, por lo que la interfaz y el modo
sin conexión siguen usando el mismo formato. La web comprueba revisiones cada
30 segundos mientras está visible y al recuperar el foco; no hace falta compilar
ni redeployar cada ficha. Para actualizar lo guardado sin conexión, volver a
«Guardar en el móvil» con Internet.

El historial guarda cliente, fecha y valores antes/después de cada edición. Las
fichas eliminadas pueden recuperarse creando de nuevo el mismo ID con su contenido
anterior. No se permite borrar zonas o regiones con dependencias ni puntos usados
en rutas activas. Añadir un punto fuera de la cobertura no descarga un mapa nuevo;
la cartografía del viaje y sus límites se gestionan por separado.

Respaldar **todo `api_data`**, con SQLite y `media`. Para una copia consistente,
parar la API y copiar el volumen completo, incluidos posibles `-wal` y `-shm`.
No eliminar el volumen al actualizar. `export_catalog` exporta los datos, no los
archivos de fotos ni las credenciales; conservar también el respaldo del volumen.

## Revocar conexiones

Los access tokens duran una hora. Los refresh tokens duran 30 días y rotan al
usarlos. Reutilizar un refresh token consumido revoca toda su familia de tokens.
OAuth expone `/revoke`; además, desde la consola del contenedor `api`:

```sh
node revoke-mcp.mjs --list
node revoke-mcp.mjs --client ID_DEL_CLIENTE
# O revocar todas las conexiones:
node revoke-mcp.mjs --all
```

Cambiar `MCP_PASSWORD_HASH` protege nuevas autorizaciones; para invalidar también
los tokens ya emitidos, usar la revocación. La página de autorización limita los
intentos y vincula cada consentimiento al navegador que lo inició.

## Comprobación de producción

1. `/api/health` debe incluir `mcp: true`.
2. `/.well-known/oauth-protected-resource/mcp` debe anunciar el host de producción.
3. Un POST sin token a `/mcp` debe responder 401 con `WWW-Authenticate`.
4. Completar OAuth en el cliente elegido, listar las herramientas y consultar un punto.
5. Crear una ficha de prueba y una foto; comprobar ambas en la web.
6. Redeployar conservando volúmenes y comprobar que siguen ahí.

No cachear `/mcp`, las rutas OAuth ni el catálogo dinámico con reglas «Cache Everything».
El Caddyfile ya envía las cabeceras de caché correspondientes.
Para clientes que se conectan directamente desde un navegador con Origin propio,
se puede configurar `MCP_ALLOWED_ORIGINS` con orígenes HTTPS explícitos separados
por comas. Los clientes de servidor sin cabecera Origin no necesitan esa variable.

Pruebas locales: `npm --prefix server test`. Incluyen el cliente oficial MCP,
OAuth/PKCE, permisos, fotos, persistencia, revisiones, revocación y rechazo de SSRF.
