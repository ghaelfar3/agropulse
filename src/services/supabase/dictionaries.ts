import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Tables } from '@/types/database.types';

import { supabase } from './client';

export type PostType = Tables<'post_types'>;
export type PostStage = Tables<'post_stages'>;
export type PostStatus = Tables<'post_statuses'>;
export type ReactionType = Tables<'reaction_types'>;
export type Crop = Tables<'crops'>;

/**
 * Справочники. Лежат в services, а не в фиче: типы/стадии/статусы нужны и ленте,
 * и созданию поста, и фильтрам. В UI сопоставляем по `code`, а не по ID —
 * ID могут разъехаться между окружениями.
 */

export async function getPostTypes(): Promise<PostType[]> {
  const { data, error } = await supabase.from('post_types').select('*').order('id');
  if (error) throw error;
  return data;
}

export async function getPostStages(): Promise<PostStage[]> {
  const { data, error } = await supabase
    .from('post_stages')
    .select('*')
    .order('sort_order');
  if (error) throw error;
  return data;
}

export async function getPostStatuses(): Promise<PostStatus[]> {
  const { data, error } = await supabase.from('post_statuses').select('*').order('id');
  if (error) throw error;
  return data;
}

export async function getReactionTypes(): Promise<ReactionType[]> {
  const { data, error } = await supabase.from('reaction_types').select('*').order('id');
  if (error) throw error;
  return data;
}

let activeReactionTypesCache: ReactionType[] | null = null;

/**
 * Активные типы реакций в порядке справочника. Кэш на сессию — справочник
 * практически неизменен, а сводка реакций строится на каждый рендер ленты.
 * `getReactionTypes` сам `is_active` не фильтрует, поэтому фильтруем здесь.
 */
export async function getActiveReactionTypes(): Promise<ReactionType[]> {
  if (!activeReactionTypesCache) {
    activeReactionTypesCache = (await getReactionTypes()).filter((t) => t.is_active);
  }
  return activeReactionTypesCache;
}

/** Активные культуры для селектов. Справочник наполнен: 10 культур. */
export async function getCrops(): Promise<Pick<Crop, 'id' | 'slug' | 'name'>[]> {
  const { data, error } = await supabase
    .from('crops')
    .select('id, slug, name')
    .eq('is_active', true)
    .order('name');
  if (error) {
    const cached = await getCachedCrops();
    if (cached.length) return cached;
    throw error;
  }
  try { await AsyncStorage.setItem('agropulse:crops:v1', JSON.stringify(data)); } catch {}
  return data;
}

export async function getCachedCrops(): Promise<Pick<Crop, 'id' | 'slug' | 'name'>[]> {
  try { const raw = await AsyncStorage.getItem('agropulse:crops:v1'); const data: unknown = raw ? JSON.parse(raw) : []; return Array.isArray(data) ? data.filter(c => typeof c.id === 'number' && typeof c.name === 'string') : []; } catch { return []; }
}
