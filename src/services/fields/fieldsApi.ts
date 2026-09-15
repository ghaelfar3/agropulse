import { supabase } from '@/services/supabase';
import type { Json, TablesUpdate } from '@/types/database.types';

export type Coordinates = {
  latitude: number;
  longitude: number;
};

export type FieldCropSnapshot = {
  id: number;
  slug: string | null;
  name: string;
};

export type FieldStageSnapshot = {
  id: number;
  code: string;
  name: string;
};

/**
 * Доменное поле пользователя.
 *
 * `boundary` — внешнее кольцо полигона. Дырки (внутренние кольца) PostGIS
 * поддерживает, но приложение их не создаёт и при чтении отбрасывает: рисовать
 * их всё равно нечем.
 */
export type Field = {
  id: string;
  owner_id: string;
  name: string;
  region: string | null;
  currentCrop: FieldCropSnapshot | null;
  currentStageId: number | null;
  currentStage: FieldStageSnapshot | null;
  created_at: string;
  updated_at: string;
  center: Coordinates | null;
  boundary: Coordinates[] | null;
};

export type NewField = {
  name: string;
  region?: string | null;
  currentCrop?: FieldCropSnapshot | null;
  currentStageId?: number | null;
  center?: Coordinates | null;
  boundary?: Coordinates[] | null;
};

const SCALAR_COLUMNS =
  'id, owner_id, name, region, current_crop, current_stage_id, current_stage:post_stages(id, code, name), created_at, updated_at';

/**
 * Читаем геометрию через `Accept: application/geo+json` (метод `.geojson()`
 * у postgrest-js): PostgREST сам зовёт `st_asgeojson` и отдаёт
 * `FeatureCollection`, где геометрия лежит в `geometry`, а остальные колонки —
 * в `properties`. Поэтому обещанный бэкенд-командой view с `st_asgeojson`
 * больше не нужен.
 *
 * Запросов два, потому что в таблице две геометрические колонки, а какую из
 * них PostgREST положит в `geometry` при выборе обеих — не документировано.
 * RLS в обоих случаях вернёт только свои поля.
 */
export async function getFields(): Promise<Field[]> {
  const [centers, boundaries] = await Promise.all([
    supabase
      .from('fields')
      .select(`${SCALAR_COLUMNS}, center`)
      .order('created_at', { ascending: false })
      .geojson(),
    supabase.from('fields').select('id, boundary').geojson(),
  ]);

  if (centers.error) throw centers.error;
  if (boundaries.error) throw boundaries.error;

  const rings = new Map<string, Coordinates[]>();
  for (const feature of readFeatures(boundaries.data)) {
    const id = readId(feature.properties);
    const ring = readPolygon(feature.geometry);
    if (id && ring) rings.set(id, ring);
  }

  const fields: Field[] = [];
  for (const feature of readFeatures(centers.data)) {
    const field = readField(feature, rings);
    if (field) fields.push(field);
  }
  return fields;
}

export async function createField(ownerId: string, field: NewField): Promise<void> {
  const boundary = field.boundary ?? null;
  // Контур всегда приносит с собой центр: иначе у половины полей не будет
  // точки, к которой можно подлететь камерой или которую можно кластеризовать.
  const center = field.center ?? (boundary ? centroid(boundary) : null);

  const { error } = await supabase.from('fields').insert({
    // RLS требует owner_id = auth.uid(), сервер его не подставляет.
    owner_id: ownerId,
    name: field.name,
    region: field.region ?? null,
    current_crop: toJson(field.currentCrop ?? null),
    current_stage_id: field.currentStageId ?? null,
    center: center ? toEwktPoint(center) : null,
    boundary: boundary ? toEwktPolygon(boundary) : null,
  });
  if (error) throw error;
}

export type FieldPatch = {
  name?: string;
  region?: string | null;
  currentCrop?: FieldCropSnapshot | null;
  currentStageId?: number | null;
  center?: Coordinates | null;
  boundary?: Coordinates[] | null;
};

/**
 * Частичное обновление. Геометрию трогаем только если она названа в патче:
 * правка названия не должна затирать контур, а правка контура — название.
 * Как и при создании, новый контур приносит с собой пересчитанный центроид.
 */
export async function updateField(id: string, patch: FieldPatch): Promise<void> {
  const changes: TablesUpdate<'fields'> = {};
  if (patch.name !== undefined) changes.name = patch.name;
  if (patch.region !== undefined) changes.region = patch.region;
  if (patch.currentCrop !== undefined) changes.current_crop = toJson(patch.currentCrop);
  if (patch.currentStageId !== undefined) changes.current_stage_id = patch.currentStageId;

  if (patch.boundary !== undefined) {
    changes.boundary = patch.boundary ? toEwktPolygon(patch.boundary) : null;
    if (patch.center === undefined) {
      const derived = patch.boundary ? centroid(patch.boundary) : null;
      changes.center = derived ? toEwktPoint(derived) : null;
    }
  }
  if (patch.center !== undefined) {
    changes.center = patch.center ? toEwktPoint(patch.center) : null;
  }

  if (Object.keys(changes).length === 0) return;

  const { error } = await supabase.from('fields').update(changes).eq('id', id);
  if (error) throw error;
}

export async function deleteField(id: string): Promise<void> {
  const { error } = await supabase.from('fields').delete().eq('id', id);
  if (error) throw error;
}

// ─── Запись геометрии ────────────────────────────────────────────────────────

/**
 * EWKT, а не голый WKT: `SRID=4326;...` проходит и в колонку `geometry`, и в
 * `geometry(Point,4326)`, где WKT без SRID был бы отвергнут как SRID 0.
 * Порядок в PostGIS — сначала долгота.
 */
function toEwktPoint({ latitude, longitude }: Coordinates): string {
  return `SRID=4326;POINT(${longitude} ${latitude})`;
}

function toEwktPolygon(ring: Coordinates[]): string {
  const closed = closeRing(ring);
  const points = closed.map((p) => `${p.longitude} ${p.latitude}`).join(', ');
  return `SRID=4326;POLYGON((${points}))`;
}

/** PostGIS требует, чтобы кольцо полигона заканчивалось своей первой точкой. */
function closeRing(ring: Coordinates[]): Coordinates[] {
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (!first || !last) return ring;
  if (first.latitude === last.latitude && first.longitude === last.longitude) return ring;
  return [...ring, first];
}

/**
 * Центроид многоугольника (площадно-взвешенный, не среднее вершин: среднее
 * уехало бы в ту сторону, где вершины гуще). Для вырожденного контура с нулевой
 * площадью падаем обратно на среднее — оно там как раз корректно.
 */
export function centroid(ring: Coordinates[]): Coordinates | null {
  const points = closeRing(ring);
  if (points.length < 4) return average(ring);

  let doubleArea = 0;
  let x = 0;
  let y = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]!;
    const b = points[i + 1]!;
    const cross = a.longitude * b.latitude - b.longitude * a.latitude;
    doubleArea += cross;
    x += (a.longitude + b.longitude) * cross;
    y += (a.latitude + b.latitude) * cross;
  }

  if (doubleArea === 0) return average(ring);
  const factor = 1 / (3 * doubleArea);
  return { longitude: x * factor, latitude: y * factor };
}

function average(ring: Coordinates[]): Coordinates | null {
  if (ring.length === 0) return null;
  const sum = ring.reduce(
    (acc, point) => ({
      latitude: acc.latitude + point.latitude,
      longitude: acc.longitude + point.longitude,
    }),
    { latitude: 0, longitude: 0 },
  );
  return {
    latitude: sum.latitude / ring.length,
    longitude: sum.longitude / ring.length,
  };
}

// ─── Чтение GeoJSON ──────────────────────────────────────────────────────────

type GeoFeature = { geometry: unknown; properties: unknown };

/** Ответ PostgREST разбираем защитно: типов на `.geojson()` в SDK нет. */
function readFeatures(data: unknown): GeoFeature[] {
  if (typeof data !== 'object' || data === null) return [];
  const { features } = data as { features?: unknown };
  if (!Array.isArray(features)) return [];
  return features.flatMap((item) => {
    if (typeof item !== 'object' || item === null) return [];
    const { geometry, properties } = item as GeoFeature;
    return [{ geometry, properties }];
  });
}

function readField(feature: GeoFeature, rings: Map<string, Coordinates[]>): Field | null {
  const props = feature.properties;
  if (typeof props !== 'object' || props === null) return null;
  const row = props as Record<string, unknown>;

  const id = readId(props);
  const ownerId = row.owner_id;
  const name = row.name;
  const createdAt = row.created_at;
  const updatedAt = row.updated_at;
  if (
    !id ||
    typeof ownerId !== 'string' ||
    typeof name !== 'string' ||
    typeof createdAt !== 'string' ||
    typeof updatedAt !== 'string'
  ) {
    return null;
  }

  return {
    id,
    owner_id: ownerId,
    name,
    region: typeof row.region === 'string' ? row.region : null,
    currentCrop: readCropSnapshot(row.current_crop),
    currentStageId: typeof row.current_stage_id === 'number' ? row.current_stage_id : null,
    currentStage: readStageSnapshot(row.current_stage),
    created_at: createdAt,
    updated_at: updatedAt,
    center: readPoint(feature.geometry),
    boundary: rings.get(id) ?? null,
  };
}

function readId(properties: unknown): string | null {
  if (typeof properties !== 'object' || properties === null) return null;
  const { id } = properties as { id?: unknown };
  return typeof id === 'string' ? id : null;
}

function readPoint(geometry: unknown): Coordinates | null {
  if (typeof geometry !== 'object' || geometry === null) return null;
  const { type, coordinates } = geometry as { type?: unknown; coordinates?: unknown };
  if (type !== 'Point') return null;
  return toCoordinates(coordinates);
}

function readPolygon(geometry: unknown): Coordinates[] | null {
  if (typeof geometry !== 'object' || geometry === null) return null;
  const { type, coordinates } = geometry as { type?: unknown; coordinates?: unknown };
  if (type !== 'Polygon' || !Array.isArray(coordinates)) return null;

  // Берём только внешнее кольцо: внутренние приложение не рисует.
  const outer = coordinates[0];
  if (!Array.isArray(outer)) return null;

  const ring = outer.flatMap((pair) => {
    const point = toCoordinates(pair);
    return point ? [point] : [];
  });
  return ring.length >= 3 ? ring : null;
}

function toCoordinates(pair: unknown): Coordinates | null {
  if (!Array.isArray(pair)) return null;
  const [longitude, latitude] = pair;
  if (typeof longitude !== 'number' || typeof latitude !== 'number') return null;
  return { latitude, longitude };
}

function readCropSnapshot(value: unknown): FieldCropSnapshot | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if (typeof row.id !== 'number' || typeof row.name !== 'string') return null;
  return {
    id: row.id,
    slug: typeof row.slug === 'string' ? row.slug : null,
    name: row.name,
  };
}

function readStageSnapshot(value: unknown): FieldStageSnapshot | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if (
    typeof row.id !== 'number' ||
    typeof row.code !== 'string' ||
    typeof row.name !== 'string'
  ) {
    return null;
  }
  return { id: row.id, code: row.code, name: row.name };
}

function toJson(value: FieldCropSnapshot | null): Json {
  return value === null
    ? null
    : {
        id: value.id,
        slug: value.slug,
        name: value.name,
      };
}
