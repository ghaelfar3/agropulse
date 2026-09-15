import type { User } from '@supabase/supabase-js';

import type { Profile } from '@/services/profile';

export type AuthStatus =
  | 'loading' // читаем сохранённую сессию при старте
  | 'authenticating' // идёт вход
  | 'registering' // идёт регистрация: сессия может уже быть, но профиль не заполнен
  | 'authenticated'
  | 'unauthenticated';

export type Credentials = {
  email: string;
  password: string;
};

/** Всё, что собирает мастер регистрации, одним объектом. */
export type RegisterPayload = {
  email: string;
  password: string;
  name: string;
  specialization: string;
  region: string;
};

export type AuthContextValue = {
  status: AuthStatus;
  /** Пользователь Supabase Auth: id, email. Профиль — отдельным полем. */
  user: User | null;
  /** Строка `profiles`. null, пока не загрузилась или пока её нет. */
  profile: Profile | null;
  error: string | null;
  signIn: (credentials: Credentials) => Promise<void>;
  /** Последний шаг мастера: создаёт пользователя и заполняет профиль. */
  signUp: (payload: RegisterPayload) => Promise<boolean>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};
