import { PulseButton as Button } from '@/components/PulseButton';

import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Avatar,  Menu, Text, type MD3Theme } from 'react-native-paper';

import { Icon } from '@/components/Icon';
import { useAppTheme } from '@/theme';

import type { Comment } from '../hooks/useComments';

type Props = {
  comment: Comment;
  onVote: (value: -1 | 1) => void;
  onEdit: () => void;
  onDelete: () => void;
  onReply: () => void;
  replyTo?: string;
};

function formatWhen(iso: string): string {
  const date = new Date(iso);
  const day = date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
  const time = date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  return `${day}, ${time}`;
}

export function CommentItem({ comment, onVote, onEdit, onDelete, onReply, replyTo }: Props) {
  const theme = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <View style={styles.row}>
      {comment.author.avatarUrl ? (
        <Avatar.Image size={28} source={{ uri: comment.author.avatarUrl }} />
      ) : (
        <Avatar.Icon
          size={28}
          icon="account"
          style={styles.avatar}
          color={theme.colors.onSurfaceVariant}
        />
      )}

      <View style={styles.main}>
        <View style={styles.headerLine}>
          <Text style={styles.nickname} numberOfLines={1}>
            {comment.author.nickname}
          </Text>
          <Text style={styles.when}>
            {formatWhen(comment.createdAt)}
            {comment.editedAt ? ' · изм.' : ''}
          </Text>

          {comment.isMine ? (
            <Menu
              visible={menuOpen}
              onDismiss={() => setMenuOpen(false)}
              contentStyle={styles.menuContent}
              anchor={
                <Pressable
                  onPress={() => setMenuOpen(true)}
                  hitSlop={6}
                  style={styles.menuAnchor}
                  accessibilityRole="button"
                  accessibilityLabel="Действия с комментарием"
                >
                  <Icon
                    name="dots-horizontal"
                    size={18}
                    color={theme.colors.onSurfaceVariant}
                  />
                </Pressable>
              }
            >
              <Menu.Item
                leadingIcon={() => (
                  <Icon name="pencil-outline" size={20} color={theme.colors.onSurface} />
                )}
                title="Редактировать"
                titleStyle={styles.menuItemText}
                onPress={() => {
                  setMenuOpen(false);
                  onEdit();
                }}
              />
              <Menu.Item
                leadingIcon={() => (
                  <Icon name="trash-can-outline" size={20} color={theme.colors.error} />
                )}
                title="Удалить"
                titleStyle={styles.menuItemDanger}
                onPress={() => {
                  setMenuOpen(false);
                  onDelete();
                }}
              />
            </Menu>
          ) : null}
        </View>

        {replyTo ? <Text style={{ color: theme.colors.primary, fontSize: 12 }}>↳ {replyTo}</Text> : null}
        <Text style={styles.body}>{comment.body}</Text>

        <View style={styles.votes}>
          <Button compact icon="reply-outline" onPress={onReply}>Ответить</Button>
          <Pressable
            onPress={() => onVote(1)}
            disabled={comment.isMine}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={comment.myVote === 1 ? 'Убрать лайк' : 'Нравится'}
            style={{ minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center' }}
            accessibilityState={{ selected: comment.myVote === 1, disabled: comment.isMine }}
          >
            <Icon
              name={comment.myVote === 1 ? 'heart' : 'heart-outline'}
              size={18}
              color={comment.myVote === 1 ? '#E44F78' : theme.colors.onSurfaceVariant}
            />
          </Pressable>
          <Text style={styles.score}>{comment.score || ''}</Text>
        </View>
      </View>
    </View>
  );
}

const makeStyles = (theme: MD3Theme) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      gap: 10,
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    avatar: {
      backgroundColor: theme.colors.surfaceVariant,
    },
    main: {
      flex: 1,
      gap: 4,
    },
    headerLine: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    nickname: {
      color: theme.colors.onSurface,
      fontSize: 14,
      fontWeight: '700',
      flexShrink: 1,
    },
    when: {
      color: theme.colors.onSurfaceVariant,
      fontSize: 12,
      flex: 1,
    },
    menuAnchor: {
      padding: 2,
    },
    menuContent: {
      borderRadius: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.outline,
    },
    menuItemText: {
      color: theme.colors.onSurface,
    },
    menuItemDanger: {
      color: theme.colors.error,
    },
    body: {
      color: theme.colors.onSurface,
      fontSize: 14,
      lineHeight: 20,
    },
    votes: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginTop: 2,
    },
    score: {
      color: theme.colors.onSurfaceVariant,
      fontSize: 13,
      fontWeight: '700',
      minWidth: 16,
      textAlign: 'center',
    },
  });
