# Diseño aprobado: «Cristal»

Maqueta de 7 pantallas de móvil (390×844), aprobada el 18 nov 2026. Es la referencia visual de la app.

- Lienzo interactivo (privado): https://claude.ai/artifact/SQ91Jbr7d8vKkwxfvCfFru
- Fuentes de cada pantalla (`.dc.html`) en esta carpeta; `canvas.json` es el índice del lienzo.

| Pantalla | Fichero |
|---|---|
| 1. Explorar (mapa, buscador, filtros, hoja inferior, pestañas) | `Main.dc.html` |
| 2. Ficha del sitio | `Ficha.dc.html` |
| 3. Ficha: información práctica (cabecera fija con Amap) | `FichaInfo.dc.html` |
| 4. Visor de fotos | `Visor.dc.html` |
| 5. Mood board de la zona | `MoodBoard.dc.html` |
| 6. Ruta hecha por el grupo | `Ruta.dc.html` |
| 7. Explorar en modo oscuro | `Oscuro.dc.html` (usa `Main` con `dark`) |

## Tokens

| Token | Claro | Oscuro |
|---|---|---|
| Tierra del mapa | `#ECEEF1` | `#14181F` |
| Agua | `#C6DAEA` | `#0D2232` |
| Parques | `#D6E5D4` | `#15261D` |
| Calles / borde | `#FFFFFF` / `#D8DCE2` | `#2A313C` / `#1A1F27` |
| Hoja y superficies | `#FFFFFF` | `#16181D` |
| Texto / secundario | `#111318` / `#5B6270` | `#F2F3F5` / `#9AA1AD` |
| Panel de cristal | `rgba(255,255,255,.80)` + `blur(20px) saturate(180%)` | `rgba(28,31,38,.78)` |
| Acento (Amap, Queremos ir, rutas) | `#D23A2A` | `#D23A2A` |

Categorías: ver y hacer `#2F8C6E`, comer `#B87719`, comprar `#3567C9`, de noche `#6550C8`, otro `#6F7682`.

Tipografía: **Geist** (autoalojada) y, para el chino, la fuente del sistema (PingFang SC / Noto Sans CJK).
Radios: hojas 28 px, paneles y botones en píldora, tarjetas 14–16 px. Toques mínimos de 44 px.

## Lo que en la maqueta es provisional

- El mapa está dibujado: en la app es OSM real con estos colores.
- Las fotos son degradados con los colores de cada foto, porque las reales son privadas y no se subieron al lienzo.
- La información práctica sale «Por confirmar» porque aún no estaba investigada.
