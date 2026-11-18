// Esquema de public/data/places.json. Lo valida scripts/check-data.mjs.

export type CategoryId = 'ver' | 'comer' | 'comprar' | 'noche' | 'otro';
export type ShotType = 'raw' | 'v360' | 'both';

/** Estado compartido entre los 4 (fase 4). Sin estado = no marcado. */
export type Status = 'queremos' | 'quiza' | 'visitado';

export interface Region {
  id: string;
  name: string;
  name_zh: string;
  lede: string;
  /** Heredado del mapa antiguo; la interfaz no lo usa. */
  emoji?: string;
  days?: string;
}

export interface Zone {
  id: string;
  region: string;
  name: string;
  name_zh: string;
  when: string;
  lede: string;
  /** Heredado de la versión anterior: no se usa (no es una web de planificación). */
  plan?: string[];
}

export interface Category {
  /** Heredado; la interfaz usa iconos SVG propios, nunca emojis. */
  em: string;
  hex: string;
  label: string;
}

/** De dónde salen las coordenadas. `checked` = revisadas a mano. */
export interface Geo {
  source: 'nominatim' | 'manual';
  osm_id?: string | null;
  checked: boolean;
  /** Qué punto es exactamente, si no es obvio (p. ej. «estación de metro del parque»). */
  note?: string;
}

/**
 * Información práctica (CLAUDE.md). Cada campo:
 * - ausente  → no aplica a este tipo de sitio (p. ej. `dishes` en un parque);
 * - `null`   → aplica pero no se ha encontrado: la ficha muestra «Por confirmar»;
 * - texto    → dato con fuente. Si las fuentes se contradicen, el texto empieza por «Por confirmar:».
 */
export interface PracticalFields {
  // Para todos
  how_to_get: string | null; // metro y salida
  payment: string | null; // Alipay, WeChat, efectivo, tarjeta extranjera
  passport: string | null; // si lo piden
  rules: string | null; // grabar, mochilas, etc.
  before_you_go: string | null; // p. ej. si hay que consumir para entrar
  hours: string | null;
  closed_days: string | null;
  booking: string | null; // si hay que reservar, dónde y con cuánta antelación
  // Restaurantes y cafés
  price_per_person: string | null;
  dishes: string | null; // platos recomendados
  menu: string | null; // carta en inglés o con fotos
  // Museos, atracciones, miradores, parques
  tickets: string | null; // precio de cada tipo de entrada
  duration: string | null; // duración típica de la visita
  best_time: string | null;
  // Espectáculos y eventos de luces
  showtimes: string | null; // días y horas de los pases
  best_spot: string | null; // mejor sitio para verlo
}

export type PracticalField = keyof PracticalFields;

export interface Source {
  url: string;
  title: string;
  /** Campos de `practical` que respalda esta fuente. */
  fields?: PracticalField[];
}

export interface Practical extends Partial<PracticalFields> {
  sources: Source[];
  /** AAAA-MM-DD */
  verified_at: string;
}

/** Consejo de gente que ha ido, resumido en español (nunca copiado literal). */
export interface Tip {
  text: string;
  source: Source;
}

export interface Place {
  id: string;
  region: string;
  zone: string;
  category: CategoryId;
  name: string;
  name_zh: string;
  city_zh: string;
  why: string;
  when: string;
  shot: ShotType;
  tip: string;
  photos: string[];
  /** WGS-84. `null` = sin geocodificar (mejor null que inventada). */
  lat: number | null;
  lng: number | null;
  amap_search: string;
  geo?: Geo;
  practical?: Practical;
  tips?: Tip[];
}

export interface TripData {
  generated: string;
  note?: string;
  regions: Region[];
  zones: Zone[];
  categories: Record<CategoryId, Category>;
  shot_types: Record<ShotType, string>;
  places: Place[];
}
