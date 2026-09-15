import { z } from 'zod';

/**
 * Схема мастера создания / редактирования поста (все шаги в одном объекте).
 * Шаг валидирует только свои поля через `trigger(CREATE_STEP_FIELDS.x)`.
 *
 * `postTypeCode` — `code` из справочника `post_types`; бэк требует `post_type_id`,
 * дефолта нет, поэтому тип выбирается на первом шаге. `body` и `photos`
 * необязательны — бэку достаточно `title`.
 *
 * `photos` — union: `new` (только что выбранный локальный файл) и `existing`
 * (уже загруженная строка `post_media`, показываем по signed-URL). В режиме
 * создания массив содержит только `new`; редактирование добавляет `existing`.
 */
const newPhotoSchema = z.object({
  kind: z.literal('new'),
  uri: z.string(),
  mimeType: z.string(),
});

const existingPhotoSchema = z.object({
  kind: z.literal('existing'),
  /** id строки `post_media`. */
  id: z.string(),
  storagePath: z.string(),
  /** signed-URL для показа. */
  url: z.string(),
  mediaType: z.string(),
});

export const photoItemSchema = z.discriminatedUnion('kind', [
  newPhotoSchema,
  existingPhotoSchema,
]);

export type PhotoItem = z.infer<typeof photoItemSchema>;
export type NewPhotoItem = z.infer<typeof newPhotoSchema>;

export const createPostSchema = z.object({
  postTypeCode: z.enum(['field_update', 'question']),
  stageCode: z.enum(['sowing', 'sprouting', 'flowering', 'problem', 'harvest']),
  statusCode: z.enum(['open', 'solved', 'closed']),
  title: z.string().trim().max(140, 'Слишком длинный заголовок'),
  body: z.string().trim().max(4000, 'Слишком длинное описание'),
  photos: z.array(photoItemSchema),
  /** id строки `fields` — необязательная привязка поста к своему полю. */
  fieldId: z.string().nullable(),
  cropId: z.number().nullable(),
});

export type CreatePostFormValues = z.infer<typeof createPostSchema>;

export const createPostDefaults: CreatePostFormValues = {
  postTypeCode: 'field_update',
  stageCode: 'sowing',
  statusCode: 'open',
  title: '',
  body: '',
  photos: [],
  fieldId: null,
  cropId: null,
};

export const CREATE_STEP_FIELDS = {
  title: ['postTypeCode', 'stageCode', 'statusCode', 'title'],
} as const satisfies Record<string, readonly (keyof CreatePostFormValues)[]>;
