import { supabase } from '@/services/supabase';
import type { Tables, TablesUpdate } from '@/types/database.types';

export type Profile = Tables<'profiles'>;
export type ProfileUpdate = TablesUpdate<'profiles'>;

/**
 * Строку в `profiles` создаёт триггер БД сразу после регистрации — клиенту
 * её вставлять не нужно, только читать и обновлять.
 * Живёт в services, а не в фиче: профиль тянут и AuthProvider, и экран профиля.
 */
export async function getProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function updateProfile(
  userId: string,
  patch: Pick<ProfileUpdate, 'name' | 'specialization' | 'region' | 'avatar_path'>,
): Promise<Profile> {
  const { data, error } = await supabase
    .from('profiles')
    .update(patch)
    .eq('id', userId)
    .select()
    .single();
  if (error) throw error;
  return data;
}
