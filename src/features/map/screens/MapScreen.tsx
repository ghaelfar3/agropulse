import { PulseButton as Button } from '@/components/PulseButton';
import { PulseDialog } from '@/components/PulseDialog';

import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, Pressable, StyleSheet, Text, View } from 'react-native';
import {  IconButton, type MD3Theme, Snackbar, Surface } from 'react-native-paper';

import { AppHeader } from '@/components/AppHeader';
import { Icon } from '@/components/Icon';
import { isKnownRegion } from '@/constants/regions';
import { useAuth } from '@/services/auth';
import { type Crop } from '@/services/supabase';
import { useAppTheme } from '@/theme';

import { FieldCardDialog } from '../components/FieldCardDialog';
import { FieldFormDialog } from '../components/FieldFormDialog';
import { MapGLView, type MapGLViewHandle } from '../components/MapGLView';
import {
  USER_ZOOM,
  type FieldShape,
  type LngLat,
  type MapMessage,
} from '../components/mapHtml';
import { useCurrentLocation } from '../hooks/useCurrentLocation';
import { useFields } from '@/hooks/useFields';
import type { MapScreenProps } from '@/navigation/types';
import {
  centroid,
  createField,
  updateField,
  type Coordinates,
  type FieldCropSnapshot,
} from '@/services/fields';
import { fieldDefaults, type FieldFormValues } from '../schemas/fieldSchema';

/**
 * Показываем предупреждение о неудачной геолокации один раз за запуск
 * приложения: вкладку открывают часто, и снекбар на каждый заход раздражал бы
 * сильнее, чем сама Москва вместо своего города.
 */
let warnedThisSession = false;

/**
 * `idle` — обычная карта. Остальные три — фазы создания поля:
 * `point` — прицел в центре экрана;
 * `drawing` — тап ставит вершину, протяжка панорамирует карту;
 * `editing` — контур замкнут, создать второй нечем, вершины можно править.
 */
type Mode = 'preparing' | 'idle' | 'point' | 'drawing' | 'editing';

/** Геометрия, уже нарисованная, но ещё не сохранённая. */
type Geometry = { center: Coordinates } | { boundary: Coordinates[] };

/**
 * Что именно сохранит форма. Три случая различаются и запросом к базе, и
 * заголовком диалога, поэтому они здесь, а не выводятся из пары флагов.
 */
type Pending =
  | { kind: 'create'; geometry: Geometry }
  | { kind: 'geometry'; id: string; geometry: Geometry }
  | { kind: 'info'; id: string };

/**
 * Вкладка «Карта»: Яндекс Карта, свои поля на ней и создание новых.
 *
 * При появлении вкладки камера едет на местоположение пользователя, а список
 * полей перезагружается. Если местоположения нет, карта остаётся там, где
 * открылась (Москва, обзорный зум) — уводить туда камеру повторно не нужно,
 * это только сбрасывало бы то, что человек рассматривал.
 *
 * Сверху — общий `AppHeader` (нативный хедер вкладки выключен); он же даёт
 * верхнюю safe-area врезку, поэтому обёртка `Screen` здесь не нужна.
 */
export default function MapScreen({ navigation, route }: MapScreenProps) {
  const theme = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const { user, profile } = useAuth();
  const mapRef = useRef<MapGLViewHandle>(null);
  const { locate } = useCurrentLocation();
  const { fields, error: fieldsError, reload } = useFields();

  const [mode, setMode] = useState<Mode>('idle');
  const [menuVisible, setMenuVisible] = useState(false);
  const [draftStats, setDraftStats] = useState<{ count: number; selected: number | null; canUndo: boolean }>({ count: 0, selected: null, canUndo: false });
  const [preparingDrawing, setPreparingDrawing] = useState(false);
  const [locating, setLocating] = useState(false);
  const [pending, setPending] = useState<Pending | null>(null);
  /** Поле, по которому тапнули: показываем карточку. */
  const [cardFieldId, setCardFieldId] = useState<string | null>(null);
  /** Поле, чью геометрию сейчас правим. `null` — создаём новое. */
  const [geometryTargetId, setGeometryTargetId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const saveLock = useRef(false);
  const [snack, setSnack] = useState<string | null>(null);

  /**
   * Контур, который нужно загрузить в редактор вместо рисования с нуля.
   * Живёт в ref, потому что нужен в обработчике `drawing-ready`, а тот не
   * должен пересоздаваться на каждую правку.
   */
  const editRingRef = useRef<LngLat[] | null>(null);

  // Читаем режим из колбэков, не пересоздавая их при каждом переключении.
  const modeRef = useRef<Mode>('idle');
  modeRef.current = mode;

  const goToUser = useCallback(async () => {
    setLocating(true);
    try {
      const outcome = await locate((center) => {
        if (modeRef.current === 'idle' && !focusPendingRef.current) mapRef.current?.flyTo(center, USER_ZOOM);
      });
      if (outcome !== 'ok' && !warnedThisSession) {
        warnedThisSession = true;
        setSnack('Не удалось определить местоположение');
      }
    } catch {
      setSnack('Не удалось определить местоположение');
    } finally {
      setLocating(false);
    }
  }, [locate]);

  useFocusEffect(
    useCallback(() => {
      void reload();
      mapRef.current?.invalidateSize();
      // Камеру не трогаем, если создаём поле (незаконченный контур уехал бы
      // за экран) или если нас позвали к конкретному полю с другой вкладки.
      if (modeRef.current === 'idle' && !focusPendingRef.current) void goToUser();
    }, [goToUser, reload]),
  );

  // Полигоны и одиночные точки страница рисует по-разному, поэтому делим
  // здесь; id едет вместе с фигурой, чтобы тап вернулся строкой из базы.
  useEffect(() => {
    const shapes: FieldShape[] = [];
    for (const field of fields) {
      if (field.id === geometryTargetId && mode !== 'idle') continue;
      if (field.boundary) {
        shapes.push({
          id: field.id,
          name: field.name,
          crop: field.currentCrop?.name,
          ring: field.boundary.map((point): LngLat => [point.longitude, point.latitude]),
        });
      } else if (field.center) {
        shapes.push({
          id: field.id,
          name: field.name,
          crop: field.currentCrop?.name,
          center: [field.center.longitude, field.center.latitude],
        });
      }
    }
    mapRef.current?.setFields(shapes);
  }, [fields, geometryTargetId, mode]);

  /**
   * Со вкладки профиля приходит id поля: подлетаем к нему и, если просили,
   * открываем карточку. Ждём, пока поле окажется в списке — навигация вполне
   * может опередить загрузку. Параметры сбрасываем, иначе каждый возврат на
   * вкладку повторял бы перелёт.
   */
  const focusFieldId = route.params?.focusFieldId;
  const focusOpensCard = route.params?.openCard === true;
  const focusPendingRef = useRef(false);
  focusPendingRef.current = focusFieldId !== undefined;

  useEffect(() => {
    if (!focusFieldId) return;
    const target = fields.find((item) => item.id === focusFieldId);
    if (!target) return;

    const point = target.center ?? (target.boundary ? centroid(target.boundary) : null);
    if (point) mapRef.current?.flyTo([point.longitude, point.latitude], USER_ZOOM);
    if (focusOpensCard) setCardFieldId(target.id);
    navigation.setParams({ focusFieldId: undefined, openCard: undefined });
  }, [fields, focusFieldId, focusOpensCard, navigation]);

  const stopDrawing = useCallback(() => {
    mapRef.current?.cancelDrawing();
    mapRef.current?.setFieldTaps(true);
    editRingRef.current = null;
    setPreparingDrawing(false);
    modeRef.current = 'idle';
    setMode('idle');
    setPending(null);
    setGeometryTargetId(null);
  }, []);

  // Системная кнопка «назад» на Android выходит из режима создания, а не из
  // приложения — иначе выйти из него можно было бы только кнопкой «Отмена».
  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
        if (saveLock.current) return true;
        if (modeRef.current === 'idle') return false;
        stopDrawing();
        return true;
      });
      return () => subscription.remove();
    }, [stopDrawing]),
  );

  /** Общий вход в любой режим создания или правки геометрии. */
  const beginGeometry = useCallback((fieldId: string | null) => {
    geometryTargetIdRef.current = fieldId;
    setGeometryTargetId(fieldId);
    // Пока рисуем, тап по соседнему полю открывал бы карточку поверх работы.
    mapRef.current?.setFieldTaps(false);
  }, []);

  const startPolygonMode = useCallback(
    (fieldId: string | null, ring: LngLat[] | null) => {
      beginGeometry(fieldId);
      editRingRef.current = ring;
      modeRef.current = 'preparing';
      setMode('preparing');
      setPreparingDrawing(true);
      mapRef.current?.loadDrawing();
    },
    [beginGeometry],
  );

  const startPointMode = useCallback(
    (fieldId: string | null, center: Coordinates | null) => {
      beginGeometry(fieldId);
      if (center) mapRef.current?.flyTo([center.longitude, center.latitude], USER_ZOOM);
      modeRef.current = 'point';
      setMode('point');
    },
    [beginGeometry],
  );

  // Читаем цель правки из колбэка, не пересоздавая его на каждое изменение.
  const geometryTargetIdRef = useRef<string | null>(null);
  geometryTargetIdRef.current = geometryTargetId;

  const handleMapEvent = useCallback((message: MapMessage) => {
    switch (message.type) {
      case 'draft-change':
        setDraftStats(message);
        break;
      case 'center':
        if (modeRef.current !== 'point') break;
        setPending(
          pendingFor(geometryTargetIdRef.current, {
            center: { longitude: message.center[0], latitude: message.center[1] },
          }),
        );
        break;
      case 'field-tap':
        if (modeRef.current !== 'idle') break;
        setCardFieldId(message.id);
        break;
      case 'contour-closed':
        if (modeRef.current !== 'drawing' && modeRef.current !== 'editing' && modeRef.current !== 'preparing') break;
        modeRef.current = 'editing';
        setMode('editing');
        mapRef.current?.setEditInteraction(false);
        break;
      case 'polygon':
        if (modeRef.current !== 'drawing' && modeRef.current !== 'editing') break;
        setPending(
          pendingFor(geometryTargetIdRef.current, {
            boundary: message.ring.map(([longitude, latitude]) => ({ longitude, latitude })),
          }),
        );
        break;
      case 'polygon-invalid':
        setSnack('Поставьте хотя бы три точки');
        break;
      case 'drawing-ready': {
        if (modeRef.current !== 'preparing') break;
        setPreparingDrawing(false);
        const ring = editRingRef.current;
        if (ring) {
          // Правка существующего поля начинается сразу с готового контура.
          mapRef.current?.editPolygon(ring);
        } else {
          modeRef.current = 'drawing';
          setMode('drawing');
          mapRef.current?.startPolygon();
        }
        break;
      }
      case 'drawing-error':
        stopDrawing();
        // Пользователю причина ни о чём не скажет, а в Metro она нужна: сюда
        // приходит и «скрипт не загрузился», и «CDN отдал не тот MIME».
        if (__DEV__) console.warn('[Карта] рисовалка: ' + message.message);
        // Не загрузиться и не открыться — разные беды: во втором случае
        // инструмент на месте, и «проверьте интернет» только запутает.
        setSnack(
          message.message.startsWith('draw-')
            ? 'Не удалось открыть редактор контура'
            : 'Не удалось загрузить инструмент рисования',
        );
        break;
      default:
        break;
    }
  }, [stopDrawing]);

  /**
   * Страницу пересоздали: рисовалка и начатый контур исчезли вместе с ней.
   * Выходим из режима создания, иначе на панели остались бы кнопки, которым
   * уже нечем управлять.
   */
  const handleMapReload = useCallback(() => {
    if (modeRef.current !== 'idle') {
      setSnack('Карта перезагрузилась, создание отменено');
    }
    modeRef.current = 'idle';
    setPreparingDrawing(false);
    setMode('idle');
    setPending(null);
    setGeometryTargetId(null);
    editRingRef.current = null;
    // Тапы по полям на время создания глушились, и это состояние переживает
    // перезагрузку страницы — возвращаем его руками.
    mapRef.current?.setFieldTaps(true);
  }, []);

  const handleSave = useCallback(
    async (
      values: FieldFormValues,
      selectedCrop: Pick<Crop, 'id' | 'slug' | 'name'> | null,
    ) => {
      if (!pending || saveLock.current) return;
      if (!user) {
        // Вкладка живёт за гейтом авторизации, так что сюда не попасть; но
        // молча ничего не делать по нажатию «Сохранить» — худший из исходов.
        setSnack('Нужно войти заново.');
        return;
      }
      const region = values.region.length > 0 ? values.region : null;
      const target = pending.kind !== 'create'
        ? fields.find((item) => item.id === pending.id) ?? null
        : null;
      const currentCrop = cropSnapshotFor(values.cropId, selectedCrop, target?.currentCrop ?? null);
      const currentStageId = values.stageId;
      saveLock.current = true;
      setSaving(true);
      try {
        if (pending.kind === 'info') {
          // Геометрию не трогаем вовсе: правка названия не должна затирать
          // контур, который мы даже не показывали в этой форме.
          await updateField(pending.id, {
            name: values.name,
            region,
            currentCrop,
            currentStageId,
          });
          setPending(null);
          setSnack('Поле обновлено');
        } else {
          const geometry = pending.geometry;
          const patch = {
            name: values.name,
            region,
            currentCrop,
            currentStageId,
            center: 'center' in geometry ? geometry.center : centroid(geometry.boundary),
            boundary: 'boundary' in geometry ? geometry.boundary : null,
          };
          if (pending.kind === 'geometry') {
            await updateField(pending.id, patch);
          } else {
            await createField(user.id, patch);
          }
          stopDrawing();
          setSnack(pending.kind === 'geometry' ? 'Поле обновлено' : 'Поле сохранено');
        }
        await reload();
      } catch (cause) {
        // Нарисованное намеренно не сбрасываем: обводить поле заново из-за
        // пропавшей сети — худшее, что можно предложить.
        setSnack('Не удалось сохранить поле.');
      } finally {
        saveLock.current = false;
        setSaving(false);
      }
    },
    [fields, pending, reload, stopDrawing, user],
  );

  // Раньше `error` из `useFields` не использовался нигде: неудачная загрузка
  // выглядела как «полей нет», и отличить одно от другого было невозможно.
  useEffect(() => {
    if (fieldsError) setSnack('Не удалось загрузить поля.');
  }, [fieldsError]);

  const cardField = useMemo(
    () => fields.find((item) => item.id === cardFieldId) ?? null,
    [cardFieldId, fields],
  );

  // Мемоизируем: `FieldFormDialog` сбрасывает форму при смене `defaults`, и
  // новый объект на каждый рендер затирал бы то, что пользователь печатает.
  const formDefaults = useMemo(() => {
    if (pending && pending.kind !== 'create') {
      const target = fields.find((item) => item.id === pending.id);
      if (target) {
        return {
          name: target.name,
          region: isKnownRegion(target.region) ? target.region : '',
          cropId: target.currentCrop?.id ?? null,
          stageId: target.currentStageId,
        };
      }
    }
    return fieldDefaults(fields.length, profile?.region ?? null);
  }, [fields, pending, profile?.region]);

  const editingExisting = pending !== null && pending.kind !== 'create';

  /** Карточка → правка координат: точке нужен прицел, контуру — редактор. */
  const editGeometry = useCallback(() => {
    if (!cardField) return;
    setCardFieldId(null);
    if (cardField.boundary) {
      startPolygonMode(
        cardField.id,
        cardField.boundary.map((point): LngLat => [point.longitude, point.latitude]),
      );
    } else {
      startPointMode(cardField.id, cardField.center);
    }
  }, [cardField, startPointMode, startPolygonMode]);

  const editInfo = useCallback(() => {
    if (!cardField) return;
    setCardFieldId(null);
    setPending({ kind: 'info', id: cardField.id });
  }, [cardField]);

  const creating = mode !== 'idle';

  return (
    <View style={styles.root}>
      <AppHeader title="Атлас полей" />
      <View style={styles.container}>
        <MapGLView ref={mapRef} onEvent={handleMapEvent} onReload={handleMapReload} />

      {creating && mode !== 'preparing' ? (
        <View style={styles.crosshair} pointerEvents="none">
          <Icon name="crosshairs" size={40} color={theme.colors.primary} />
        </View>
      ) : null}

      {creating ? (
        <View style={styles.bottomBar} pointerEvents="box-none">
          <Surface style={styles.panel} elevation={3}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: theme.colors.primary, fontSize: 12, fontWeight: '800', letterSpacing: 1 }}>ГРАНИЦЫ УЧАСТКА</Text>
                <Text style={{ color: theme.colors.onSurface, fontSize: 20, fontWeight: '800', marginTop: 4 }}>
                  {mode === 'point' ? 'Метка на карте' : draftStats.selected === null ? draftStats.count + ' точек' : 'Точка ' + (draftStats.selected + 1)}
                </Text>
              </View>
              <IconButton icon="close" onPress={stopDrawing} accessibilityLabel="Отменить создание поля" />
            </View>
            <Text style={styles.hintText}>{mode === 'point' ? 'Наведите прицел на участок' : draftStats.selected === null ? 'Наведите прицел на угол поля и добавьте точку' : 'Перетащите точку или перенесите её под прицел'}</Text>
            {mode !== 'point' ? <>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Button mode="contained-tonal" icon="plus" style={{ flex: 1 }} disabled={preparingDrawing || draftStats.count >= 96} onPress={() => mapRef.current?.editorCommand('add')}>
                  {draftStats.selected === null ? 'Добавить точку' : 'Вставить после'}
                </Button>
                <IconButton icon="rotate-ccw" disabled={!draftStats.canUndo} onPress={() => mapRef.current?.undo()} accessibilityLabel="Отменить изменение контура" />
              </View>
              {draftStats.selected !== null ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
                <Button compact onPress={() => mapRef.current?.editorCommand('move')}>Под прицел</Button>
                <Button compact onPress={() => mapRef.current?.editorCommand('remove')}>Удалить точку</Button>
                <Button compact onPress={() => mapRef.current?.editorCommand('deselect')}>Готово</Button>
              </View> : null}
            </> : null}
            <Button mode="contained" loading={preparingDrawing} disabled={preparingDrawing || saving || (mode !== 'point' && draftStats.count < 3)}
              onPress={() => mode === 'point' ? mapRef.current?.requestCenter() : mapRef.current?.finishPolygon()}>
              {mode === 'point' ? 'Использовать это место' : 'Назвать и сохранить'}
            </Button>
          </Surface>
        </View>
      ) : (
        <>
          <IconButton
            icon="crosshairs-gps"
            mode="contained"
            size={24}
            disabled={locating}
            onPress={() => void goToUser()}
            accessibilityLabel="Показать моё местоположение"
            containerColor={theme.colors.surface}
            iconColor={theme.colors.primary}
            style={styles.recenter}
          />

          <View style={styles.addAnchor}>
            <Button mode="contained" icon="plus" contentStyle={{ minHeight: 54 }} onPress={() => startPolygonMode(null, null)}>Очертить поле</Button>
          </View>
          <View style={{ position: 'absolute', top: 16, left: 16 }}>
            <Button mode="contained-tonal" icon="layers" onPress={() => setMenuVisible(true)}>Мои поля · {fields.length}</Button>
          </View>
          <PulseDialog visible={menuVisible} onDismiss={() => setMenuVisible(false)}>
            <PulseDialog.Title>Мои поля</PulseDialog.Title>
            <PulseDialog.Content>
              {fields.length === 0 ? <Text style={styles.hintText}>Добавьте свой первый участок</Text> : null}
              {fields.map(field => <Pressable key={field.id} accessibilityRole="button" accessibilityLabel={'Открыть поле ' + field.name}
                style={{ padding: 16, borderRadius: 18, backgroundColor: theme.colors.surfaceVariant, marginBottom: 8 }}
                onPress={() => {
                  setMenuVisible(false);
                  const center = field.center ?? (field.boundary ? centroid(field.boundary) : null);
                  if (center) mapRef.current?.flyTo([center.longitude, center.latitude], USER_ZOOM);
                  setCardFieldId(field.id);
                }}>
                <Text style={{ color: theme.colors.onSurface, fontSize: 17, fontWeight: '800' }}>{field.name}</Text>
                <Text style={{ color: theme.colors.onSurfaceVariant, marginTop: 4 }}>{field.currentCrop?.name ?? 'Без культуры'} · {field.currentStage?.name ?? 'Без статуса'}</Text>
              </Pressable>)}
              <Button icon="map-pin" onPress={() => { setMenuVisible(false); startPointMode(null, null); }}>Добавить только метку</Button>
            </PulseDialog.Content>
          </PulseDialog>
        </>
      )}

      <FieldCardDialog
        field={cardField}
        onClose={() => setCardFieldId(null)}
        onEditInfo={editInfo}
        onEditGeometry={editGeometry}
      />

      <FieldFormDialog
        visible={pending !== null}
        title={editingExisting ? 'Настройки поля' : 'Поле готово'}
        submitLabel={editingExisting ? 'Сохранить' : 'Сохранить поле'}
        defaults={formDefaults}
        saving={saving}
        onCancel={() => {
          setPending(null);
        }}
        onSubmit={(values, selectedCrop) => void handleSave(values, selectedCrop)}
      />

        <Snackbar visible={snack !== null} onDismiss={() => setSnack(null)} duration={4000}>
          {snack ?? ''}
        </Snackbar>
      </View>
    </View>
  );
}

/** Одна и та же геометрия сохраняется по-разному, смотря что мы правим. */
function pendingFor(targetId: string | null, geometry: Geometry): Pending {
  return targetId === null
    ? { kind: 'create', geometry }
    : { kind: 'geometry', id: targetId, geometry };
}

function cropSnapshotFor(
  cropId: number | null,
  selectedCrop: Pick<Crop, 'id' | 'slug' | 'name'> | null,
  previous: FieldCropSnapshot | null,
): FieldCropSnapshot | null {
  if (cropId === null) return null;
  if (selectedCrop && selectedCrop.id === cropId) {
    return {
      id: selectedCrop.id,
      slug: selectedCrop.slug,
      name: selectedCrop.name,
    };
  }
  return previous?.id === cropId ? previous : null;
}

const makeStyles = (theme: MD3Theme) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    crosshair: {
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      alignItems: 'center',
      justifyContent: 'center',
    },
    recenter: {
      position: 'absolute',
      right: 16,
      bottom: 16,
      width: 48,
      height: 48,
      borderRadius: 24,
      margin: 0,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.outline,
    },
    addAnchor: {
      position: 'absolute',
      bottom: 16,
      left: 16,
      right: 80,
    },
    add: {
      width: 48,
      height: 48,
      borderRadius: 24,
      margin: 0,
    },
    // Плашка и подсказка по центру и по содержимому: растянутая на всю ширину
    // панель оставляла слева пустое место, которое читалось как потерянная
    // кнопка.
    bottomBar: {
      position: 'absolute',
      right: 8,
      bottom: 16,
      left: 8,
      alignItems: 'center',
      gap: 8,
    },
    hint: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
      backgroundColor: theme.colors.surface,
    },
    hintText: {
      color: theme.colors.onSurfaceVariant,
      fontSize: 13,
      textAlign: 'left',
    },
    panel: {
      alignSelf: 'stretch',
      gap: 10,
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderRadius: 26,
      backgroundColor: theme.colors.surface,
    },
    toggle: {
      margin: 0,
    },
  });
