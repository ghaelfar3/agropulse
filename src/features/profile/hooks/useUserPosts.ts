import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '@/services/auth';
import { getFeed, getPost, type FeedPost } from '@/services/posts';
import { summarizeReactions, type ReactionSummary } from '@/services/reactions';
import {
  dictionaries,
  storage,
  toUserMessage,
  type ReactionType,
} from '@/services/supabase';

export type { ReactionSummary };

/** Пост в том виде, в каком его рисует `PostCard` на экране профиля. */
export type ProfilePost = {
  id: string;
  /** `code` из справочника post_types — нужен экрану редактирования. */
  postTypeCode: string;
  stageCode: string | null;
  stageName: string | null;
  statusCode: string | null;
  statusName: string | null;
  isSos: boolean;
  fieldId: string | null;
  author: { nickname: string; avatarUrl?: string };
  title: string;
  description?: string;
  images: string[];
  /** По одному элементу на активный тип реакции, в порядке справочника. */
  reactions: ReactionSummary[];
  commentCount: number;
};

function mapPost(
  post: FeedPost,
  urls: Record<string, string>,
  activeTypes: ReactionType[],
  viewerId: string | undefined,
): ProfilePost {
  return {
    id: post.id,
    postTypeCode: post.post_types?.code ?? 'field_update',
    stageCode: post.post_stages?.code ?? null,
    stageName: post.post_stages?.name ?? null,
    statusCode: post.post_statuses?.code ?? null,
    statusName: post.post_statuses?.name ?? null,
    isSos:
      post.post_types?.code === 'question' &&
      post.post_stages?.code === 'problem' &&
      post.post_statuses?.code !== 'solved' && post.post_statuses?.code !== 'closed',
    fieldId: post.field_id,
    author: {
      nickname: post.profiles?.name ?? 'без имени',
      avatarUrl: post.profiles?.avatar_path
        ? storage.getAvatarUrl(post.profiles.avatar_path)
        : undefined,
    },
    title: post.title ?? 'Без заголовка',
    description: post.body ?? undefined,
    images: [...post.post_media]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((media) => urls[media.storage_path])
      .filter((url): url is string => Boolean(url)),
    reactions: summarizeReactions(post.post_reactions ?? [], activeTypes, viewerId),
    commentCount: post.answers?.[0]?.count ?? 0,
  };
}

/**
 * Посты автора для вкладки «Мои посты» (и позже — чужого профиля). Тянет ленту
 * с фильтром по `author_id`, подписывает URL для приватного бакета `post-media`
 * и сводит реакции/комментарии к счётчикам. `syncItem` точечно перечитывает один
 * пост после возврата с PostDetail / EditPost.
 */
export function useUserPosts(userId?: string) {
  const { user } = useAuth();
  const viewerId = user?.id;
  const [posts, setPosts] = useState<ProfilePost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!userId) {
      setPosts([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [feed, activeTypes] = await Promise.all([
        getFeed({ authorId: userId, limit: 30 }),
        dictionaries.getActiveReactionTypes(),
      ]);
      const paths = feed.flatMap((post) =>
        post.post_media.map((media) => media.storage_path),
      );
      const urls = await storage.getPostMediaUrls(paths);
      setPosts(feed.map((post) => mapPost(post, urls, activeTypes, viewerId)));
    } catch (cause) {
      setError(toUserMessage(cause));
    } finally {
      setLoading(false);
    }
  }, [userId, viewerId]);

  const syncItem = useCallback(
    async (id: string) => {
      try {
        const post = await getPost(id);
        if (!post) {
          setPosts((prev) => prev.filter((item) => item.id !== id));
          return;
        }
        const activeTypes = await dictionaries.getActiveReactionTypes();
        const urls = await storage.getPostMediaUrls(
          post.post_media.map((media) => media.storage_path),
        );
        const fresh = mapPost(post, urls, activeTypes, viewerId);
        setPosts((prev) => prev.map((item) => (item.id === id ? fresh : item)));
      } catch {
        // Тихо: один пост не обновился — не рушим список.
      }
    },
    [viewerId],
  );

  useEffect(() => {
    void load();
  }, [load]);

  return { posts, setPosts, loading, error, reload: load, syncItem };
}
