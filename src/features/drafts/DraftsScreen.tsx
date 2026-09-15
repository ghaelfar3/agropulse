import { useCallback, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { ActivityIndicator, IconButton, Snackbar, Text } from 'react-native-paper';
import { AppHeader } from '@/components/AppHeader';
import { PulseButton } from '@/components/PulseButton';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Icon } from '@/components/Icon';
import { useAuth } from '@/services/auth';
import { useAppTheme } from '@/theme';
import type { RootTabParamList } from '@/navigation/types';
import { deleteDraft, readDrafts, type LocalDraft } from './draftStorage';

export default function DraftsScreen({ navigation }: BottomTabScreenProps<RootTabParamList, 'Drafts'>) {
  const { user } = useAuth();
  const { colors } = useAppTheme();
  const [items, setItems] = useState<LocalDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    if (!user) { setItems([]); setLoading(false); return; }
    setLoading(true);
    try { setItems(await readDrafts(user.id)); }
    catch { setNotice('Не удалось открыть черновики.'); }
    finally { setLoading(false); }
  }, [user?.id]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  return <View style={{ flex: 1, backgroundColor: colors.background }}>
    <AppHeader title="На устройстве" />
    <ScrollView contentContainerStyle={{ padding: 20, gap: 14 }}>
      <Text style={{ fontSize: 28, fontWeight: '800' }}>Неопубликованное</Text>
      <Text style={{ color: colors.onSurfaceVariant }}>Сохранено на этом телефоне. Можно продолжить без сети.</Text>
      {loading ? <ActivityIndicator /> : null}
      {!loading && !items.length ? <View style={{ alignItems: 'center', padding: 32, gap: 14 }}><Icon name="inbox" size={40} /><Text>Здесь будут ваши черновики</Text></View> : null}
      {items.map(draft => <View key={draft.id} style={{ backgroundColor: colors.surface, padding: 18, borderRadius: 20, gap: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Icon name={draft.audioUri ? 'mic' : 'file-text'} color={colors.primary} />
          <Text numberOfLines={2} style={{ flex: 1, fontSize: 18, fontWeight: '700' }}>{draft.values.title || draft.values.body.slice(0, 70) || 'Голосовая заметка'}</Text>
          <IconButton icon="trash-can-outline" accessibilityLabel="Удалить черновик" onPress={() => setRemoving(draft.id)} />
        </View>
        <Text style={{ color: colors.onSurfaceVariant }}>{new Date(draft.updatedAt).toLocaleString('ru-RU')} · {draft.values.photos.length} фото{draft.sos ? ' · SOS' : ''}</Text>
        <Text style={{ color: colors.primary }}>{draft.audioUri && draft.mode === 'quick' ? 'Аудио ждёт обработки' : 'Черновик публикации'}</Text>
        <PulseButton mode="contained-tonal" onPress={() => navigation.navigate('Create', { draftId: draft.id, openedAt: Date.now() })}>Продолжить запись</PulseButton>
      </View>)}
    </ScrollView>
    <ConfirmDialog visible={removing !== null} title="Удалить черновик?" message="Аудио и фото этой записи будут удалены с устройства." destructive loading={busy} confirmLabel="Удалить" onCancel={() => setRemoving(null)} onConfirm={async () => {
      if (!user || !removing || busy) return;
      setBusy(true);
      try { await deleteDraft(user.id, removing); setRemoving(null); await load(); } catch { setNotice('Не удалось удалить черновик.'); } finally { setBusy(false); }
    }} />
    <Snackbar visible={notice !== null} onDismiss={() => setNotice(null)}>{notice ?? ''}</Snackbar>
  </View>;
}
