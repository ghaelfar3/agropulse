import { dictionaries, storage, supabase } from '@/services/supabase';
import type { PostMediaMimeType } from '@/services/supabase/storage';
import type { TablesInsert } from '@/types/database.types';

/**
 * Лента постов. Запрос повторяет структуру из документации бэкенда:
 * один select с join'ами вместо N дополнительных запросов на экран.
 */
/**
 * `!inner` ставится только когда по этой связи реально фильтруем: в PostgREST
 * условие на вложенную таблицу без inner-join не отсекает родительские строки,
 * а лишь обнуляет вложенный объект — лента бы вернула «все посты», где у части
 * post_types === null.
 */
const feedSelect = (innerPostType: boolean) => `
  id,
  title,
  body,
  created_at,
  field_id,
  profiles!posts_author_id_fkey (
    id,
    name,
    specialization,
    region,
    avatar_path,
    reputation
  ),
  crops (
    id,
    slug,
    name
  ),
  post_types${innerPostType ? '!inner' : ''} (
    code,
    name
  ),
  post_stages (
    code,
    name
  ),
  post_statuses (
    code,
    name
  ),
  post_media (
    id,
    media_type,
    storage_path,
    sort_order
  ),
  post_reactions (
    reaction_type_id,
    user_id
  ),
  answers (
    count
  )
`;

export type FeedPost = {
  id: string;
  title: string | null;
  body: string | null;
  created_at: string;
  field_id: string | null;
  profiles: {
    id: string;
    name: string | null;
    specialization: string | null;
    region: string | null;
    avatar_path: string | null;
    reputation: number;
  } | null;
  crops: { id: number; slug: string; name: string } | null;
  post_types: { code: string; name: string } | null;
  post_stages: { code: string; name: string } | null;
  post_statuses: { code: string; name: string } | null;
  post_media: {
    id: string;
    media_type: string;
    storage_path: string;
    sort_order: number;
  }[];
  /** Сырые строки реакций — сводку по типам строит слой reactions. */
  post_reactions: { reaction_type_id: number; user_id: string }[];
  /** PostgREST отдаёт агрегат вложенной таблицы как `[{ count }]`. */
  answers: { count: number }[];
};

export type FeedFilter = {
  /** crops.id — целое число, а не uuid. */
  cropId?: number;
  fieldId?: string;
  /** `code` из справочника post_types, например 'question'. */
  postTypeCode?: string;
  /** Только посты этого автора — для вкладки «Мои посты» / чужого профиля. */
  authorId?: string;
  likedBy?: string;
  limit?: number;
  /**
   * Keyset-курсор для бесконечной ленты: последний показанный пост. Сортировка
   * `created_at desc, id desc` (created_at не уникален), поэтому нужна и дата,
   * и id — иначе посты с одинаковой секундой на границе страницы теряются.
   */
  before?: { createdAt: string; id: string };
};

export async function getFeed(filter: FeedFilter = {}): Promise<FeedPost[]> {
  let query = supabase
    .from('posts')
    .select(feedSelect(Boolean(filter.postTypeCode)) + (filter.likedBy ? ', liked:post_reactions!inner(user_id)' : ''))
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(filter.limit ?? 20);

  if (filter.likedBy) query = query.eq('liked.user_id', filter.likedBy).neq('author_id', filter.likedBy);
  if (filter.cropId) query = query.eq('crop_id', filter.cropId);
  if (filter.fieldId) query = query.eq('field_id', filter.fieldId);
  if (filter.authorId) query = query.eq('author_id', filter.authorId);
  if (filter.postTypeCode) query = query.eq('post_types.code', filter.postTypeCode);
  if (filter.before) {
    const { createdAt, id } = filter.before;
    query = query.or(
      `created_at.lt.${createdAt},and(created_at.eq.${createdAt},id.lt.${id})`,
    );
  }

  const { data, error } = await query;
  if (error) throw error;
  return data as unknown as FeedPost[];
}

export async function getPost(id: string): Promise<FeedPost | null> {
  const { data, error } = await supabase
    .from('posts')
    .select(feedSelect(false))
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data as unknown as FeedPost | null;
}

export type NewPost = Omit<TablesInsert<'posts'>, 'author_id'>;

/** RLS требует author_id = auth.uid(); если задан field_id — поле должно быть своим. */
export async function createPost(authorId: string, post: NewPost) {
  const { data, error } = await supabase
    .from('posts')
    .insert({ ...post, author_id: authorId })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deletePost(id: string): Promise<void> {
  const { error } = await supabase.from('posts').delete().eq('id', id);
  if (error) throw error;
}

/**
 * Частичный апдейт поста (RLS: только владелец). `updated_at` бампаем явно —
 * триггера на бэке для этого нет.
 */
export async function updatePost(
  id: string,
  patch: {
    title?: string | null;
    body?: string | null;
    postTypeId?: number;
    stageId?: number | null;
    statusId?: number | null;
    cropId?: number | null;
    fieldId?: string | null;
  },
) {
  const { data, error } = await supabase
    .from('posts')
    .update({
      ...(patch.title !== undefined ? { title: patch.title } : {}),
      ...(patch.body !== undefined ? { body: patch.body } : {}),
      ...(patch.postTypeId !== undefined ? { post_type_id: patch.postTypeId } : {}),
      ...(patch.stageId !== undefined ? { stage_id: patch.stageId } : {}),
      ...(patch.statusId !== undefined ? { status_id: patch.statusId } : {}),
      ...(patch.cropId !== undefined ? { crop_id: patch.cropId } : {}),
      ...(patch.fieldId !== undefined ? { field_id: patch.fieldId } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export type UpdatePostMedia = {
  /** Новые локальные фото для загрузки. */
  newPhotos: NewPostPhoto[];
  /** id строк `post_media`, которые нужно оставить; остальные — удалить. */
  keepMediaIds: string[];
};

/**
 * Редактирование поста вместе с медиа. Не атомарно: сначала апдейт полей, затем
 * дифф медиа (удаляем лишние строки `post_media` и файлы в Storage, грузим
 * новые). При ошибке экран показывает текст и перечитывает пост с сервера.
 */
export async function updatePostWithMedia(
  postId: string,
  userId: string,
  input: CreatePostInput,
  media: UpdatePostMedia,
): Promise<void> {
  const [types, stages, statuses] = await Promise.all([
    dictionaries.getPostTypes(),
    dictionaries.getPostStages(),
    dictionaries.getPostStatuses(),
  ]);
  const type = types.find((t) => t.code === input.postTypeCode);
  if (!type) throw new Error('Неизвестный тип поста');
  const stage = input.stageCode
    ? stages.find((item) => item.code === input.stageCode)
    : null;
  const status = input.statusCode
    ? statuses.find((item) => item.code === input.statusCode)
    : null;
  if (input.stageCode && !stage) throw new Error('Неизвестный этап поля');
  if (input.statusCode && !status) throw new Error('Неизвестный статус поста');

  await updatePost(postId, {
    title: input.title?.trim() || null,
    body: input.body?.trim() || null,
    postTypeId: type.id,
    stageId: stage?.id ?? null,
    statusId: status?.id ?? null,
    cropId: input.cropId ?? null,
    fieldId: input.fieldId ?? null,
  });

  const { data: current, error: readError } = await supabase
    .from('post_media')
    .select('id, storage_path, sort_order')
    .eq('post_id', postId)
    .order('sort_order', { ascending: true });
  if (readError) throw readError;
  const rowsNow = current ?? [];

  const keep = new Set(media.keepMediaIds);
  const toRemove = rowsNow.filter((row) => !keep.has(row.id));
  if (toRemove.length > 0) {
    const { error: delError } = await supabase
      .from('post_media')
      .delete()
      .in(
        'id',
        toRemove.map((row) => row.id),
      );
    if (delError) throw delError;
    await supabase.storage
      .from(storage.POST_MEDIA_BUCKET)
      .remove(toRemove.map((row) => row.storage_path));
  }

  if (media.newPhotos.length > 0) {
    const baseOrder =
      rowsNow.reduce((max, row) => Math.max(max, row.sort_order), -1) + 1;
    const rows: TablesInsert<'post_media'>[] = [];
    for (let i = 0; i < media.newPhotos.length; i += 1) {
      const contentType = resolvePostMediaMime(media.newPhotos[i].mimeType);
      const storagePath = await storage.uploadPostMedia(
        userId,
        media.newPhotos[i].uri,
        contentType,
      );
      rows.push({
        post_id: postId,
        media_type: contentType.startsWith('video') ? 'video' : 'image',
        storage_path: storagePath,
        sort_order: baseOrder + i,
      });
    }
    const { error: insError } = await supabase.from('post_media').insert(rows);
    if (insError) throw insError;
  }
}

export type NewPostPhoto = { uri: string; mimeType: string };

export type CreatePostInput = {
  /** `code` из справочника post_types: 'field_update' | 'question'. */
  postTypeCode: string;
  /** `code` из справочника post_stages: 'problem' делает вопрос SOS-кандидатом. */
  stageCode?: string | null;
  /** `code` из справочника post_statuses: 'open' — активный вопрос. */
  statusCode?: string | null;
  /** crops.id — необязательная культура поста. */
  cropId?: number | null;
  title?: string | null;
  body?: string | null;
  /** id строки `fields`; `null`/не задано — пост без привязки. */
  fieldId?: string | null;
};

/** Приводим MIME из пикера к тому, что принимает бакет `post-media`. */
function resolvePostMediaMime(mime?: string): PostMediaMimeType {
  const value = (mime ?? 'image/jpeg') as PostMediaMimeType;
  if (!storage.POST_MEDIA_MIME_TYPES.includes(value)) {
    throw new Error('Формат файла не поддерживается');
  }
  return value;
}

/**
 * Создать пост вместе с медиа. Операция НЕ атомарна: сначала создаём пост,
 * потом грузим файлы и пишем `post_media`. Если медиа-часть падает — откатываем
 * пост (`deletePost`), чтобы не осталось «пустого» поста без обещанных фото.
 * Возвращает id созданного поста.
 */
export async function createPostWithMedia(
  authorId: string,
  input: CreatePostInput,
  photos: NewPostPhoto[],
): Promise<string> {
  const [types, stages, statuses] = await Promise.all([
    dictionaries.getPostTypes(),
    dictionaries.getPostStages(),
    dictionaries.getPostStatuses(),
  ]);
  const type = types.find((t) => t.code === input.postTypeCode);
  if (!type) throw new Error('Неизвестный тип поста');
  const stage = input.stageCode
    ? stages.find((item) => item.code === input.stageCode)
    : null;
  const status = input.statusCode
    ? statuses.find((item) => item.code === input.statusCode)
    : null;
  if (input.stageCode && !stage) throw new Error('Неизвестный этап поля');
  if (input.statusCode && !status) throw new Error('Неизвестный статус поста');

  const post = await createPost(authorId, {
    post_type_id: type.id,
    stage_id: stage?.id ?? null,
    status_id: status?.id ?? null,
    crop_id: input.cropId ?? null,
    title: input.title?.trim() || null,
    body: input.body?.trim() || null,
    field_id: input.fieldId ?? null,
  });

  if (photos.length === 0) return post.id;

  try {
    const rows: TablesInsert<'post_media'>[] = [];
    for (let i = 0; i < photos.length; i += 1) {
      const contentType = resolvePostMediaMime(photos[i].mimeType);
      const storagePath = await storage.uploadPostMedia(
        authorId,
        photos[i].uri,
        contentType,
      );
      rows.push({
        post_id: post.id,
        media_type: contentType.startsWith('video') ? 'video' : 'image',
        storage_path: storagePath,
        sort_order: i,
      });
    }
    const { error } = await supabase.from('post_media').insert(rows);
    if (error) throw error;
  } catch (cause) {
    await deletePost(post.id).catch(() => {});
    throw cause;
  }

  return post.id;
}
