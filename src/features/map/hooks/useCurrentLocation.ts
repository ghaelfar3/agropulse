import * as Location from 'expo-location';
import { useCallback, useEffect, useRef } from 'react';

import type { LngLat } from '../components/mapHtml';

/**
 * Сколько ждём реальный фикс, прежде чем сдаться. У `getCurrentPositionAsync`
 * своего таймаута нет, поэтому гонку устраиваем сами.
 */
const FIX_TIMEOUT_MS = 8000;

/** Насколько устаревшая позиция из кеша ОС ещё годится для первого показа. */
const CACHE_MAX_AGE_MS = 5 * 60 * 1000;

export type LocateOutcome =
  /** Позиция получена — `onPosition` был вызван хотя бы раз. */
  | 'ok'
  /** Пользователь не дал разрешение. */
  | 'denied'
  /** Разрешение есть, но фикса нет: выключен GPS, таймаут, ошибка. */
  | 'unavailable';

/**
 * Определение местоположения для карты.
 *
 * `locate` может вызвать `onPosition` дважды: сначала с координатами из кеша
 * ОС (мгновенно), потом с уточнённым фиксом. Второй вызов обычно смещает камеру
 * на десятки метров, а если пользователь успел уехать — покажет, что он уехал.
 *
 * Точность `Balanced` (~100 м) выбрана осознанно: на зуме карты это неотличимо,
 * а `High` держал бы пользователя на экране-заглушке несколько секунд при
 * каждом входе на вкладку. Разрешение при этом просим точное — чтобы поднять
 * точность под будущие поля можно было без нового системного диалога.
 */
export function useCurrentLocation() {
  const mountedRef = useRef(true);
  /** Отсекает результаты предыдущего вызова, если начался новый. */
  const runIdRef = useRef(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const locate = useCallback(
    async (onPosition: (center: LngLat) => void): Promise<LocateOutcome> => {
      const runId = ++runIdRef.current;
      const isCurrent = () => mountedRef.current && runIdRef.current === runId;

      const { granted } = await Location.requestForegroundPermissionsAsync();
      if (!granted) return 'denied';
      if (!isCurrent()) return 'unavailable';

      let reported = false;
      const report = (position: Location.LocationObject) => {
        if (!isCurrent()) return;
        reported = true;
        onPosition([position.coords.longitude, position.coords.latitude]);
      };

      try {
        const cached = await Location.getLastKnownPositionAsync({
          maxAge: CACHE_MAX_AGE_MS,
        });
        if (cached) report(cached);
      } catch {
        // Кеш — необязательная оптимизация: молча идём за настоящим фиксом.
      }
      if (!isCurrent()) return 'unavailable';

      try {
        const fresh = await withTimeout(
          Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
          FIX_TIMEOUT_MS,
        );
        if (fresh) report(fresh);
      } catch {
        // Нет фикса — если кеш уже отдал позицию, этого достаточно.
      }

      return reported ? 'ok' : 'unavailable';
    },
    [],
  );

  return { locate };
}

/** Возвращает `null`, если промис не успел за `ms`. */
async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}
