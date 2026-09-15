import { PulseButton as Button } from '@/components/PulseButton';
import { PulseDialog as Dialog } from '@/components/PulseDialog';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {   type MD3Theme, Portal } from 'react-native-paper';

import { useAppTheme } from '@/theme';

import type { Field } from '@/services/fields';

type FieldCardDialogProps = {
  field: Field | null;
  onClose: () => void;
  onEditInfo: () => void;
  onEditGeometry: () => void;
};

/**
 * Карточка поля по тапу на карте: что это за поле и что с ним можно сделать.
 * Правка разведена на две кнопки, потому что это две разные операции —
 * одна правит строку в базе, другая возвращает на карту в режим рисования.
 */
export function FieldCardDialog({
  field,
  onClose,
  onEditInfo,
  onEditGeometry,
}: FieldCardDialogProps) {
  const theme = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  return (
    <Portal>
      <Dialog visible={field !== null} onDismiss={onClose}>
        <Dialog.Title>{field?.name ?? ''}</Dialog.Title>
        <Dialog.Content>
          <Text style={{ color: theme.colors.onSurfaceVariant, marginBottom: 16 }}>{field?.region ?? 'Регион не указан'}</Text>
          <Row label="Культура" value={field?.currentCrop?.name ?? 'не указана'} styles={styles} />
          <Row
            label="Сейчас на поле"
            value={field?.currentStage?.name ?? 'не указан'}
            styles={styles}
          />
          <Row
            label="Границы"
            value={field?.boundary ? `контур, ${field.boundary.length} точек` : 'только точка'}
            styles={styles}
          />

        </Dialog.Content>
        <Dialog.Actions style={styles.actions}>
          <Button mode="contained-tonal" icon="move" onPress={onEditGeometry}>Настроить на карте</Button>
          <Button mode="contained-tonal" icon="sliders" onPress={onEditInfo}>Культура и данные</Button>
          <Button mode="contained" onPress={onClose}>
            К карте
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}

function Row({
  label,
  value,
  styles,
}: {
  label: string;
  value: string;
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

/** Дата в локальном формате; на кривой строке из базы не падаем. */
function formatDate(value: string | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('ru-RU');
}

const makeStyles = (theme: MD3Theme) =>
  StyleSheet.create({
    row: {
      flexDirection: 'column',
      justifyContent: 'space-between',
      gap: 5,
      padding: 14,
      marginBottom: 8,
      borderRadius: 14,
      backgroundColor: theme.colors.surfaceVariant,
    },
    label: {
      color: theme.colors.onSurfaceVariant,
      fontSize: 14,
    },
    value: {
      color: theme.colors.onSurface,
      fontSize: 14,
      flexShrink: 1,
      textAlign: 'left',
      fontWeight: '700',
    },
    actions: {
      flexWrap: 'wrap',
      flexDirection: 'column',
      alignItems: 'stretch',
    },
  });
