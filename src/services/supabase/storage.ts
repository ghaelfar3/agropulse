import { File } from 'expo-file-system';
import { supabase } from './client';

export const AVATARS_BUCKET = 'avatars';
export const POST_MEDIA_BUCKET = 'post-media';

/** Что реально принимают бакеты (настроено на стороне Supabase). */
export const AVATAR_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const POST_MEDIA_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'video/mp4',
  'video/quicktime',
] as const;

export const AVATAR_MAX_BYTES = 5 * 1024 * 1024;
export const POST_MEDIA_MAX_BYTES = 100 * 1024 * 1024;

export type AvatarMimeType = (typeof AVATAR_MIME_TYPES)[number];
export type PostMediaMimeType = (typeof POST_MEDIA_MIME_TYPES)[number];

const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
};

/**
 * Оба бакета требуют, чтобы путь начинался с ID пользователя — на этом держится
 * их RLS. Поэтому userId здесь обязателен, а не «удобно бы».
 */

export async function uploadAvatar(
  userId: string,
  fileUri: string,
  contentType: AvatarMimeType,
): Promise<string> {
  // Новый путь предотвращает показ старого фото из кеша.
  const path = `${userId}/${randomFileName()}.${EXTENSIONS[contentType]}`;
  const body = await readFile(fileUri);
  if (body.byteLength > AVATAR_MAX_BYTES) throw new Error('Фото должно быть меньше 5 МБ.');

  const { data, error } = await supabase.storage
    .from(AVATARS_BUCKET)
    .upload(path, body, { contentType, upsert: true });
  if (error) throw error;

  return data.path;
}

/** Бакет публичный — URL строится локально, без запроса. */
export function getAvatarUrl(path: string): string {
  return supabase.storage.from(AVATARS_BUCKET).getPublicUrl(path).data.publicUrl;
}

export async function uploadPostMedia(
  userId: string,
  fileUri: string,
  contentType: PostMediaMimeType,
): Promise<string> {
  const path = `${userId}/${randomFileName()}.${EXTENSIONS[contentType]}`;
  const body = await readFile(fileUri);

  const { data, error } = await supabase.storage
    .from(POST_MEDIA_BUCKET)
    .upload(path, body, { contentType });
  if (error) throw error;

  return data.path;
}

/** Бакет приватный — на каждый показ нужна временная ссылка. */
export async function getPostMediaUrl(path: string, expiresInSeconds = 600): Promise<string> {
  const { data, error } = await supabase.storage
    .from(POST_MEDIA_BUCKET)
    .createSignedUrl(path, expiresInSeconds);
  if (error) throw error;
  return data.signedUrl;
}

/** Для ленты: одна ссылка на файл — это N запросов, поэтому пачкой. */
export async function getPostMediaUrls(
  paths: string[],
  expiresInSeconds = 600,
): Promise<Record<string, string>> {
  if (paths.length === 0) return {};

  const { data, error } = await supabase.storage
    .from(POST_MEDIA_BUCKET)
    .createSignedUrls(paths, expiresInSeconds);
  if (error) throw error;

  const result: Record<string, string> = {};
  for (const item of data) {
    if (item.signedUrl && item.path) result[item.path] = item.signedUrl;
  }
  return result;
}

/**
 * В React Native у файла есть только URI — читаем его в ArrayBuffer.
 * Передавать в SDK сам URI или Blob нельзя: загрузится файл нулевого размера.
 */
async function readFile(fileUri: string): Promise<ArrayBuffer> {
  if (!/^https?:/.test(fileUri)) return new File(fileUri).arrayBuffer();
  const response = await fetch(fileUri);
  return await response.arrayBuffer();
}

// crypto.randomUUID в Hermes нет, а тащить expo-crypto ради имени файла незачем:
// путь и так изолирован папкой пользователя.
function randomFileName(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
