import { PulseButton as Button } from '@/components/PulseButton';
import { PulseDialog as Dialog } from '@/components/PulseDialog';
import { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import {   Portal, Text, type MD3Theme } from 'react-native-paper';

import { useAppTheme } from '@/theme';

import type { IconName } from './Icon';

type ConfirmDialogProps = {
  visible: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Кнопка подтверждения и иконка — в цвете ошибки (для необратимых действий). */
  destructive?: boolean;
  /** Иконка над заголовком; без неё диалог просто текстовый. */
  icon?: IconName;
  /** Спиннер на кнопке подтверждения; обе кнопки и закрытие по фону блокируются. */
  loading?: boolean;
  /** Текст ошибки красным внутри диалога — диалог остаётся открытым. */
  error?: string | null;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
};

/**
 * Диалог подтверждения в стиле темы приложения — замена системному `Alert`.
 * Работает через `Portal` (в `App.tsx` `PaperProvider` уже даёт `PortalHost`).
 *
 * Пока идёт операция (`loading`), диалог не закрывается ни кнопкой, ни тапом по
 * фону — иначе можно уйти, не узнав, чем кончилось.
 */
export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel = 'Подтвердить',
  cancelLabel = 'Отмена',
  destructive = false,
  icon,
  loading = false,
  error,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const theme = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const accent = destructive ? theme.colors.error : theme.colors.primary;

  return (
    <Portal>
      <Dialog
        visible={visible}
        onDismiss={loading ? () => {} : onCancel}
        dismissable={!loading}
      >
        {icon ? <Dialog.Icon icon={icon} color={accent} /> : null}
        <Dialog.Title style={styles.title}>{title}</Dialog.Title>
        {message || error ? (
          <Dialog.Content>
            {message ? (
              <Text variant="bodyMedium" style={styles.message}>
                {message}
              </Text>
            ) : null}
            {error ? <Text style={styles.error}>{error}</Text> : null}
          </Dialog.Content>
        ) : null}
        <Dialog.Actions>
          <Button
            onPress={onCancel}
            disabled={loading}
            textColor={theme.colors.onSurfaceVariant}
          >
            {cancelLabel}
          </Button>
          <Button
            mode="contained"
            onPress={() => void onConfirm()}
            loading={loading}
            disabled={loading}
            buttonColor={destructive ? theme.colors.error : undefined}
            textColor={destructive ? theme.colors.onError : undefined}
          >
            {confirmLabel}
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}

const makeStyles = (theme: MD3Theme) =>
  StyleSheet.create({
    title: {
      color: theme.colors.onSurface,
    },
    message: {
      color: theme.colors.onSurfaceVariant,
    },
    error: {
      color: theme.colors.error,
      marginTop: 8,
      fontSize: 13,
    },
  });
