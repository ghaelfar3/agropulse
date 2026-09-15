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

/** Страница по 15 постов; keyset-курсор — `{ createdAt, id }` последнего. */
const PAGE = 15;

/** Пост ленты главной — как `ProfilePost`, плюс `isMine` и `createdAt` (курсор). */
export type FeedItem = {
  id: string;
  postTypeCode: string;
  stageCode: string | null;
  stageName: string | null;
  statusCode: string | null;
  statusName: string | null;
  createdAt: string;
  isSos: boolean;
  isMine: boolean;
  fieldId: string | null;
  author: { nickname: string; avatarUrl?: string };
  title: string;
  description?: string;
  images: string[];
  reactions: ReactionSummary[];
  commentCount: number;
};

type Cursor = { createdAt: string; id: string } | undefined;

export function mapItem(
  post: FeedPost,
  urls: Record<string, string>,
  activeTypes: ReactionType[],
  viewerId: string | undefined,
): FeedItem {
  return {
    id: post.id,
    postTypeCode: post.post_types?.code ?? 'field_update',
    stageCode: post.post_stages?.code ?? null,
    stageName: post.post_stages?.name ?? null,
    statusCode: post.post_statuses?.code ?? null,
    statusName: post.post_statuses?.name ?? null,
    createdAt: post.created_at,
    isSos:
      post.post_types?.code === 'question' &&
      post.post_stages?.code === 'problem' &&
      post.post_statuses?.code !== 'solved' && post.post_statuses?.code !== 'closed',
    isMine: viewerId ? post.profiles?.id === viewerId : false,
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
 * Бесконечная лента всех постов для вкладки «Главная». Страницы аккумулируются;
 * подгрузка — keyset по `(created_at, id)`. `setItems` наружу — для оптимистичных
 * реакций и вырезания поста при удалении (как `setPosts` в `useUserPosts`).
 */
export function useFeed() {
  const { user } = useAuth();
  const viewerId = user?.id;

  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);

  const fetchPage = useCallback(
    async (cursor: Cursor): Promise<FeedItem[]> => {
      const [feed, activeTypes] = await Promise.all([
        getFeed({ limit: PAGE, before: cursor }),
        dictionaries.getActiveReactionTypes(),
      ]);
      const paths = feed.flatMap((post) =>
        post.post_media.map((media) => media.storage_path),
      );
      const urls = await storage.getPostMediaUrls(paths);
      return feed.map((post) => mapItem(post, urls, activeTypes, viewerId));
    },
    [viewerId],
  );

  const loadFirst = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const page = await fetchPage(undefined);
      setItems(page);
      setHasMore(page.length === PAGE);
    } catch (cause) {
      setError(toUserMessage(cause));
    } finally {
      setLoading(false);
    }
  }, [fetchPage]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      const page = await fetchPage(undefined);
      setItems(page);
      setHasMore(page.length === PAGE);
    } catch (cause) {
      setError(toUserMessage(cause));
    } finally {
      setRefreshing(false);
    }
  }, [fetchPage]);

  const loadMore = useCallback(async () => {
    if (loadingMore || loading || refreshing || !hasMore || items.length === 0) return;
    setLoadingMore(true);
    try {
      const last = items[items.length - 1];
      const page = await fetchPage({ createdAt: last.createdAt, id: last.id });
      setItems((prev) => {
        const seen = new Set(prev.map((item) => item.id));
        return [...prev, ...page.filter((item) => !seen.has(item.id))];
      });
      setHasMore(page.length === PAGE);
    } catch (cause) {
      setError(toUserMessage(cause));
    } finally {
      setLoadingMore(false);
    }
  }, [items, loadingMore, loading, refreshing, hasMore, fetchPage]);

  /**
   * Перечитать один пост (после возврата с PostDetail / EditPost): свежие
   * счётчик комментариев, реакции, изменённые поля. Скролл и подгруженные
   * страницы не трогаются. Если пост исчез — убираем из ленты.
   */
  const syncItem = useCallback(
    async (id: string) => {
      try {
        const post = await getPost(id);
        if (!post) {
          setItems((prev) => prev.filter((item) => item.id !== id));
          return;
        }
        const activeTypes = await dictionaries.getActiveReactionTypes();
        const urls = await storage.getPostMediaUrls(
          post.post_media.map((media) => media.storage_path),
        );
        const fresh = mapItem(post, urls, activeTypes, viewerId);
        setItems((prev) => prev.map((item) => (item.id === id ? fresh : item)));
      } catch {
        // Тихо: не смогли обновить один пост — не повод рушить ленту.
      }
    },
    [viewerId],
  );

  useEffect(() => {
    void loadFirst();
  }, [loadFirst]);

  return {
    items,
    setItems,
    loading,
    loadingMore,
    refreshing,
    error,
    syncItem,
    hasMore,
    loadMore,
    refresh,
    retry: loadFirst,
  };
}
