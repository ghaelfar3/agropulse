import { PulseButton as Button } from '@/components/PulseButton';

import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import {  type MD3Theme } from 'react-native-paper';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

import { useAppTheme } from '@/theme';

import {
  buildMapHtml,
  editorCommandScript,
  type EditorCommand,
  cancelDrawingScript,
  editPolygonScript,
  finishPolygonScript,
  flyToScript,
  invalidateSizeScript,
  loadDrawingScript,
  parseMapMessage,
  requestCenterScript,
  restartPolygonScript,
  setEditInteractionScript,
  setFieldTapsScript,
  setFieldsScript,
  startPolygonScript,
  undoScript,
  type FieldShape,
  type LngLat,
  type MapMessage,
  type MapPalette,
} from './mapHtml';

/**
 * Ключ Yandex Maps JS API. В отличие от `supabase/client.ts` мы здесь не бросаем исключение
 * при отсутствии ключа: этот экран — вкладка в табах, и падение при импорте
 * уронило бы всё приложение. Показываем состояние ошибки на самой карте.
 */
const YANDEX_MAPS_KEY = process.env.EXPO_PUBLIC_YANDEX_MAPS_API_KEY;

/**
 * Origin страницы внутри WebView. Для ключа Яндекс Карт можно добавить
 * `https://localhost/*` в HTTP Referer, если включаете ограничение по домену.
 */
const MAP_BASE_URL = 'https://localhost';

/** Если карта не сообщила о готовности за это время — считаем, что не взлетела. */
const READY_TIMEOUT_MS = 45000;

export type MapGLViewHandle = {
  /** Перелететь к точке. Вызовы до готовности карты применяются после неё. */
  flyTo: (center: LngLat, zoom: number) => void;
  /** Запросить центр карты — ответ придёт сообщением `center`. */
  requestCenter: () => void;
  /** Заставить карту перемерить контейнер. */
  invalidateSize: () => void;
  /** Перерисовать сохранённые поля. */
  setFields: (shapes: FieldShape[]) => void;
  /** Включить или выключить реакцию на тап по сохранённому полю. */
  setFieldTaps: (enabled: boolean) => void;
  /** Лениво подтянуть рисовалку — ответ придёт `drawing-ready` / `drawing-error`. */
  loadDrawing: () => void;
  startPolygon: () => void;
  /** Загрузить существующий контур в редактор — правка координат поля. */
  editPolygon: (ring: LngLat[]) => void;
  /** Стереть контур и вернуться в фазу рисования. */
  restartPolygon: () => void;
  undo: () => void;
  editorCommand: (command: EditorCommand) => void;
  /** Забрать нарисованный контур — ответ `polygon` / `polygon-invalid`. */
  finishPolygon: () => void;
  cancelDrawing: () => void;
  /** Тумблер фазы правки: жесты вершинам (`true`) или карте (`false`). */
  setEditInteraction: (editing: boolean) => void;
};

type MapGLViewProps = {
  /** События страницы, кроме готовности и фатальных ошибок — их держим внутри. */
  onEvent?: (message: MapMessage) => void;
  /**
   * Страница пересоздаётся. Всё, что жило внутри неё — начатый контур,
   * загруженная рисовалка — исчезло, и экран обязан это учесть.
   */
  onReload?: () => void;
};

type Status = 'loading' | 'ready' | 'error';

/**
 * Яндекс Карта внутри WebView: спиннер на загрузке, экран ошибки
 * с повтором и императивные команды странице. Всё остальное — детали страницы
 * в `mapHtml.ts`.
 */
export const MapGLView = forwardRef<MapGLViewHandle, MapGLViewProps>(function MapGLView(
  { onEvent, onReload },
  ref,
) {
  const theme = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const webViewRef = useRef<WebView>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /**
   * Команды, заказанные до `styleload`. Ключ — имя команды, поэтому повторный
   * заказ вытесняет предыдущий: два перелёта подряд не превратятся в два
   * перелёта после готовности.
   */
  const pendingRef = useRef(new Map<string, string>());
  /**
   * Команды, описывающие состояние страницы, а не разовое действие: слой полей
   * и разрешение тапов. Их проигрываем заново при каждой готовности карты —
   * после «Повторить» WebView поднимается пустым, и без этого поля исчезали
   * бы до следующей перезагрузки списка.
   */
  const stateRef = useRef(new Map<string, string>());
  const statusRef = useRef<Status>('loading');

  const [status, setStatus] = useState<Status>(YANDEX_MAPS_KEY ? 'loading' : 'error');
  const [errorReason, setErrorReason] = useState<string | null>(null);
  // `attempt` пересоздаёт WebView: перезагрузить страницу, у которой не
  // загрузился скрипт Яндекс Карт, надёжнее целиком, чем через reload().
  const [attempt, setAttempt] = useState(0);

  const palette: MapPalette = useMemo(
    () => ({
      background: theme.colors.background,
      // Заливка полупрозрачная: под полем должна оставаться видна карта.
      fieldFill: `${theme.colors.primary}33`,
      fieldStroke: theme.colors.primary,
      pointFill: theme.colors.primary,
      pointStroke: theme.colors.onPrimary,
    }),
    [theme.colors.background, theme.colors.onPrimary, theme.colors.primary],
  );

  const html = useMemo(
    () => (YANDEX_MAPS_KEY ? buildMapHtml(YANDEX_MAPS_KEY, palette) : ''),
    [palette],
  );

  const clearTimer = useCallback(() => {
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  useEffect(() => clearTimer, [clearTimer]);

  const source = useMemo(() => ({ html, baseUrl: MAP_BASE_URL }), [html]);

  const changeStatus = useCallback((next: Status) => {
    statusRef.current = next;
    setStatus(next);
    if (next !== 'error') setErrorReason(null);
  }, []);

  /**
   * @param fatal карта нерабочая независимо от того, успела ли она загрузиться.
   * Без этого флага потеря WebGL-контекста или истёкший ключ давали пустой
   * бежевый прямоугольник без единого следа: экран ошибки не показывался,
   * потому что `ready` уже прошёл.
   */
  const fail = useCallback(
    (reason: string, fatal = false) => {
      if (__DEV__) console.warn('[Карта] ' + reason);
      // Не фатальные ошибки после загрузки игнорируем: карта при этом может
      // оставаться нарисованной и рабочей.
      if (statusRef.current === 'ready' && !fatal) return;
      clearTimer();
      setErrorReason(reason);
      changeStatus('error');
    },
    [changeStatus, clearTimer],
  );

  /**
   * Выполняет команду сразу или откладывает до готовности карты.
   *
   * @param persist команда описывает состояние страницы и должна повторяться
   * после каждой перезагрузки, а не выполняться однократно.
   */
  const run = useCallback((command: string, script: string, persist = false) => {
    if (persist) stateRef.current.set(command, script);
    if (statusRef.current !== 'ready') {
      pendingRef.current.set(command, script);
      return;
    }
    webViewRef.current?.injectJavaScript(script);
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      flyTo: (center, zoom) => run('flyTo', flyToScript(center, zoom), true),
      requestCenter: () => run('requestCenter', requestCenterScript()),
      invalidateSize: () => run('invalidateSize', invalidateSizeScript()),
      setFields: (shapes) => run('setFields', setFieldsScript(shapes), true),
      setFieldTaps: (enabled) => run('setFieldTaps', setFieldTapsScript(enabled), true),
      loadDrawing: () => run('loadDrawing', loadDrawingScript()),
      startPolygon: () => run('startPolygon', startPolygonScript()),
      editPolygon: (ring) => run('editPolygon', editPolygonScript(ring)),
      restartPolygon: () => run('restartPolygon', restartPolygonScript()),
      undo: () => run('undo', undoScript()),
      editorCommand: (command) => run('editorCommand', editorCommandScript(command)),
      finishPolygon: () => run('finishPolygon', finishPolygonScript()),
      cancelDrawing: () => run('cancelDrawing', cancelDrawingScript()),
      setEditInteraction: (editing) =>
        run('setEditInteraction', setEditInteractionScript(editing)),
    }),
    [run],
  );

  const handleMessage = useCallback(
    (event: WebViewMessageEvent) => {
      const message = parseMapMessage(event.nativeEvent.data);
      if (!message) return;

      if (message.type === 'error') {
        fail(message.message, message.fatal);
        return;
      }

      if (message.type === 'warning') {
        // Единичные сбои страницы: карта работает, но в Metro о них знать надо.
        if (__DEV__) console.warn('[Карта] ' + message.message);
        return;
      }

      if (message.type !== 'ready') {
        onEvent?.(message);
        return;
      }

      clearTimer();
      changeStatus('ready');
      // Состояние страницы восстанавливаем всегда, отложенные действия —
      // поверх него: по одинаковым ключам побеждает более свежее.
      const scripts = new Map(stateRef.current);
      for (const [command, script] of pendingRef.current) {
        scripts.set(command, script);
      }
      pendingRef.current = new Map();
      for (const script of scripts.values()) {
        webViewRef.current?.injectJavaScript(script);
      }
    },
    [changeStatus, clearTimer, fail, onEvent],
  );

  const handleLoadStart = useCallback(() => {
    clearTimer();
    if (statusRef.current === 'ready') return;
    timeoutRef.current = setTimeout(() => fail('таймаут готовности карты'), READY_TIMEOUT_MS);
  }, [clearTimer, fail]);

  const retry = useCallback(() => {
    // `stateRef` намеренно переживает перезагрузку — это и есть то, чем новую
    // страницу нужно наполнить, когда она поднимется.
    pendingRef.current = new Map();
    clearTimer();
    changeStatus('loading');
    setErrorReason(null);
    setAttempt((value) => value + 1);
    onReload?.();
  }, [changeStatus, clearTimer, onReload]);


  return (
    <View style={styles.container}>
      <WebView
        key={attempt}
        ref={webViewRef}
        source={source}
        originWhitelist={['https://*']}
        onMessage={handleMessage}
        onLoadStart={handleLoadStart}
        onError={() => fail('WebView не смог открыть страницу')}
        onHttpError={() => fail('WebView получил HTTP-ошибку')}
        // WebGL без аппаратного слоя не рисуется.
        androidLayerType="hardware"
        javaScriptEnabled
        domStorageEnabled
        // Скроллить нечего: страница ровно в размер карты, а перехват жестов
        // мешал бы панорамированию.
        scrollEnabled={false}
        overScrollMode="never"
        style={styles.webView}
        containerStyle={styles.webViewContainer}
      />
      {status === 'error' ? (
        <View style={styles.loadingOverlay}>
          <Text style={styles.errorTitle}>Не удалось загрузить карту</Text>
          <Button mode="contained" onPress={retry}>Повторить</Button>
        </View>
      ) : null}
      {status === 'loading' ? (
        <View style={styles.loadingOverlay} pointerEvents="none">
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : null}
    </View>
  );
});

const makeStyles = (theme: MD3Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    webView: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    webViewContainer: {
      flex: 1,
    },
    loadingOverlay: {
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.background,
    },
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
      backgroundColor: theme.colors.background,
    },
    errorTitle: {
      color: theme.colors.onBackground,
      fontSize: 18,
      fontWeight: '600',
      marginBottom: 8,
      textAlign: 'center',
    },
    errorText: {
      color: theme.colors.onSurfaceVariant,
      fontSize: 14,
      lineHeight: 20,
      textAlign: 'center',
    },
    retry: {
      marginTop: 20,
    },
    reason: {
      color: theme.colors.error,
      fontSize: 12,
      lineHeight: 17,
      marginTop: 12,
      textAlign: 'center',
    },
  });
