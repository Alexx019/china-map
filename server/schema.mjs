import { z } from 'zod';

export const id = z.string().regex(/^[a-z0-9-]{1,40}$/);
const text = z.string().trim().min(1).max(10000);
const url = z.string().url().max(2048).refine(s => /^https?:\/\//.test(s));
export const practicalFields = ['how_to_get', 'payment', 'passport', 'rules', 'before_you_go', 'hours', 'closed_days',
  'booking', 'price_per_person', 'dishes', 'menu', 'tickets', 'duration', 'best_time', 'showtimes', 'best_spot'];
export const sourceSchema = z.object({ url, title: text, fields: z.array(z.enum(practicalFields)).max(30).optional() }).strict();
export const practicalSchema = z.object({
  ...Object.fromEntries(practicalFields.map(k => [k, text.nullable().optional()])),
  sources: z.array(sourceSchema).max(50), verified_at: z.iso.date(),
}).strict();
export const placeSchema = z.object({
  id, region: id, zone: id, category: z.enum(['ver', 'comer', 'comprar', 'noche', 'otro']),
  name: text, name_zh: text, city_zh: text, why: text, when: text,
  shot: z.enum(['raw', 'v360', 'both']), tip: text,
  photos: z.array(z.string().max(255)).max(30),
  lat: z.number().min(-85).max(85).nullable(), lng: z.number().min(-180).max(180).nullable(), amap_search: url,
  geo: z.object({ source: z.enum(['nominatim', 'manual']), checked: z.boolean(), osm_id: z.string().max(100).nullable().optional(), note: text.optional() }).strict().optional(),
  practical: practicalSchema.optional(),
  tips: z.array(z.object({ text, source: sourceSchema }).strict()).max(5).optional(),
}).strict();
export const placePatch = placeSchema.omit({ id: true }).partial().extend({
  practical: practicalSchema.partial().nullable().optional(),
  geo: placeSchema.shape.geo.unwrap().partial().nullable().optional(),
}).strict();
export const regionSchema = z.object({ id, name: text, name_zh: text, lede: text, emoji: text.optional(), days: text.optional() }).strict();
export const zoneSchema = z.object({ id, region: id, name: text, name_zh: text, when: text, lede: text, plan: z.array(text).max(30).optional() }).strict();
export const revision = z.number().int().nonnegative().describe('Revisión devuelta por la última consulta; evita sobrescribir cambios de otra IA.');
