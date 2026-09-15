import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  Keyboard,
  TextInput as NativeTextInput,
  ScrollView,
  StyleSheet,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ViewStyle,
} from 'react-native';
import type { MD3Theme } from 'react-native-paper';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { KeyboardLift } from './KeyboardLift';
import { useAppTheme } from '../theme';

type FocusTarget = Pick<View, 'measureInWindow'>;
type FocusHandler = (view: FocusTarget | null) => void;

const FieldFocusContext = createContext<FocusHandler | null>(null);

/**
 * Поле формы сообщает сюда свою обёртку при фокусе. Возвращает no-op, если
 * поле оказалось вне `KeyboardAwareScreen` — форма всё равно работает,
 * просто без доводки скролла.
 */
export function useFieldFocus(): FocusHandler {
  return useContext(FieldFocusContext) ?? noop;
}

type KeyboardAwareScreenProps = {
  children: ReactNode;
  edges?: readonly Edge[];
  style?: ViewStyle;
  contentContainerStyle?: ViewStyle;
};

/**
 * Скроллящийся экран формы: при фокусе поле уезжает в центр видимой области,
 * а не остаётся под клавиатурой.
 *
 * Почему считаем вручную, а не берём `KeyboardAvoidingView`: тот лишь
 * поджимает контейнер, оставляя поле у самой кромки клавиатуры. И почему
 * своими руками, а не библиотекой: `react-native-keyboard-controller` —
 * нативный модуль, которого нет в Expo Go, а вся отладка тут идёт через него.
 *
 * Геометрия считается в координатах экрана (`measureInWindow`), поэтому
 * работает одинаково и при edge-to-edge (окно не сжимается, клавиатура
 * накрывает контент), и при обычном `adjustResize` (окно сжимается —
 * тогда нижнюю границу задаёт сам ScrollView, а не клавиатура).
 */
export function KeyboardAwareScreen({
  children,
  edges = ['top', 'bottom'],
  style,
  contentContainerStyle,
}: KeyboardAwareScreenProps) {
  const theme = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const scrollRef = useRef<ScrollView>(null);
  const scrollViewRef = useRef<View>(null);
  const focusedRef = useRef<FocusTarget | null>(null);
  const offsetRef = useRef(0);
  const viewportRef = useRef({ top: 0, bottom: 0 });
  const keyboardTopRef = useRef<number | null>(null);

  // Высота видимой области нужна ещё и в разметке: без запаса снизу последнее
  // поле физически не сможет доехать до центра — скроллить будет некуда.
  const [visibleHeight, setVisibleHeight] = useState(0);
  const [keyboardInset, setKeyboardInset] = useState(0);

  const recomputeVisible = useCallback(() => {
    const { top, bottom } = viewportRef.current;
    const keyboardTop = keyboardTopRef.current;
    const effectiveBottom = keyboardTop === null ? bottom : Math.min(bottom, keyboardTop);
    setVisibleHeight(Math.max(0, effectiveBottom - top));
    setKeyboardInset(Math.max(0, bottom - effectiveBottom));
  }, []);

  const measureViewport = useCallback(() => {
    scrollViewRef.current?.measureInWindow((_x, y, _width, height) => {
      viewportRef.current = { top: y, bottom: y + height };
      recomputeVisible();
    });
  }, [recomputeVisible]);

  const centerFocused = useCallback(() => {
    const input = NativeTextInput.State.currentlyFocusedInput();
    if (!input || keyboardTopRef.current === null) return;
    const view = focusedRef.current ?? input;
    const container = scrollViewRef.current;
    if (!view || !container) return;

    // Меряем область прокрутки заново, а не берём с последнего onLayout:
    // экран мог приехать анимацией перехода, и старые координаты соврут.
    container.measureInWindow((_cx, containerY, _cw, containerHeight) => {
      viewportRef.current = { top: containerY, bottom: containerY + containerHeight };

      view.measureInWindow((_x, y, _width, height) => {
        const { top, bottom } = viewportRef.current;
        const keyboardTop = keyboardTopRef.current;
        const effectiveBottom = keyboardTop === null ? bottom : Math.min(bottom, keyboardTop);
        const visible = effectiveBottom - top;
        if (visible <= 0) return;

        // Насколько центр поля отстоит от центра видимой области — на столько
        // же и доскроллим.
        const delta = y + height / 2 - (top + visible / 2);
        scrollRef.current?.scrollTo({
          y: Math.max(0, offsetRef.current + delta),
          animated: true,
        });
      });
    });
  }, []);

  useEffect(() => {
    const onShow = Keyboard.addListener('keyboardDidShow', (event) => {
      keyboardTopRef.current = event.endCoordinates.screenY;
      recomputeVisible();
      centerFocused();
    });
    const onHide = Keyboard.addListener('keyboardDidHide', () => {
      keyboardTopRef.current = null;
      focusedRef.current = null;
      recomputeVisible();
    });
    return () => {
      onShow.remove();
      onHide.remove();
    };
  }, [centerFocused, recomputeVisible]);

  const handleFieldFocus = useCallback<FocusHandler>(
    (view) => {
      focusedRef.current = view;
      // Клавиатура уже открыта (перешли между полями) — события не будет,
      // доводим сами. Если ещё не открыта, доведёт `keyboardDidShow`.
      if (keyboardTopRef.current !== null) centerFocused();
    },
    [centerFocused],
  );

  const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    offsetRef.current = event.nativeEvent.contentOffset.y;
  }, []);

  return (
    <SafeAreaView edges={edges} style={[styles.container, style]}>
      <KeyboardLift>
      <View ref={scrollViewRef} style={styles.container} onLayout={() => { measureViewport(); if (keyboardTopRef.current !== null) requestAnimationFrame(centerFocused); }}>
        <FieldFocusContext.Provider value={handleFieldFocus}>
          <ScrollView
            ref={scrollRef}
            style={styles.container}
            contentContainerStyle={[styles.content, contentContainerStyle]}
            keyboardShouldPersistTaps="handled"
            removeClippedSubviews={false}
            onScroll={handleScroll}
            scrollEventThrottle={16}
          >
            {children}
            {/*
              Запас снизу, пока открыта клавиатура: без него нижние поля
              упираются в конец контента и до центра не доезжают. Отдельной
              распоркой, а не paddingBottom, чтобы не затирать отступы экрана.
            */}
            <View style={{ height: keyboardTopRef.current !== null ? keyboardInset + visibleHeight / 2 : 0 }} />
          </ScrollView>
        </FieldFocusContext.Provider>
      </View>
      </KeyboardLift>
    </SafeAreaView>
  );
}

function noop() {}

const makeStyles = (theme: MD3Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    content: {
      flexGrow: 1,
    },
  });
