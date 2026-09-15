
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { MD3Theme } from 'react-native-paper';

import { useAppTheme } from '../theme';

/** Заглушка для ещё не реализованных экранов. */
export function ScreenPlaceholder({ text }: { text: string }) {
  const theme = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  return (
    <View style={styles.container}>
      <Text style={styles.text}>{text}</Text>
    </View>
  );
}

const makeStyles = (theme: MD3Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
      backgroundColor: theme.colors.background,
    },
    text: {
      color: theme.colors.onSurfaceVariant,
      fontSize: 16,
      textAlign: 'center',
    },
  });
