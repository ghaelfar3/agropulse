import { PulseButton as Button } from '@/components/PulseButton';

import { useMemo, type ReactNode } from 'react';
import { Keyboard, StyleSheet, Text, View } from 'react-native';
import {  type MD3Theme } from 'react-native-paper';

import { AppHeader } from '@/components/AppHeader';
import { KeyboardAwareScreen } from '@/components/KeyboardAwareScreen';
import { useAppTheme } from '@/theme';

import { useCreatePostMeta } from '../forms/CreatePostProvider';

const TOTAL_STEPS = 5;

type CreateStepLayoutProps = {
  /** Номер шага, 1..5 — для прогресс-бара. */
  step: number;
  title: string;
  subtitle?: string;
  /** Не передаётся на первом шаге создания — там кнопки «назад» нет. */
  onBack?: () => void;
  onNext: () => void;
  nextLabel?: string;
  nextLoading?: boolean;
  nextDisabled?: boolean;
  children: ReactNode;
};

/**
 * Оболочка шага мастера: общий `AppHeader` (с «Новая публикация» / «Редактирование»)
 * + прогресс-бар + заголовок шага + тело + кнопка. Почти копия `RegisterStepLayout`.
 */
export function CreateStepLayout({
  step,
  title,
  subtitle,
  onBack,
  onNext,
  nextLabel = 'Далее',
  nextLoading = false,
  nextDisabled = false,
  children,
}: CreateStepLayoutProps) {
  const theme = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { postId } = useCreatePostMeta();
  const modeLabel = postId ? 'Редактирование' : 'Новая публикация';

  return (
    <View style={styles.root}>
      <AppHeader title={modeLabel} onBack={onBack} />

      <View style={styles.progressRow}>
        <View style={styles.progressTrack}>
          <View
            style={[styles.progressFill, { width: `${(step / TOTAL_STEPS) * 100}%` }]}
          />
        </View>
      </View>

      <KeyboardAwareScreen edges={['bottom']} contentContainerStyle={styles.content}>
        <View style={styles.body}>
          <Text style={styles.stepCounter}>{`Шаг ${step} из ${TOTAL_STEPS}`}</Text>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}

          <View style={styles.fields}>{children}</View>

          <Button
            mode="contained"
            onPress={() => {
              Keyboard.dismiss();
              onNext();
            }}
            loading={nextLoading}
            disabled={nextDisabled || nextLoading}
            style={styles.nextButton}
            accessibilityLabel={nextLabel}
          >
            {nextLabel}
          </Button>
        </View>
      </KeyboardAwareScreen>
    </View>
  );
}

const makeStyles = (theme: MD3Theme) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    content: {
      flexGrow: 1,
      paddingBottom: 24,
    },
    progressRow: {
      paddingHorizontal: 16,
      paddingTop: 12,
    },
    progressTrack: {
      height: 4,
      borderRadius: 2,
      overflow: 'hidden',
      backgroundColor: theme.colors.surfaceVariant,
    },
    progressFill: {
      height: '100%',
      borderRadius: 2,
      backgroundColor: theme.colors.primary,
    },
    body: {
      flex: 1,
      justifyContent: 'center',
      paddingHorizontal: 24,
    },
    stepCounter: {
      color: theme.colors.onSurfaceVariant,
      fontSize: 13,
      fontWeight: '700',
      letterSpacing: 0.5,
      textTransform: 'uppercase',
      marginBottom: 8,
    },
    title: {
      color: theme.colors.onBackground,
      fontSize: 30,
      fontWeight: '800',
      letterSpacing: 0,
    },
    subtitle: {
      color: theme.colors.onSurfaceVariant,
      fontSize: 15,
      lineHeight: 21,
      marginTop: 8,
    },
    fields: {
      marginTop: 20,
    },
    nextButton: {
      marginTop: 8,
    },
  });
