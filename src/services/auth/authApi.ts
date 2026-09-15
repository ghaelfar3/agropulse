import type { Session } from '@supabase/supabase-js';

import { supabase } from '@/services/supabase';

import type { Credentials } from './authTypes';

/**
 * Тонкие обёртки над supabase.auth. Состояние не трогают — им управляет
 * AuthProvider через onAuthStateChange.
 */

export async function signInWithPassword(credentials: Credentials): Promise<Session> {
  const { data, error } = await supabase.auth.signInWithPassword(credentials);
  if (error) throw error;
  return data.session;
}

/**
 * Подтверждение почты на бэкенде отключено (`mailer_autoconfirm: true`),
 * поэтому signUp сразу возвращает готовую сессию — писем и кодов нет.
 */
export async function signUpWithPassword(credentials: Credentials): Promise<Session> {
  const { data, error } = await supabase.auth.signUp(credentials);
  if (error) throw error;
  if (!data.session) {
    // Сюда попадём, если на бэкенде снова включат подтверждение почты:
    // пользователь создан, но войти нельзя. Лучше явная ошибка, чем зависший экран.
    throw new Error(
      'Регистрация не завершена: сервер не вернул сессию. ' +
        'Возможно, на бэкенде включили подтверждение почты.',
    );
  }
  return data.session;
}

export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getSession(): Promise<Session | null> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}
