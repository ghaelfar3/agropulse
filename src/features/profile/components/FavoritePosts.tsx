import { useCallback, useRef, useState } from 'react';
import { View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { ActivityIndicator, Snackbar, Text } from 'react-native-paper';
import { PostCard } from '@/components/PostCard';
import { PulseButton } from '@/components/PulseButton';
import { useAuth } from '@/services/auth';
import { getFeed } from '@/services/posts';
import { dictionaries, storage } from '@/services/supabase';
import { useReactions } from '@/hooks/useReactions';
import { mapItem, type FeedItem } from '@/features/home/hooks/useFeed';

const PAGE_SIZE = 20;
export function FavoritePosts({ onOpen, onMap }: { onOpen: (id: string) => void; onMap: (id: string) => void }) {
  const { user } = useAuth();
  const { setReaction } = useReactions();
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [more, setMore] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [pendingIds, setPendingIds] = useState<string[]>([]);
  const mutationLocks = useRef(new Set<string>());
  const generation = useRef(0);
  const cursor = useRef<{ createdAt: string; id: string } | undefined>(undefined);
  const pageLock = useRef(false);

  const load = useCallback(async (append = false) => {
    if (!user || (append && pageLock.current)) return;
    const request = ++generation.current;
    pageLock.current = true;
    setLoading(true);
    try {
      const [posts, types] = await Promise.all([
        getFeed({ likedBy: user.id, limit: PAGE_SIZE, before: append ? cursor.current : undefined }),
        dictionaries.getActiveReactionTypes(),
      ]);
      const urls = await storage.getPostMediaUrls(posts.flatMap(post => post.post_media.map(media => media.storage_path)));
      if (request !== generation.current) return;
      const next = posts.map(post => mapItem(post, urls, types, user.id));
      setItems(previous => append ? [...previous, ...next.filter(item => !previous.some(p => p.id === item.id))] : next);
      const last = posts.at(-1);
      cursor.current = last ? { createdAt: last.created_at, id: last.id } : undefined;
      setMore(posts.length === PAGE_SIZE);
    } catch { if (request === generation.current) setNotice('Не удалось загрузить избранное.'); }
    finally { if (request === generation.current) { pageLock.current = false; setLoading(false); } }
  }, [user?.id]);

  useFocusEffect(useCallback(() => {
    void load();
    return () => { generation.current++; pageLock.current = false; };
  }, [load]));

  async function unlike(item: FeedItem) {
    if (!user || item.isMine || mutationLocks.current.has(item.id) || pageLock.current) return;
    const mine = item.reactions.find(reaction => reaction.mine);
    if (!mine) return;
    mutationLocks.current.add(item.id);
    setPendingIds(previous => [...previous, item.id]);
    try {
      await setReaction({ postId: item.id, userId: user.id, previous: mine.code, next: null });
      setItems(previous => previous.filter(post => post.id !== item.id));
    } catch { setNotice('Не удалось убрать лайк. Попробуйте ещё раз.'); }
    finally { mutationLocks.current.delete(item.id); setPendingIds(previous => previous.filter(id => id !== item.id)); }
  }

  return <View style={{ paddingBottom: 16 }}>
    {!loading && !items.length ? <View style={{ padding: 24, gap: 12 }}>
      <Text style={{ textAlign: 'center', fontSize: 16 }}>Здесь появятся посты, которым вы поставили сердечко</Text>
      {notice ? <PulseButton onPress={() => void load()}>Повторить</PulseButton> : null}
    </View> : null}
    {items.map(item => <PostCard key={item.id} {...item} ownPost={item.isMine}
      reactionsDisabled={loading || pendingIds.includes(item.id)}
      onPress={() => onOpen(item.id)} onComment={() => onOpen(item.id)}
      onToggleReaction={() => void unlike(item)} onMap={item.fieldId ? () => onMap(item.fieldId!) : undefined} />)}
    {loading ? <ActivityIndicator style={{ margin: 24 }} /> : null}
    {more && !loading ? <PulseButton disabled={pendingIds.length > 0} onPress={() => void load(true)}>Ещё понравившиеся</PulseButton> : null}
    <Snackbar visible={notice !== null} onDismiss={() => setNotice(null)}>{notice ?? ''}</Snackbar>
  </View>;
}
