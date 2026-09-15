import { FavoritePosts } from '../components/FavoritePosts';
import { PulseButton as Button } from '@/components/PulseButton';

import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Image, Modal, ScrollView, StyleSheet, View } from 'react-native';
import {
  ActivityIndicator,
  
  Divider,
  IconButton,
  List,
  Snackbar,
  Text,
  type MD3Theme,
} from 'react-native-paper';

import * as ImagePicker from 'expo-image-picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { updateProfile } from '@/services/profile';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { PostCard } from '@/components/PostCard';
import { ProfileInfo } from '@/components/ProfileInfo';
import { useFields } from '@/hooks/useFields';
import { useReactions } from '@/hooks/useReactions';
import type { ProfileScreenProps } from '@/navigation/types';
import { useAuth } from '@/services/auth';
import { deleteField, type Field } from '@/services/fields';
import { deletePost } from '@/services/posts';
import { toggleReactionSummary } from '@/services/reactions';
import { storage, toUserMessage } from '@/services/supabase';
import { useAppTheme } from '@/theme';

import { ProfileHeader } from '../components/ProfileHeader';
import {
  ProfileSectionTabs,
  type ProfileSection,
} from '../components/ProfileSectionTabs';
import { useUserPosts } from '../hooks/useUserPosts';

/** Подсказки для незаполненных полей своего профиля. */
const OWN_PROFILE_PLACEHOLDERS = {
  name: 'Укажите имя',
  specialization: 'Укажите специализацию',
  region: 'Укажите регион',
};

/**
 * Вкладка «Профиль»: своя шапка (уведомления / @имя / настройки), карточка
 * профиля (общий компонент `ProfileInfo`, данные из строки `profiles`) и
 * переключатель секций «Мои посты / Закладки / Мои поля». «Мои посты» — реальные
 * посты автора из ленты (`useUserPosts`) с реакциями и счётчиком комментариев;
 * «Мои поля» — строки `fields`, которые правятся на вкладке «Карта».
 *
 * Экран не обёрнут в `Screen`: у него фиксированная шапка (`AppHeader` через
 * `ProfileHeader`) над скроллом — верхнюю safe-area врезку даёт она, нижнюю — таб-бар.
 */
export default function ProfileScreen({ navigation, route }: ProfileScreenProps) {
  const theme = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { user, profile, refreshProfile } = useAuth();
  const [avatarOpen, setAvatarOpen] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [section, setSection] = useState<ProfileSection>('posts');
  const { posts, setPosts, loading, error, reload, syncItem } = useUserPosts(user?.id);
  const { setReaction } = useReactions();
  const {
    fields,
    loading: fieldsLoading,
    error: fieldsError,
    reload: reloadFields,
  } = useFields();

  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [pendingDeleteField, setPendingDeleteField] = useState<Field | null>(null);
  const [deletingField, setDeletingField] = useState(false);
  /** Транзиентные сообщения: ошибка реакции, «Поле удалено» и т.п. */
  const [notice, setNotice] = useState<string | null>(null);
  /** id поста, открытого в PostDetail/EditPost — перечитываем его при возврате. */
  const openedRef = useRef<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      // Вернулись с PostDetail/EditPost — точечно обновляем один пост.
      const openedId = openedRef.current;
      openedRef.current = null;
      if (openedId) void syncItem(openedId);
      // После создания поста (мастер «+» уводит сюда) — полный reload: новый
      // пост точечно не подтянуть.
      if (route.params?.refresh) {
        void reload();
        navigation.setParams({ refresh: undefined });
      }
      // Поля — маленький список без пагинации, освежаем всегда (правка на карте).
      void reloadFields();
    }, [syncItem, reload, reloadFields, route.params?.refresh, navigation]),
  );

  const openPost = useCallback(
    (postId: string) => {
      openedRef.current = postId;
      navigation.navigate('PostDetail', { postId });
    },
    [navigation],
  );

  const editPost = useCallback(
    (postId: string) => {
      openedRef.current = postId;
      navigation.navigate('EditPost', { postId });
    },
    [navigation],
  );

  const closeDeleteDialog = useCallback(() => {
    setPendingDeleteId(null);
    setDeleteError(null);
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (!pendingDeleteId) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deletePost(pendingDeleteId);
      await reload();
      setPendingDeleteId(null);
    } catch (cause) {
      setNotice('Не удалось удалить. Попробуйте ещё раз.');
    } finally {
      setDeleting(false);
    }
  }, [pendingDeleteId, reload]);

  const handleToggleReaction = (_postId: string, _code: string) => {};

  const confirmDeleteField = useCallback(async () => {
    if (!pendingDeleteField) return;
    setDeletingField(true);
    setDeleteError(null);
    try {
      await deleteField(pendingDeleteField.id);
      setPendingDeleteField(null);
      setNotice('Поле удалено');
      await reloadFields();
    } catch (cause) {
      setNotice('Не удалось удалить. Попробуйте ещё раз.');
    } finally {
      setDeletingField(false);
    }
  }, [pendingDeleteField, reloadFields]);

  /**
   * Переход к полю на карту. Параметры чистим явно даже когда поля нет: таб
   * помнит их между переходами, и без этого «Добавить поле» унесло бы к
   * последнему открытому. Общий колбэк для секции «Мои поля» и кнопки
   * «На карте» на постах.
   */
  const openOnMap = useCallback(
    (fieldId: string | null, withCard: boolean) => {
      navigation.navigate('Map', {
        focusFieldId: fieldId ?? undefined,
        openCard: fieldId ? withCard : undefined,
      });
    },
    [navigation],
  );

  async function changeAvatar() {
    if (!user || avatarBusy) return;
    setAvatarBusy(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.8 });
      if (result.canceled) return;
      const asset = result.assets[0];
      const mime = asset.mimeType ?? 'image/jpeg';
      if (mime !== 'image/jpeg' && mime !== 'image/png' && mime !== 'image/webp') { setNotice('Выберите фото JPG, PNG или WebP.'); return; }
      const path = await storage.uploadAvatar(user.id, asset.uri, mime);
      try { await updateProfile(user.id, { avatar_path: path }); }
      catch (error) { const { supabase } = await import('@/services/supabase'); await supabase.storage.from('avatars').remove([path]); throw error; }
      await refreshProfile();
      setNotice('Фото обновлено');
    } catch { setNotice('Не удалось обновить фото. Попробуйте ещё раз.'); }
    finally { setAvatarBusy(false); }
  }

  const avatarUrl = profile?.avatar_path
    ? storage.getAvatarUrl(profile.avatar_path)
    : undefined;

  return (
    <View style={styles.root}>
      <ProfileHeader />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <ProfileInfo
          profile={{
            name: profile?.name ?? undefined,
            specialization: profile?.specialization ?? undefined,
            region: profile?.region ?? undefined,
            avatarUrl,
          }}
          placeholders={OWN_PROFILE_PLACEHOLDERS}
          onAvatarPress={() => avatarUrl ? setAvatarOpen(true) : void changeAvatar()}
        />
        <Button icon="camera-outline" loading={avatarBusy} disabled={avatarBusy} onPress={() => void changeAvatar()} style={{ alignSelf: 'center' }}>Обновить портрет</Button>
        <ProfileSectionTabs value={section} onChange={setSection} />

        <View style={styles.section}>
          {section === 'bookmarks' ? (
            <FavoritePosts onOpen={openPost} onMap={id => openOnMap(id, false)} />
          ) : section === 'fields' ? (
            <FieldsSection
              fields={fields}
              loading={fieldsLoading}
              error={fieldsError}
              styles={styles}
              errorColor={theme.colors.error}
              onOpen={openOnMap}
              onDelete={setPendingDeleteField}
            />
          ) : error && posts.length === 0 ? (
            <Text style={styles.stateText}>Не удалось загрузить данные</Text>
          ) : loading && posts.length === 0 ? (
            <ActivityIndicator style={styles.loader} />
          ) : posts.length === 0 ? (
            <Text style={styles.stateText}>Постов пока нет</Text>
          ) : (
            // .map, а не FlatList — список внутри ScrollView. Заменить на FlatList,
            // когда постов станет много / появится пагинация.
            posts.map((post) => (
              <PostCard
                key={post.id}
                author={post.author}
                ownPost
                title={post.title}
                description={post.description}
                images={post.images}
                postTypeCode={post.postTypeCode}
                stageCode={post.stageCode}
                stageName={post.stageName}
                statusCode={post.statusCode}
                statusName={post.statusName}
                isSos={post.isSos}
                onPress={() => openPost(post.id)}
                reactions={post.reactions}
                onToggleReaction={(code) => handleToggleReaction(post.id, code)}
                commentCount={post.commentCount}
                onComment={() => openPost(post.id)}
                onEdit={() => editPost(post.id)}
                onDelete={() => {
                  setDeleteError(null);
                  setPendingDeleteId(post.id);
                }}
                onMap={post.fieldId ? () => openOnMap(post.fieldId, false) : undefined}
              />
            ))
          )}
        </View>
      </ScrollView>

      <Modal visible={avatarOpen} animationType="fade" onRequestClose={() => setAvatarOpen(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: '#10251E' }}>
          <IconButton icon="close" iconColor="white" accessibilityLabel="Закрыть фото" onPress={() => setAvatarOpen(false)} />
          {avatarUrl ? <Image source={{ uri: avatarUrl }} resizeMode="contain" style={{ flex: 1, width: '100%' }} /> : null}
          <Button textColor="white" icon="camera-outline" onPress={() => { setAvatarOpen(false); void changeAvatar(); }}>Изменить фото</Button>
        </SafeAreaView>
      </Modal>
      <ConfirmDialog
        visible={pendingDeleteId !== null}
        title="Удалить пост?"
        message="Это действие нельзя отменить."
        confirmLabel="Удалить"
        destructive
        loading={deleting}
        error={deleteError}
        onConfirm={handleConfirmDelete}
        onCancel={closeDeleteDialog}
      />

      <ConfirmDialog
        visible={pendingDeleteField !== null}
        icon="trash-can-outline"
        title="Удалить поле?"
        message={`«${pendingDeleteField?.name ?? ''}» будет удалено безвозвратно.`}
        confirmLabel="Удалить"
        destructive
        loading={deletingField}
        error={deleteError}
        onConfirm={confirmDeleteField}
        onCancel={() => {
          setPendingDeleteField(null);
          setDeleteError(null);
        }}
      />

      <Snackbar
        visible={notice !== null}
        onDismiss={() => setNotice(null)}
        duration={4000}
      >
        {notice ?? ''}
      </Snackbar>
    </View>
  );
}

type FieldsSectionProps = {
  fields: Field[];
  loading: boolean;
  error: string | null;
  styles: ReturnType<typeof makeStyles>;
  errorColor: string;
  onOpen: (fieldId: string | null, withCard: boolean) => void;
  onDelete: (field: Field) => void;
};

/** Секция «Мои поля»: список, переход на карту и удаление. */
function FieldsSection({
  fields,
  loading,
  error,
  styles,
  errorColor,
  onOpen,
  onDelete,
}: FieldsSectionProps) {
  if (error) return <Text style={styles.stateText}>Не удалось загрузить данные</Text>;
  if (loading && fields.length === 0) return <ActivityIndicator style={styles.loader} />;

  if (fields.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>
          Здесь будут ваши поля.
        </Text>
        <Button
          mode="contained"
          icon="plus"
          onPress={() => onOpen(null, false)}
          accessibilityLabel="Добавить поле на карте"
        >
          Добавить участок
        </Button>
      </View>
    );
  }

  return (
    <View>
      <View style={styles.fieldsHeader}>
        <IconButton
          icon="plus"
          size={20}
          onPress={() => onOpen(null, false)}
          accessibilityLabel="Добавить поле на карте"
        />
      </View>
      {fields.map((field) => (
        <View key={field.id} style={{ marginHorizontal: 16, marginBottom: 10, borderRadius: 20, backgroundColor: 'white', padding: 6 }}>
          <List.Item
            title={field.name}
            description={describe(field)}
            onPress={() => onOpen(field.id, false)}
            right={() => (
              <View style={styles.itemActions}>
                <IconButton
                  icon="pencil-outline"
                  size={20}
                  onPress={() => onOpen(field.id, true)}
                  accessibilityLabel={`Редактировать поле ${field.name}`}
                />
                <IconButton
                  icon="trash-can-outline"
                  size={20}
                  iconColor={errorColor}
                  onPress={() => onDelete(field)}
                  accessibilityLabel={`Удалить поле ${field.name}`}
                />
              </View>
            )}
          />
        </View>
      ))}
    </View>
  );
}

/** Вторая строка в списке: чем поле описано, тем и описываем. */
function describe(field: Field): string {
  const details = [
    field.region,
    field.currentCrop?.name,
    field.currentStage?.name,
  ].filter((value): value is string => typeof value === 'string' && value.length > 0);
  return details.join(' · ');
}

const makeStyles = (theme: MD3Theme) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    content: {
      flexGrow: 1,
      paddingBottom: 24,
    },
    section: {
      flex: 1,
    },
    loader: {
      marginTop: 32,
    },
    stateText: {
      color: theme.colors.onSurfaceVariant,
      fontSize: 16,
      textAlign: 'center',
      marginTop: 32,
      paddingHorizontal: 24,
    },
    fieldsHeader: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      paddingRight: 4,
    },
    itemActions: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    empty: {
      alignItems: 'center',
      gap: 16,
      marginTop: 32,
      paddingHorizontal: 24,
    },
    emptyText: {
      color: theme.colors.onSurfaceVariant,
      fontSize: 16,
      lineHeight: 22,
      textAlign: 'center',
    },
  });
