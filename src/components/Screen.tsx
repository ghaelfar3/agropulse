
import { useMemo, type ReactNode } from 'react';
import { StyleSheet, type ViewStyle } from 'react-native';
import type { MD3Theme } from 'react-native-paper';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { useAppTheme } from '../theme';

type ScreenProps = {
  children: ReactNode;
  /**
   * Какие края отбивать от системных элементов.
   * По умолчанию только верх: низ на вкладках закрывает сам таб-бар
   * (React Navigation добавляет туда inset), а экраны с `headerShown: true`
   * получают верхний отступ от шапки — им обёртка вообще не нужна.
   */
  edges?: readonly Edge[];
  style?: ViewStyle;
};

/**
 * Android рисует приложение edge-to-edge (RN 0.81+), то есть контент уходит
 * под статус-бар и под системную панель навигации. Любой экран без шапки
 * обязан отбить края сам — иначе заголовок окажется под часами.
 */
export function Screen({ children, edges = ['top'], style }: ScreenProps) {
  const theme = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  return (
    <SafeAreaView edges={edges} style={[styles.container, style]}>
      {children}
    </SafeAreaView>
  );
}

const makeStyles = (theme: MD3Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
  });
