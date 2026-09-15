
import { useEffect, useState } from 'react';
import { useFormContext } from 'react-hook-form';
import { StyleSheet, View } from 'react-native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { HelperText, Text } from 'react-native-paper';

import { Icon } from '@/components/Icon';
import { PostCard } from '@/components/PostCard';
import { useFields } from '@/hooks/useFields';
import type {
  CreatePreviewScreenProps,
  RootTabParamList,
} from '@/navigation/types';
import { useAuth } from '@/services/auth';
import { createPostWithMedia, updatePostWithMedia } from '@/services/posts';
import { storage, toUserMessage } from '@/services/supabase';
import { useAppTheme } from '@/theme';

import { CreateStepLayout } from '../../components/CreateStepLayout';
import { useCreatePostMeta } from '../../forms/CreatePostProvider';
import type { CreatePostFormValues } from '../../schemas/createPostSchema';

export default function CreatePreviewScreen({
  navigation,
}: CreatePreviewScreenProps) {
  const theme = useAppTheme();
  const { user, profile } = useAuth();
  const { postId } = useCreatePostMeta();
  const isEdit = postId !== null;
  const { handleSubmit, formState, reset, getValues } =
    useFormContext<CreatePostFormValues>();
  const [error, setError] = useState<string | null>(null);
  const { fields, reload: reloadFields } = useFields();
  // Список полей грузится только тут: шаг 4 держит свою копию хука и не
  // делится состоянием с этим экраном.
  useEffect(() => {
    void reloadFields();
  }, [reloadFields]);

  // Значения уже собраны на прошлых шагах и на этом экране не меняются —
  // снимок через getValues достаточно.
  const values = getValues();
  const selectedField = fields.find((field) => field.id === values.fieldId) ?? null;
  const avatarUrl = profile?.avatar_path
    ? storage.getAvatarUrl(profile.avatar_path)
    : undefined;

  const submit = handleSubmit(async (data) => {
    if (!user) {
      setError('Сессия не найдена. Войдите заново.');
      return;
    }
    setError(null);
    const input = {
      postTypeCode: data.postTypeCode,
      stageCode: data.stageCode,
      statusCode: data.statusCode,
      title: data.title,
      body: data.body,
      fieldId: data.fieldId,
    };
    const newPhotos = data.photos
      .filter((photo) => photo.kind === 'new')
      .map((photo) => ({ uri: photo.uri, mimeType: photo.mimeType }));

    try {
      if (isEdit) {
        await updatePostWithMedia(postId, user.id, input, {
          newPhotos,
          keepMediaIds: data.photos
            .filter((photo) => photo.kind === 'existing')
            .map((photo) => photo.id),
        });
        // Родитель мастера — стек профиля; закрываем экран EditPost.
        navigation.getParent()?.goBack();
        return;
      }

      await createPostWithMedia(user.id, input, newPhotos);
      reset();
      // Родитель мастера — таб-навигатор; уводим на «Профиль», где виден пост.
      // `refresh: true` — чтобы лента «Мои посты» перечитала и показала новый.
      navigation
        .getParent<BottomTabNavigationProp<RootTabParamList>>()
        ?.navigate('Profile', { refresh: true });
      navigation.popToTop();
    } catch (cause) {
      setError(toUserMessage(cause));
    }
  });

  return (
    <CreateStepLayout
      step={5}
      title={isEdit ? 'Проверьте изменения' : 'Проверьте пост'}
      subtitle="Так он будет выглядеть в ленте."
      onBack={navigation.goBack}
      onNext={submit}
      nextLabel={isEdit ? 'Сохранить' : 'Опубликовать'}
      nextLoading={formState.isSubmitting}
    >
      <View style={styles.previewWrap}>
        <PostCard
          author={{ nickname: profile?.name ?? 'вы', avatarUrl }}
          title={values.title}
          description={values.body || undefined}
          images={values.photos.map((photo) =>
            photo.kind === 'new' ? photo.uri : photo.url,
          )}
          postTypeCode={values.postTypeCode}
          stageCode={values.stageCode}
          stageName={STAGE_LABELS[values.stageCode]}
          statusCode={values.statusCode}
          statusName={STATUS_LABELS[values.statusCode]}
        />
      </View>
      {selectedField ? (
        <View style={styles.fieldRow}>
          <Icon name="map-marker-outline" size={16} color={theme.colors.onSurfaceVariant} />
          <Text style={[styles.fieldText, { color: theme.colors.onSurfaceVariant }]}>
            {selectedField.name}
          </Text>
        </View>
      ) : null}
      {error ? (
        <HelperText type="error" visible style={styles.error}>
          {error}
        </HelperText>
      ) : null}
    </CreateStepLayout>
  );
}

const styles = StyleSheet.create({
  previewWrap: {
    marginHorizontal: -24,
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
  },
  fieldText: {
    fontSize: 13,
  },
  error: {
    paddingHorizontal: 0,
  },
});

const STAGE_LABELS = {
  sowing: 'Посев',
  sprouting: 'Всходы',
  flowering: 'Цветение',
  problem: 'Проблема',
  harvest: 'Урожай',
} as const;

const STATUS_LABELS = {
  open: 'Открыт',
  solved: 'Решён',
  closed: 'Закрыт',
} as const;
