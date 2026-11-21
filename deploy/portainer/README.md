# Portainer desde Git + Cloudflare Tunnel

**MCP para editar puntos y fotos en producción:** [activación y uso](MCP.md).

Esta alternativa usa el mismo flujo que [Keppler](https://github.com/Alexx019/Keppler):
Portainer clona el repositorio, construye las imágenes y levanta el stack. No requiere
clonar el repo por SSH, instalar Node en el servidor ni copiar archivos al host.
El despliegue de Raspberry de `deploy/README.md` sigue disponible por separado.

## Primera instalación

Requisitos: Portainer sobre **Docker Standalone**, servidor Linux amd64 o arm64,
puerto 9012 libre y salida a Internet hacia los registros Docker y Protomaps.
No funciona con Docker Swarm (el stack necesita `build` y dependencias de Compose).

La web, el mapa y la API no requieren contraseña. Cualquier visitante puede ver
y modificar los estados y rutas compartidos, salvo que se proteja el acceso con
Cloudflare Access.

1. En **Stacks → Add stack → Repository**:

   | Campo | Valor |
   | --- | --- |
   | Name | `china-map` |
   | Repository URL | `https://github.com/josanchdev/china-map` |
   | Repository reference | `refs/heads/feat/portainer-git-cloudflare` |
   | Compose path | `docker-compose.yml` |

   Si se despliega desde un fork, usar la URL de ese fork. No es necesario fusionar
   la PR: se puede desplegar directamente la rama. Para usar `main` tras la fusión,
   cambiar la referencia del stack a `refs/heads/main`.

2. En **Environment variables** añadir:

   | Variable | Valor |
   | --- | --- |
   | `WEB_PORT` | `9012` (u otro puerto libre) |

   `WEB_BIND_IP` es opcional (por defecto `0.0.0.0`). Se puede limitar a la IP LAN
   del servidor si `cloudflared` puede alcanzarla. `MAP_BUILD` es opcional:
   fecha `AAAAMMDD` de un build disponible, para fijar la extracción inicial.
   No hacen falta `BASIC_USER` ni `BASIC_HASH`; se pueden eliminar de los stacks
   creados con la versión anterior.

3. Pulsar **Deploy the stack**. La primera compilación y extracción del mapa
   pueden tardar varios minutos. `map-init` consulta los builds de Protomaps y
   extrae las regiones del viaje a un volumen. La web espera a que termine
   correctamente y a que la API responda. Un `map-init` finalizado con código 0
   es normal; no es un servicio que deba permanecer en ejecución.

## Conectar tu cloudflared existente (red predeterminada bridge)

En el túnel de Cloudflare, añadir una **Published application route**:

| Campo | Valor |
| --- | --- |
| Subdomain | `china` |
| Domain | Tu dominio |
| Type | `HTTP` |
| URL | `IP-LAN-DEL-SERVIDOR:9012` |

La URL pública será `https://china.TU-DOMINIO`. El tramo entre `cloudflared` y
Caddy es HTTP; Cloudflare proporciona el HTTPS público. La aplicación no exige
autenticación; el túnel por sí solo tampoco restringe el acceso.

En tu caso, `cloudflared` está en el bridge predeterminado: usar una IP del host
alcanzable desde ese contenedor, no `localhost` ni el nombre `web`. No hace falta
cambiar la red de `cloudflared`. Si el firewall filtra tráfico desde Docker hacia
el host, permitir ese acceso al puerto elegido. No necesitas abrirlo en el router.
El puerto sí queda accesible en las interfaces del host según `WEB_BIND_IP` y su
firewall; se recomienda usar la IP LAN o restringirlo a la red que lo necesite.

No aplicar una regla «Cache Everything» a este subdominio: `/api/*` no debe
cachearse. La configuración mantiene las cabeceras de caché de la aplicación.

## Cambiar código o datos y actualizar

1. Editar y hacer commit en la rama que sigue Portainer (también desde GitHub).
2. En el stack: **Pull and redeploy → Update**. Portainer descarga el código de
   esa referencia y construye los servicios definidos con `build`. No se necesita
   publicar imágenes en Docker Hub ni ejecutar el antiguo `scripts/deploy.sh`.
3. Comprobar los logs de compilación y que `web` y `api` vuelven a estar activos.

**Re-pull image** descarga imágenes de un registro; por sí solo no sustituye la
compilación del código. Las modificaciones del frontend invalidan la capa
`COPY . .` del build; `npm ci` conserva la caché mientras no cambie el lockfile.
La API incluye `places.json` en su imagen para validar los sitios nuevos tras el
redeploy. Los móviles descargan la nueva versión al abrir con conexión.

Opcionalmente activar **GitOps updates → polling** si tu edición de Portainer
lo ofrece: seguirá la rama elegida sin pulsar el botón. No se configura un webhook
ni se publica la administración de Portainer. Confirmar primero un redeploy manual
con un cambio visible antes de activar actualizaciones automáticas.

## Persistencia, errores y vuelta atrás

- `api_data` conserva SQLite, con los estados y rutas compartidos. Mantener el
  nombre del stack y sus volúmenes al actualizar; no usar `down -v`.
- `map_data` conserva `trip.pmtiles` y `coverage.json`. Los siguientes despliegues
  reutilizan el mapa sin descargarlo si la cobertura no ha cambiado. Al actualizar
  `scripts/trip-region.geojson` o `scripts/map-context.geojson`, el inicializador detecta el cambio y prepara el
  mapa nuevo antes de arrancar la web. Los volúmenes antiguos sin metadatos se
  migran automáticamente. Cambiar solo `MAP_BUILD` no reemplaza un mapa preparado.
- El archivo combina un fondo regional amplio (zoom 0–10) con el detalle continuo
  del viaje (zoom 11–14), unos 375 MB según el build. Los niveles no se solapan.
  La cámara se limita dentro de la zona detallada, más pequeña que el fondo cargado.
  Al alejar al mínimo, Shenzhen y Hong Kong quedan centradas en el área visible.
  Los bordes muestran resistencia y el mapa cede unos píxeles al arrastrar hacia fuera.
  El panel se superpone al mapa a pantalla completa y puede bajarse hasta el tirador.
  Si la extracción falla, se conserva el mapa anterior y
  el despliegue espera a que se pueda completar el nuevo.
- La caché del móvil también está versionada. Tras esta actualización, pulsar
  «Guardar en el móvil» con wifi para guardar el mapa ampliado (unos 400 MB con
  fotos). El recorte antiguo se elimina de la caché solo tras completar el nuevo.
- Si falla la primera extracción, revisar los logs de `map-init` y redeployar;
  se eliminan los archivos parciales y se vuelve a intentar. La web no arranca
  con un mapa a medio descargar. Si el volumen contiene un mapa corrupto con
  cabecera aparentemente válida, será necesario quitar ese archivo y reintentar.
- Para regenerar el mapa, parar la web y eliminar **solo** el volumen `map_data`
  del stack, después recrear el stack con el mismo nombre y `api_data` existente.
  No eliminar `api_data`. Los mapas ya guardados sin conexión en los móviles
  deben borrarse y descargarse de nuevo si se sustituye el archivo.
- Para volver atrás en código, revertir el commit en la rama seguida y ejecutar
  Pull and redeploy. No cambia el contenido de los volúmenes.
- Para respaldar SQLite, parar la API y copiar el contenido completo de su
  volumen, incluidos posibles archivos `-wal` y `-shm`; volver a arrancarla.
  Copiar solo el `.db` mientras está escribiendo no es una copia consistente.

## Comprobaciones

Abrir el subdominio por HTTPS. Confirmar:

- `/api/health` responde y una marca se sincroniza entre dos dispositivos.
- El mapa, glifos y fotos aparecen.
- Una petición con `Range: bytes=0-126` a `/map/trip.pmtiles` devuelve `206`
  y `Content-Range` (se puede comprobar en las herramientas de red del navegador).
- La web, la API y el mapa funcionan sin solicitar credenciales.
- Instalar la PWA, guardar una región y probar en modo avión.
- Editar un texto en la rama y redeployar: aparece el cambio y se conservan las marcas.

Pruebas locales del código y la inicialización:

```sh
npm ci
npm test
node --test deploy/portainer/prepare-map.test.mjs
npm run build
```

Referencias: [despliegue Git en Portainer](https://docs.portainer.io/user/docker/stacks/add),
[Pull and redeploy](https://docs.portainer.io/user/docker/stacks/edit),
[CLI PMTiles](https://docs.protomaps.com/pmtiles/cli).
