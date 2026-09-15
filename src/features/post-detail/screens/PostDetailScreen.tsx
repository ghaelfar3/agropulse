
import { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import {
  ActivityIndicator,
  Divider,
  Snackbar,
  Text,
  type MD3Theme,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';

import { KeyboardLift } from '@/components/KeyboardLift';
import { AppHeader } from '@/components/AppHeader';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { PostCard } from '@/components/PostCard';
import { useReactions } from '@/hooks/useReactions';
import type { PostDetailScreenProps } from '@/navigation/types';
import { useAuth } from '@/services/auth';
import { getPost } from '@/services/posts';
import {
  summarizeReactions,
  toggleReactionSummary,
  type ReactionSummary,
} from '@/services/reactions';
import { dictionaries, storage, toUserMessage } from '@/services/supabase';
import { useAppTheme } from '@/theme';

import { CommentComposer, type ComposerEditing } from '../components/CommentComposer';
import { CommentItem } from '../components/CommentItem';
import { useComments } from '../hooks/useComments';

type PostView = {
  isMine: boolean;
  author: { nickname: string; avatarUrl?: string };
  title: string;
  description?: string;
  images: string[];
  postTypeCode: string;
  stageCode: string | null;
  stageName: string | null;
  statusCode: string | null;
  statusName: string | null;
  isSos: boolean;
  fieldId: string | null;
};

/** Формулировки зависят от типа поста: вопрос → «ответы», иначе → «комментарии». */
const TERMS = {
  question: {
    empty: 'Пока нет ответов',
    placeholder: 'Ответить',
    submit: 'Ответить',
    editingLabel: 'Редактирование ответа',
    deleteTitle: 'Удалить ответ?',
  },
  post: {
    empty: 'Пока нет комментариев',
    placeholder: 'Комментарий',
    submit: 'Отправить',
    editingLabel: 'Редактирование комментария',
    deleteTitle: 'Удалить комментарий?',
  },
} as const;

export default function PostDetailScreen({
  route,
  navigation,
}: PostDetailScreenProps) {
  const { postId } = route.params;
  const theme = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { user } = useAuth();
  const { setReaction } = useReactions();
  const {
    comments,
    loading: commentsLoading,
    error: commentsError,
    reload: reloadComments,
    add,
    edit,
    remove,
    vote,
  } = useComments(postId);

  const [post, setPost] = useState<PostView | null>(null);
  const [reactions, setReactions] = useState<ReactionSummary[]>([]);
  const [loadingPost, setLoadingPost] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editing, setEditing] = useState<ComposerEditing>(null);
  const [replying, setReplying] = useState<{ id: string; name: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const loadPost = useCallback(async () => {
    setLoadingPost(true);
    try {
      const [fetched, activeTypes] = await Promise.all([
        getPost(postId),
        dictionaries.getActiveReactionTypes(),
      ]);
      if (!fetched) {
        setError('Пост не найден.');
        return;
      }
      const media = [...fetched.post_media].sort((a, b) => a.sort_order - b.sort_order);
      const urls = await storage.getPostMediaUrls(media.map((m) => m.storage_path));
      setPost({
        isMine: fetched.profiles?.id === user?.id,
        author: {
          nickname: fetched.profiles?.name ?? 'без имени',
          avatarUrl: fetched.profiles?.avatar_path
            ? storage.getAvatarUrl(fetched.profiles.avatar_path)
            : undefined,
        },
        title: fetched.title ?? 'Без заголовка',
        description: fetched.body ?? undefined,
        images: media
          .map((m) => urls[m.storage_path])
          .filter((u): u is string => Boolean(u)),
        postTypeCode: fetched.post_types?.code ?? 'field_update',
        stageCode: fetched.post_stages?.code ?? null,
        stageName: fetched.post_stages?.name ?? null,
        statusCode: fetched.post_statuses?.code ?? null,
        statusName: fetched.post_statuses?.name ?? null,
        isSos:
          fetched.post_types?.code === 'question' &&
          fetched.post_stages?.code === 'problem' &&
          fetched.post_statuses?.code !== 'solved' && fetched.post_statuses?.code !== 'closed',
        fieldId: fetched.field_id,
      });
      setReactions(
        summarizeReactions(fetched.post_reactions ?? [], activeTypes, user?.id),
      );
      setError(null);
    } catch (cause) {
      setError(toUserMessage(cause));
    } finally {
      setLoadingPost(false);
    }
  }, [postId, user?.id]);

  useFocusEffect(
    useCallback(() => {
      void loadPost();
      void reloadComments();
    }, [loadPost, reloadComments]),
  );

  const handleToggleReaction = useCallback(
    async (code: string) => {
      if (!user || post?.isMine) return;
      const { next, previousCode, nextCode } = toggleReactionSummary(reactions, code);
      const snapshot = reactions;
      setReactions(next);
      try {
        await setReaction({
          postId,
          userId: user.id,
          previous: previousCode,
          next: nextCode,
        });
      } catch (cause) {
        setReactions(snapshot);
        setActionError(
          cause instanceof Error ? cause.message : 'Не удалось сохранить реакцию.',
        );
      }
    },
    [reactions, user, post, postId, setReaction],
  );

  const handleSubmitComment = useCallback(
    async (text: string): Promise<boolean> => {
      setSubmitting(true);
      try {
        if (editing) {
          await edit(editing.id, text);
          setEditing(null);
        } else {
          await add(text, replying?.id ?? null);
          setReplying(null);
        }
        return true;
      } catch (cause) {
        setActionError('Не удалось выполнить действие. Попробуйте ещё раз.');
        return false;
      } finally {
        setSubmitting(false);
      }
    },
    [editing, replying, edit, add],
  );

  const openFieldOnMap = useCallback(
    (fieldId: string) => {
      navigation.navigate('Tabs', {
        screen: 'Map',
        params: { focusFieldId: fieldId, openCard: true },
      });
    },
    [navigation],
  );

  const handleVote = useCallback(
    async (id: string, value: -1 | 1) => {
      try {
        await vote(id, value);
      } catch (cause) {
        setActionError('Не удалось выполнить действие. Попробуйте ещё раз.');
      }
    },
    [vote],
  );

  const handleConfirmDelete = useCallback(async () => {
    if (!pendingDeleteId) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await remove(pendingDeleteId);
      if (editing?.id === pendingDeleteId) setEditing(null);
      setPendingDeleteId(null);
      setReplying(null);
    } catch (cause) {
      setDeleteError(cause instanceof Error ? cause.message : toUserMessage(cause));
    } finally {
      setDeleting(false);
    }
  }, [pendingDeleteId, remove, editing]);

  const threaded = useMemo(() => {
    const byId = new Map(comments.map(c => [c.id, c]));
    const children = new Map<string | null, typeof comments>();
    for (const c of comments) {
      const parent = c.parentId && byId.has(c.parentId) ? c.parentId : null;
      children.set(parent, [...(children.get(parent) ?? []), c]);
    }
    const result: { comment: (typeof comments)[number]; depth: number; replyTo?: string }[] = [];
    const visited = new Set<string>();
    function visit(parent: string | null, depth: number) {
      for (const c of children.get(parent) ?? []) {
        if (visited.has(c.id)) continue;
        visited.add(c.id);
        result.push({ comment: c, depth, replyTo: c.parentId ? byId.get(c.parentId)?.author.nickname : undefined });
        visit(c.id, depth + 1);
      }
    }
    visit(null, 0);
    return result;
  }, [comments]);

  const terms = post?.postTypeCode === 'question' ? TERMS.question : TERMS.post;
  const fieldId = post?.fieldId ?? null;

  return (
    <SafeAreaView edges={['bottom']} style={styles.root}>
      <AppHeader title="Пост" onBack={() => navigation.goBack()} />
      <KeyboardLift style={styles.flex}>
        {loadingPost && !post ? (
          <ActivityIndicator style={styles.loader} />
        ) : error ? (
          <Text style={styles.stateText}>Не удалось загрузить пост</Text>
        ) : (
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
          >
            {post ? (
              <PostCard
                author={post.author}
                ownPost={post.isMine}
                title={post.title}
                description={post.description}
                images={post.images}
                postTypeCode={post.postTypeCode}
                stageCode={post.stageCode}
                stageName={post.stageName}
                statusCode={post.statusCode}
                statusName={post.statusName}
                isSos={post.isSos}
                reactions={reactions}
                onToggleReaction={handleToggleReaction}
                commentCount={comments.length}
                onMap={fieldId ? () => openFieldOnMap(fieldId) : undefined}
              />
            ) : null}

            <Divider />

            {commentsError ? (
              <Text style={styles.stateText}>Не удалось загрузить обсуждение</Text>
            ) : null}
            {commentsLoading ? <ActivityIndicator style={styles.loader} /> : null}
            {!commentsLoading && comments.length === 0 ? (
              <Text style={styles.stateText}>{terms.empty}</Text>
            ) : null}

            {threaded.map(({ comment, depth, replyTo }) => (
              <View key={comment.id} style={{ marginLeft: Math.min(depth, 2) * 16, borderLeftWidth: depth ? 2 : 0, borderLeftColor: theme.colors.outline }}>
              <CommentItem
                key={comment.id}
                comment={comment}
                replyTo={replyTo}
                onReply={() => { if (submitting) return; setEditing(null); setReplying({ id: comment.id, name: comment.author.nickname }); }}
                onVote={(value) => handleVote(comment.id, value)}
                onEdit={() => { if (submitting) return; setReplying(null); setEditing({ id: comment.id, initialText: comment.body }); }}
                onDelete={() => {
                  setDeleteError(null);
                  setPendingDeleteId(comment.id);
                }}
              />
              </View>
            ))}
            <View style={styles.bottomSpacer} />
          </ScrollView>
        )}

        {post && !error ? (
          <CommentComposer
            editing={editing}
            replying={replying}
            onCancelReply={() => { if (!submitting) setReplying(null); }}
            submitting={submitting}
            placeholder={terms.placeholder}
            submitLabel={terms.submit}
            editingLabel={terms.editingLabel}
            onSubmit={handleSubmitComment}
            onCancelEdit={() => { if (!submitting) setEditing(null); }}
          />
        ) : null}
      </KeyboardLift>

      <ConfirmDialog
        visible={pendingDeleteId !== null}
        title={terms.deleteTitle}
        message="Комментарий и ответы на него будут удалены."
        confirmLabel="Удалить"
        destructive
        loading={deleting}
        error={deleteError}
        onConfirm={handleConfirmDelete}
        onCancel={() => {
          setPendingDeleteId(null);
          setDeleteError(null);
        }}
      />

      <Snackbar
        visible={actionError !== null}
        onDismiss={() => setActionError(null)}
        duration={3000}
      >
        {actionError ?? ''}
      </Snackbar>
    </SafeAreaView>
  );
}

const makeStyles = (theme: MD3Theme) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    flex: {
      flex: 1,
    },
    content: {
      flexGrow: 1,
      paddingBottom: 12,
    },
    loader: {
      marginTop: 24,
    },
    stateText: {
      color: theme.colors.onSurfaceVariant,
      fontSize: 15,
      textAlign: 'center',
      marginTop: 24,
      paddingHorizontal: 24,
    },
    bottomSpacer: {
      height: 8,
    },
  });
