import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@/services/auth';
import { useCallback, useRef, useState } from 'react';

import { toUserMessage } from '@/services/supabase';

import { getFields, type Field } from '@/services/fields';

type UseFieldsResult = {
  fields: Field[];
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
};

/**
 * Тонкая обёртка над сервисом полей. Живёт в общих хуках, а не в фиче карты:
 * тот же список нужен и вкладке профиля. Сама при монтировании не грузит: экран
 * вызывает `reload` при каждом появлении вкладки, и автозагрузка означала бы
 * два одинаковых запроса подряд.
 *
 * Кэша нет намеренно — когда он понадобится, сюда встанет react-query,
 * и экраны менять не придётся.
 */
export function useFields(): UseFieldsResult {
  const { user } = useAuth();
  const [fields, setFields] = useState<Field[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Отсекает ответ предыдущей загрузки, если началась новая. */
  const runIdRef = useRef(0);

  const reload = useCallback(async () => {
    const runId = ++runIdRef.current;
    if (!user) { setFields([]); setLoading(false); return; }
    const cacheKey = 'agropulse:fields:v1:' + user.id;
    let hasCache = false;
    try {
      const raw = await AsyncStorage.getItem(cacheKey);
      const cached: unknown = raw ? JSON.parse(raw) : null;
      if (Array.isArray(cached)) {
        const own = cached.filter(field => field.owner_id === user.id && typeof field.id === 'string' && typeof field.name === 'string');
        hasCache = true;
        if (runIdRef.current === runId) setFields(own);
      }
    } catch {}
    if (runIdRef.current !== runId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getFields();
      if (runIdRef.current === runId) {
        setFields(data);
        try { await AsyncStorage.setItem(cacheKey, JSON.stringify(data)); } catch {}
      }
    } catch (cause) {
      if (runIdRef.current === runId && !hasCache) setError(toUserMessage(cause));
    } finally {
      if (runIdRef.current === runId) setLoading(false);
    }
  }, [user?.id]);

  return { fields, loading, error, reload };
}
