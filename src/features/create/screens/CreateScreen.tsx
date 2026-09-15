import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { ActivityIndicator, Text } from 'react-native-paper';
import { AppHeader } from '@/components/AppHeader';
import { PulseButton } from '@/components/PulseButton';
import { readDrafts, type LocalDraft } from '@/features/drafts/draftStorage';
import { useAuth } from '@/services/auth';
import type { CreateScreenProps } from '@/navigation/types';
import { CreatePostProvider } from '../forms/CreatePostProvider';
import { CreateNavigator } from '../navigation/CreateNavigator';

export default function CreateScreen({ route, navigation }: CreateScreenProps) {
  const { user } = useAuth();
  const draftId = route.params?.draftId;
  const token = draftId ? draftId + ':' + (route.params?.openedAt ?? '') : '';
  const [loaded, setLoaded] = useState<{ token: string; draft: LocalDraft | null } | null>(null);
  useEffect(() => {
    let active = true;
    if (draftId && user) readDrafts(user.id).then(items => { if (active) setLoaded({ token, draft: items.find(d => d.id === draftId) ?? null }); }).catch(() => { if (active) setLoaded({ token, draft: null }); });
    return () => { active = false; };
  }, [draftId, token, user?.id]);
  if (draftId && loaded?.token !== token) return <View style={{ flex: 1 }}><AppHeader title="Открываем черновик" /><ActivityIndicator /></View>;
  if (draftId && !loaded?.draft) return <View style={{ flex: 1 }}><AppHeader title="Черновик" /><Text>Не удалось открыть запись.</Text><PulseButton onPress={() => navigation.navigate('Drafts')}>К черновикам</PulseButton></View>;
  const draft = draftId ? loaded?.draft ?? undefined : undefined;
  return <CreatePostProvider key={token || route.params?.intent || 'new'} localDraft={draft} initialValues={draft?.values ?? (route.params?.intent === 'sos' ? { postTypeCode: 'question', stageCode: 'problem', statusCode: 'open' } : undefined)}><CreateNavigator /></CreatePostProvider>;
}
