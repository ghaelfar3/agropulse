
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet } from 'react-native';
import { ActivityIndicator, Text, type MD3Theme } from 'react-native-paper';

import { Screen } from '@/components/Screen';
import type { EditPostScreenProps } from '@/navigation/types';
import { getPost } from '@/services/posts';
import { storage, toUserMessage } from '@/services/supabase';
import { useAppTheme } from '@/theme';

import { CreatePostProvider } from '../forms/CreatePostProvider';
import { CreateNavigator } from '../navigation/CreateNavigator';
import type { CreatePostFormValues } from '../schemas/createPostSchema';

/**
 * Экран редактирования поста. Тянет пост, строит предзаполнение и отдаёт тот же
 * мастер (`CreatePostProvider` + `CreateNavigator`) в режиме `postId` — на
 * последнем шаге submit уходит в `updatePostWithMedia`.
 */
export default function EditPostScreen({ route }: EditPostScreenProps) {
  const { postId } = route.params;
  const theme = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const [initialValues, setInitialValues] = useState<Partial<CreatePostFormValues> | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const post = await getPost(postId);
        if (!post) throw new Error('Пост не найден.');
        const media = [...post.post_media].sort((a, b) => a.sort_order - b.sort_order);
        const urls = await storage.getPostMediaUrls(media.map((m) => m.storage_path));
        if (!active) return;
        setInitialValues({
          postTypeCode:
            post.post_types?.code === 'question' ? 'question' : 'field_update',
          stageCode:
            post.post_stages?.code === 'sprouting' ||
            post.post_stages?.code === 'flowering' ||
            post.post_stages?.code === 'problem' ||
            post.post_stages?.code === 'harvest'
              ? post.post_stages.code
              : 'sowing',
          statusCode:
            post.post_statuses?.code === 'solved' ||
            post.post_statuses?.code === 'closed'
              ? post.post_statuses.code
              : 'open',
          title: post.title ?? '',
          body: post.body ?? '',
          fieldId: post.field_id,
          photos: media
            .filter((m) => urls[m.storage_path])
            .map((m) => ({
              kind: 'existing' as const,
              id: m.id,
              storagePath: m.storage_path,
              url: urls[m.storage_path],
              mediaType: m.media_type,
            })),
        });
      } catch (cause) {
        if (active) setError(toUserMessage(cause));
      }
    })();
    return () => {
      active = false;
    };
  }, [postId]);

  if (error) {
    return (
      <Screen>
        <Text style={styles.stateText}>{error}</Text>
      </Screen>
    );
  }

  if (!initialValues) {
    return (
      <Screen>
        <ActivityIndicator style={styles.loader} />
      </Screen>
    );
  }

  return (
    <CreatePostProvider initialValues={initialValues} postId={postId}>
      <CreateNavigator />
    </CreatePostProvider>
  );
}

const makeStyles = (theme: MD3Theme) =>
  StyleSheet.create({
    loader: {
      marginTop: 48,
    },
    stateText: {
      color: theme.colors.onSurfaceVariant,
      fontSize: 15,
      textAlign: 'center',
      marginTop: 48,
      paddingHorizontal: 24,
    },
  });
