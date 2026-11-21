# Despliegue en la Raspberry

La web se sirve con **Caddy** en Docker: HTTPS automático (Let's Encrypt), contraseña para toda la web
y cabeceras para que no la indexe nadie. Al lado corre la **API** de estados y rutas (`server/index.mjs`,
Node sin dependencias + SQLite en el volumen `api_data`), detrás de la misma contraseña en `/api`.

Copia de seguridad de los estados y rutas:
`docker compose exec api sh -c 'cat /data/china-map.db' > china-map-$(date +%F).db`

## Lo que hace falta de la Pi (pedir a Alex)

- [ ] Modelo de Raspberry y sistema de **64 bits** (`uname -m` → `aarch64`)
- [ ] **Docker** con el plugin `compose` (`docker compose version`)
- [ ] **Acceso SSH** desde fuera de casa (también desde China, para publicar durante el viaje)
- [ ] Un **dominio** o DDNS que apunte a la IP de casa
- [ ] **Puertos 80 y 443** del router redirigidos a la Pi (Caddy los necesita para el certificado)
- [ ] Comprobar que el dominio abre desde China (p. ej. con un comprobador de accesibilidad desde China)

Sin HTTPS no funciona el modo sin conexión: los navegadores solo permiten service workers con HTTPS.

## Primera vez

1. En la Pi, crear la carpeta y el `.env`:
   ```sh
   mkdir -p /srv/china-map && cd /srv/china-map
   # DOMAIN, BASIC_USER y BASIC_HASH (ver deploy/.env.example)
   docker run --rm caddy:2 caddy hash-password --plaintext 'la-contraseña'
   nano .env
   ```
2. En el portátil, copiar `deploy/deploy.env.example` como `deploy/deploy.env` y rellenar `PI_SSH` y `PI_DIR`.
3. Tener el mapa: `scripts/extract-tiles.sh <ruta-al-binario-pmtiles>` (unos 375 MB según el build, no está en git).
4. Publicar: `scripts/deploy.sh`.

## Después

- **Cambios en la app:** `scripts/deploy.sh`. Los móviles cogen la versión nueva solos al abrir la web.
- **Sitios nuevos o datos corregidos** (también desde China): `scripts/deploy.sh --data`. No recompila nada.

## En cada móvil, antes de salir (con wifi)

1. Abrir la web, poner la contraseña.
2. **Añadir a la pantalla de inicio**: en iPhone, Safari → Compartir → «Añadir a pantalla de inicio»;
   en Android, Chrome → menú → «Instalar aplicación».
3. Abrir la app instalada → en la hoja de la región, **«Guardar en el móvil»** (unos 400 MB).
4. Probar en modo avión: tiene que abrir con el mapa y las fotos.

## Por confirmar

- Que la contraseña (basic auth) funcione bien con la app instalada en iPhone. Si da problemas, se
  cambia por una página de contraseña con cookie de larga duración.
- No se ha podido validar el `Caddyfile` en el portátil (Docker no está activo en WSL). Se valida en la
  Pi con `docker compose exec caddy caddy validate --config /etc/caddy/Caddyfile`.
