import AsyncStorage from '@react-native-async-storage/async-storage';
import { Directory, File, Paths } from 'expo-file-system';
import { createPostSchema, type CreatePostFormValues } from '@/features/create/schemas/createPostSchema';

export type LocalDraft = {
  id: string;
  updatedAt: string;
  values: CreatePostFormValues;
  audioUri: string | null;
  sos: boolean;
  mode: 'quick' | 'details';
};
const key = (userId: string) => `agropulse:drafts:v1:${userId}`;
const segment = (value: string) => encodeURIComponent(value);
const folder = (userId: string, id: string) => new Directory(Paths.document, 'agropulse-drafts', segment(userId), segment(id));
let writes: Promise<unknown> = Promise.resolve();
function serialize<T>(work: () => Promise<T>): Promise<T> {
  const next = writes.then(work, work);
  writes = next.catch(() => {});
  return next;
}

export async function readDrafts(userId: string): Promise<LocalDraft[]> {
  const raw = await AsyncStorage.getItem(key(userId));
  if (!raw) return [];
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed)) throw new Error('Invalid draft storage');
  return parsed.filter((item): item is LocalDraft =>
    item && typeof item.id === 'string' && typeof item.updatedAt === 'string' &&
    typeof item.sos === 'boolean' && (item.mode === 'quick' || item.mode === 'details') &&
    (item.audioUri === null || typeof item.audioUri === 'string') && typeof item.values?.title === 'string' && typeof item.values?.body === 'string' && createPostSchema.omit({ title: true, body: true }).safeParse(item.values).success,
  );
}

export function saveDraft(userId: string, input: Omit<LocalDraft, 'id' | 'updatedAt'> & { id?: string }): Promise<LocalDraft> {
  return serialize(async () => {
    const current = await readDrafts(userId);
    const id = input.id ?? `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const directory = folder(userId, id);
    directory.create({ intermediates: true, idempotent: true });
    const copied: File[] = [];
    function keep(uri: string): string {
      const source = new File(uri);
      if (!source.exists) throw new Error('Draft media missing');
      if (source.uri.startsWith(directory.uri.replace(/\/$/, '') + '/')) return source.uri;
      const extension = source.name.match(/\.[a-z0-9]{1,8}$/i)?.[0] ?? '.bin';
      const target = new File(directory, `${Date.now()}-${Math.random().toString(36).slice(2, 10)}${extension}`);
      source.copy(target);
      copied.push(target);
      return target.uri;
    }
    try {
      const photos = input.values.photos.map(photo => {
        if (photo.kind !== 'new') throw new Error('Only unpublished media may be stored as a local draft');
        return { ...photo, uri: keep(photo.uri) };
      });
      const saved: LocalDraft = { ...input, id, updatedAt: new Date().toISOString(), values: { ...input.values, photos }, audioUri: input.audioUri ? keep(input.audioUri) : null };
      await AsyncStorage.setItem(key(userId), JSON.stringify([saved, ...current.filter(d => d.id !== id)]));
      return saved;
    } catch (error) {
      for (const file of copied) { try { file.delete(); } catch {} }
      throw error;
    }
  });
}

export function deleteDraft(userId: string, id: string): Promise<void> {
  return serialize(async () => {
    const current = await readDrafts(userId);
    await AsyncStorage.setItem(key(userId), JSON.stringify(current.filter(d => d.id !== id)));
    // Delete only this draft's dedicated app-owned directory.
    try { const directory = folder(userId, id); if (directory.exists) directory.delete(); } catch {}
  });
}
