import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '@/services/auth';
import { storage, toUserMessage } from '@/services/supabase';

import {
  addComment,
  deleteComment,
  listComments,
  setAnswerVote,
  updateComment,
  type CommentRow,
} from '../repository/commentsRepository';

export type Comment = {
  id: string;
  parentId: string | null;
  author: { nickname: string; avatarUrl?: string };
  body: string;
  createdAt: string;
  /** Задано, если комментарий редактировали. */
  editedAt?: string;
  isMine: boolean;
  score: number;
  myVote: -1 | 0 | 1;
};

function mapRow(row: CommentRow, viewerId: string | undefined): Comment {
  const score = row.answer_votes.filter(v => v.value === 1).length;
  const mine = viewerId
    ? row.answer_votes.find((v) => v.user_id === viewerId)?.value
    : undefined;
  return {
    id: row.id,
    parentId: row.parent_answer_id,
    author: {
      nickname: row.profiles?.name ?? 'без имени',
      avatarUrl: row.profiles?.avatar_path
        ? storage.getAvatarUrl(row.profiles.avatar_path)
        : undefined,
    },
    body: row.body,
    createdAt: row.created_at,
    editedAt: row.updated_at !== row.created_at ? row.updated_at : undefined,
    isMine: viewerId ? row.author_id === viewerId : false,
    score,
    myVote: mine === 1 ? 1 : mine === -1 ? -1 : 0,
  };
}

/**
 * Комментарии поста: ручной паттерн `loading/error/reload` + мутации.
 * Голос обновляется оптимистично (частое действие), остальное — через `reload`.
 */
export function useComments(postId: string) {
  const { user } = useAuth();
  const viewerId = user?.id;
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await listComments(postId);
      setComments(rows.map((row) => mapRow(row, viewerId)));
    } catch (cause) {
      setError(toUserMessage(cause));
    } finally {
      setLoading(false);
    }
  }, [postId, viewerId]);

  useEffect(() => {
    void load();
  }, [load]);

  const add = useCallback(
    async (body: string, parentId: string | null = null) => {
      if (!viewerId) throw new Error('Сессия не найдена. Войдите заново.');
      try {
        await addComment(postId, viewerId, body, parentId);
      } catch (cause) {
        throw new Error(toUserMessage(cause));
      }
      await load();
    },
    [postId, viewerId, load],
  );

  const edit = useCallback(
    async (id: string, body: string) => {
      try {
        await updateComment(id, body);
      } catch (cause) {
        throw new Error(toUserMessage(cause));
      }
      await load();
    },
    [load],
  );

  const remove = useCallback(
    async (id: string) => {
      try {
        await deleteComment(id);
      } catch (cause) {
        throw new Error(toUserMessage(cause));
      }
      await load();
    },
    [load],
  );

  const vote = useCallback(
    async (id: string, value: -1 | 1) => {
      if (!viewerId) throw new Error('Сессия не найдена. Войдите заново.');
      const target = comments.find((c) => c.id === id);
      if (!target || target.isMine) return;
      const nextVote: -1 | 0 | 1 = target.myVote === value ? 0 : value;
      const snapshot = comments;
      setComments((prev) =>
        prev.map((c) =>
          c.id === id
            ? { ...c, myVote: nextVote, score: c.score - (c.myVote === 1 ? 1 : 0) + (nextVote === 1 ? 1 : 0) }
            : c,
        ),
      );
      try {
        await setAnswerVote({
          answerId: id,
          userId: viewerId,
          value: nextVote === 0 ? null : nextVote,
        });
      } catch (cause) {
        setComments(snapshot);
        throw new Error(toUserMessage(cause));
      }
    },
    [comments, viewerId],
  );

  return { comments, loading, error, reload: load, add, edit, remove, vote };
}
