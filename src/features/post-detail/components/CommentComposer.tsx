import { PulseButton as Button } from '@/components/PulseButton';
import { PulseInput as TextInput } from '@/components/PulseInput';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import {  Text,  type MD3Theme } from 'react-native-paper';

import { Icon } from '@/components/Icon';
import { useAppTheme } from '@/theme';

export type ComposerEditing = { id: string; initialText: string } | null;

type Props = {
  editing: ComposerEditing;
  replying?: { id: string; name: string } | null;
  onCancelReply?: () => void;
  submitting: boolean;
  /** Плейсхолдер поля («Комментарий» / «Ответить»). */
  placeholder: string;
  /** Подпись кнопки в режиме создания («Отправить» / «Ответить»). */
  submitLabel: string;
  /** Текст баннера в режиме правки («Редактирование комментария» / «…ответа»). */
  editingLabel: string;
  /** Возвращает `true`, если отправка прошла успешно (тогда поле очищается). */
  onSubmit: (text: string) => Promise<boolean>;
  onCancelEdit: () => void;
};

/**
 * Прибитое к низу PostDetail поле ввода. Одно на два режима: новый комментарий /
 * ответ и правка своего (текст подставляется, кнопка → «Сохранить», сверху баннер).
 */
export function CommentComposer({
  editing,
  replying,
  onCancelReply,
  submitting,
  placeholder,
  submitLabel,
  editingLabel,
  onSubmit,
  onCancelEdit,
}: Props) {
  const theme = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const [text, setText] = useState('');
  const inputRef = useRef<{ focus: () => void } | null>(null);
  useEffect(() => { if (replying || editing) inputRef.current?.focus(); }, [replying, editing]);

  // Вход/выход из режима правки перезаливает поле.
  useEffect(() => {
    setText(editing ? editing.initialText : '');
  }, [editing]);

  const trimmed = text.trim();
  const canSend = trimmed.length > 0 && !submitting;

  const handleSend = async () => {
    const ok = await onSubmit(trimmed);
    // В режиме правки успех уводит editing → null, и текст очистит эффект.
    if (ok && !editing) setText('');
  };

  return (
    <View style={styles.wrap}>
      {editing || replying ? (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>{editing ? editingLabel : `Ответ для ${replying?.name}`}</Text>
          <Pressable
            onPress={editing ? onCancelEdit : onCancelReply}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Отмена"
          >
            <Icon name="close" size={16} color={theme.colors.onSurfaceVariant} />
          </Pressable>
        </View>
      ) : null}

      <View style={styles.inputRow}>
        <TextInput
          ref={(instance: { focus: () => void } | null) => { inputRef.current = instance; }}
          editable={!submitting}
          multiline
          mode="outlined"
          value={text}
          onChangeText={setText}
          placeholder={placeholder}
          style={styles.input}
        />
        <Button
          mode="contained"
          compact
          disabled={!canSend}
          loading={submitting}
          onPress={handleSend}
        >
          {editing ? 'Обновить' : submitLabel}
        </Button>
      </View>
    </View>
  );
}

const makeStyles = (theme: MD3Theme) =>
  StyleSheet.create({
    wrap: {
      borderTopWidth: 0,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      borderTopColor: theme.colors.outline,
      backgroundColor: theme.colors.surface,
      paddingHorizontal: 12,
      paddingTop: 8,
      paddingBottom: 8,
    },
    banner: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 4,
      paddingBottom: 6,
    },
    bannerText: {
      color: theme.colors.onSurfaceVariant,
      fontSize: 12,
    },
    inputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    input: {
      flex: 1,
      maxHeight: 120,
    },
  });
