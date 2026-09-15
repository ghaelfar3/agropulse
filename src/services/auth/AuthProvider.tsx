
import type { User } from '@supabase/supabase-js';
import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from 'react';

import { getProfile, updateProfile, type Profile } from '@/services/profile';
import { supabase, toUserMessage } from '@/services/supabase';

import * as authApi from './authApi';
import type {
  AuthContextValue,
  AuthStatus,
  Credentials,
  RegisterPayload,
} from './authTypes';

type State = {
  status: AuthStatus;
  user: User | null;
  profile: Profile | null;
  error: string | null;
};

type Action =
  | { type: 'SESSION_CHANGED'; user: User | null }
  | { type: 'PROFILE_LOADED'; profile: Profile | null }
  | { type: 'AUTH_START' }
  | { type: 'AUTH_ERROR'; error: string }
  | { type: 'REGISTRATION_STARTED' }
  | { type: 'REGISTRATION_ERROR'; error: string }
  | { type: 'REGISTRATION_DONE'; user: User; profile: Profile };

const initialState: State = {
  status: 'loading',
  user: null,
  profile: null,
  error: null,
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'SESSION_CHANGED': {
      if (!action.user) {
        return { status: 'unauthenticated', user: null, profile: null, error: null };
      }
      // Подтверждение почты выключено, поэтому signUp отдаёт сессию сразу — и
      // слушатель попытается перевести в 'authenticated' ещё до того, как
      // запишется профиль. Пока статус 'registering', повышение запрещено.
      if (state.status === 'registering') {
        return { ...state, user: action.user };
      }
      const sameUser = state.user?.id === action.user.id;
      return {
        status: 'authenticated',
        user: action.user,
        profile: sameUser ? state.profile : null,
        error: null,
      };
    }
    case 'PROFILE_LOADED':
      return { ...state, profile: action.profile };
    case 'AUTH_START':
      return { ...state, status: 'authenticating', error: null };
    case 'AUTH_ERROR':
      return { ...state, status: 'unauthenticated', user: null, profile: null, error: action.error };
    case 'REGISTRATION_STARTED':
      return { ...state, status: 'registering', error: null };
    case 'REGISTRATION_ERROR':
      return { ...state, status: 'registering', error: action.error };
    case 'REGISTRATION_DONE':
      return {
        status: 'authenticated',
        user: action.user,
        profile: action.profile,
        error: null,
      };
    default:
      return state;
  }
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  // Единственный источник правды о сессии. Колбэк намеренно синхронный:
  // async-работа внутри onAuthStateChange может залочить клиент Supabase.
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      dispatch({ type: 'SESSION_CHANGED', user: session?.user ?? null });
    });

    // Подстраховка на случай, если INITIAL_SESSION не придёт: иначе приложение
    // навсегда останется на пустом экране со статусом 'loading'.
    authApi
      .getSession()
      .then((session) => dispatch({ type: 'SESSION_CHANGED', user: session?.user ?? null }))
      .catch(() => dispatch({ type: 'SESSION_CHANGED', user: null }));

    return () => data.subscription.unsubscribe();
  }, []);

  // Профиль догружаем отдельно — он не часть сессии и может ещё не существовать.
  const userId = state.user?.id ?? null;
  const needsProfile = state.status === 'authenticated' && userId !== null && !state.profile;

  useEffect(() => {
    if (!needsProfile || !userId) return;
    let active = true;
    getProfile(userId)
      .then((profile) => {
        if (active) dispatch({ type: 'PROFILE_LOADED', profile });
      })
      .catch(() => {
        // Профиль не критичен для входа: экраны переживут profile === null.
        if (active) dispatch({ type: 'PROFILE_LOADED', profile: null });
      });
    return () => {
      active = false;
    };
  }, [needsProfile, userId]);

  const signIn = useCallback(async (credentials: Credentials) => {
    dispatch({ type: 'AUTH_START' });
    try {
      // Статус переключит onAuthStateChange.
      await authApi.signInWithPassword(credentials);
    } catch (error) {
      dispatch({ type: 'AUTH_ERROR', error: toUserMessage(error) });
    }
  }, []);

  // Пользователь, созданный на этой попытке регистрации. Нужен, если signUp
  // прошёл, а запись профиля упала: повторный сабмит не должен пытаться
  // зарегистрировать ту же почту второй раз — она уже занята.
  const createdUserRef = useRef<User | null>(null);

  const signUp = useCallback(async (payload: RegisterPayload) => {
    dispatch({ type: 'REGISTRATION_STARTED' });
    try {
      let user = createdUserRef.current;
      if (!user) {
        const session = await authApi.signUpWithPassword({
          email: payload.email,
          password: payload.password,
        });
        user = session.user;
        createdUserRef.current = user;
      }

      const profile = await updateProfile(user.id, {
        name: payload.name,
        specialization: payload.specialization,
        region: payload.region,
      });

      createdUserRef.current = null;
      dispatch({ type: 'REGISTRATION_DONE', user, profile });
      return true;
    } catch (error) {
      const message = toUserMessage(error);
      // Если аккаунт уже создан, сессия жива — держим экран мастера, чтобы
      // пользователь мог повторить только запись профиля, а не остаться
      // «разлогиненным» с существующим аккаунтом.
      dispatch(
        createdUserRef.current
          ? { type: 'REGISTRATION_ERROR', error: message }
          : { type: 'AUTH_ERROR', error: message },
      );
      return false;
    }
  }, []);

  const signOut = useCallback(async () => {
    createdUserRef.current = null;
    try {
      await authApi.signOut();
    } catch {
      // Даже если сервер не ответил, локальную сессию считаем закрытой.
    }
    dispatch({ type: 'SESSION_CHANGED', user: null });
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!userId) return;
    try {
      const profile = await getProfile(userId);
      dispatch({ type: 'PROFILE_LOADED', profile });
    } catch {
      // Молча: это фоновое обновление, а не действие пользователя.
    }
  }, [userId]);

  const value = useMemo<AuthContextValue>(
    () => ({
      status: state.status,
      user: state.user,
      profile: state.profile,
      error: state.error,
      signIn,
      signUp,
      signOut,
      refreshProfile,
    }),
    [state, signIn, signUp, signOut, refreshProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
