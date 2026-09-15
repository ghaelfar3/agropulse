import { PulseButton as Button } from '@/components/PulseButton';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import {  IconButton, Snackbar, Text, type MD3Theme } from 'react-native-paper';

import { AppHeader } from '@/components/AppHeader';
import { Icon } from '@/components/Icon';
import { SelectMenu } from '@/components/SelectMenu';
import { PostStageToggle } from '@/features/create/components/PostTypeToggle';
import type { CreatePostFormValues } from '@/features/create/schemas/createPostSchema';
import { useFields } from '@/hooks/useFields';
import type { SosScreenProps } from '@/navigation/types';
import { useAuth } from '@/services/auth';
import { createPostWithMedia } from '@/services/posts';
import { useAppTheme } from '@/theme';

import {
  getOfflineObservations,
  removeOfflineObservation,
  saveOfflineObservation,
  updateOfflineObservation,
  type OfflineObservation,
} from '../services/offlineObservations';
import { formatObservationWithAi } from '../services/formatObservation';
import { generatePostDraft } from '../services/generatePostDraft';

type VoiceStage = CreatePostFormValues['stageCode'];

type VoiceDraft = {
  title: string;
  body: string;
  fieldId: string | null;
  stageCode: VoiceStage;
  fieldName: string | null;
  stageName: string | null;
};

export default function SosScreen({ navigation }: SosScreenProps) {
  const theme = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { user } = useAuth();
  const { fields, loading: fieldsLoading, reload: reloadFields } = useFields();
  const voiceInputRef = useRef<TextInput>(null);
  const audioRecorder = useAudioRecorder(RecordingPresets.LOW_QUALITY);
  const recorderState = useAudioRecorderState(audioRecorder, 250);
  const [note, setNote] = useState('');
  const [voiceText, setVoiceText] = useState('');
  const [voiceDraft, setVoiceDraft] = useState<VoiceDraft | null>(null);
  const [voiceAudioUri, setVoiceAudioUri] = useState<string | null>(null);
  const [selectedVoiceFieldId, setSelectedVoiceFieldId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<OfflineObservation[]>([]);
  const [capturing, setCapturing] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [formattingId, setFormattingId] = useState<string | null>(null);
  const [generatingVoiceDraft, setGeneratingVoiceDraft] = useState(false);
  const [publishingVoiceDraft, setPublishingVoiceDraft] = useState(false);
  const [aiStatus, setAiStatus] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    void getOfflineObservations().then(setDrafts);
  }, []);

  useEffect(() => {
    void reloadFields();
  }, [reloadFields]);

  const toggleVoiceRecording = useCallback(async () => {
    if (recorderState.isRecording) {
      try {
        await audioRecorder.stop();
        setVoiceAudioUri(audioRecorder.uri);
        setAiStatus('Аудио готово.');
      } catch (cause) {
        setNotice('Не удалось сохранить запись.');
      }
      return;
    }

    try {
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) {
        setNotice('Нужен доступ к микрофону.');
        return;
      }

      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });
      setVoiceAudioUri(null);
      await audioRecorder.prepareToRecordAsync({
        ...RecordingPresets.LOW_QUALITY,
        directory: 'document',
        isMeteringEnabled: true,
      });
      audioRecorder.record();
      setAiStatus('Идёт запись…');
    } catch (cause) {
      setNotice('Не удалось начать запись.');
    }
  }, [audioRecorder, recorderState.isRecording]);

  const selectVoiceField = useCallback(
    (fieldId: string | null) => {
      setSelectedVoiceFieldId(fieldId);
      setVoiceDraft((current) =>
        current
          ? {
              ...current,
              fieldId,
              fieldName: fields.find((field) => field.id === fieldId)?.name ?? null,
            }
          : current,
      );
    },
    [fields],
  );

  const buildVoiceDraft = useCallback(async () => {
    const text = voiceText.trim();
    if (!text) {
      setNotice('Сначала надиктуйте или введите описание проблемы.');
      voiceInputRef.current?.focus();
      return;
    }

    setGeneratingVoiceDraft(true);
    setAiStatus('Обрабатываем…');
    try {
      const response = await generatePostDraft({
        text,
        field_id: selectedVoiceFieldId,
      });
      const stageCode = asPostStage(response.display.stage?.code) ?? 'problem';
      const fieldId = response.draft.field_id;
      setVoiceDraft({
        title: response.draft.title,
        body: response.draft.body,
        fieldId,
        stageCode,
        fieldName: response.display.field_name,
        stageName: response.display.stage?.name ?? null,
      });
      setSelectedVoiceFieldId(fieldId);
      setAiStatus('Готово. Проверьте черновик.');
    } catch (cause) {
      setAiStatus(null);
      setNotice('Не удалось обработать.');
    } finally {
      setGeneratingVoiceDraft(false);
    }
  }, [selectedVoiceFieldId, voiceText]);

  const publishVoiceDraft = useCallback(async () => {
    if (!user) {
      setNotice('Сессия не найдена. Войдите заново.');
      return;
    }
    if (!voiceDraft) return;
    if (!voiceDraft.title.trim()) {
      setNotice('Введите заголовок SOS-поста.');
      return;
    }

    setPublishingVoiceDraft(true);
    try {
      await createPostWithMedia(
        user.id,
        {
          postTypeCode: 'question',
          stageCode: voiceDraft.stageCode,
          statusCode: 'open',
          title: voiceDraft.title,
          body: voiceDraft.body,
          fieldId: voiceDraft.fieldId,
        },
        [],
      );
      setVoiceDraft(null);
      setVoiceText('');
      setVoiceAudioUri(null);
      setSelectedVoiceFieldId(null);
      setNotice('SOS-пост опубликован из голосовой заметки.');
      navigation.navigate('Profile', { refresh: true });
    } catch (cause) {
      setNotice('Не удалось опубликовать.');
    } finally {
      setPublishingVoiceDraft(false);
    }
  }, [navigation, user, voiceDraft]);

  const captureObservation = useCallback(async () => {
    setCapturing(true);
    try {
      const camera = await ImagePicker.requestCameraPermissionsAsync();
      if (!camera.granted) {
        setNotice('Нужен доступ к камере, чтобы сохранить наблюдение.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 0.8,
      });
      if (result.canceled || result.assets.length === 0) return;

      let savedLocation: OfflineObservation['location'] = null;
      const locationPermission = await Location.requestForegroundPermissionsAsync();
      if (locationPermission.granted) {
        try {
          const position = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          savedLocation = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy ?? null,
          };
        } catch {
          savedLocation = null;
        }
      }

      const asset = result.assets[0];
      const next = await saveOfflineObservation({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        photoUri: asset.uri,
        note: note.trim(),
        formatted: null,
        ai: null,
        createdAt: new Date().toISOString(),
        location: savedLocation,
      });
      setDrafts(next);
      setNote('');
      setNotice('Наблюдение сохранено офлайн.');
    } catch (cause) {
      setNotice('Не удалось сохранить наблюдение.');
    } finally {
      setCapturing(false);
    }
  }, [note]);

  const publishDraft = useCallback(
    async (draft: OfflineObservation) => {
      if (!user) {
        setNotice('Сессия не найдена. Войдите заново.');
        return;
      }

      setSyncingId(draft.id);
      try {
        await createPostWithMedia(
          user.id,
          {
            postTypeCode: 'question',
            stageCode: 'problem',
            statusCode: 'open',
            title: buildTitle(draft),
            body: buildBody(draft),
            fieldId: null,
          },
          [{ uri: draft.photoUri, mimeType: 'image/jpeg' }],
        );
        const next = await removeOfflineObservation(draft.id);
        setDrafts(next);
        setNotice('SOS-наблюдение опубликовано.');
        navigation.navigate('Profile', { refresh: true });
      } catch (cause) {
        setNotice('Не удалось отправить.');
      } finally {
        setSyncingId(null);
      }
    },
    [navigation, user],
  );

  const deleteDraft = useCallback(async (id: string) => {
    setDrafts(await removeOfflineObservation(id));
  }, []);

  const formatDraft = useCallback(async (draft: OfflineObservation) => {
    setFormattingId(draft.id);
    setAiStatus('Обрабатываем…');
    try {
      const result = await formatObservationWithAi(draft);
      const next = await updateOfflineObservation(draft.id, {
        formatted: result.formatted,
        ai: {
          formattedAt: new Date().toISOString(),
          usage: result.usage,
        },
      });
      setDrafts(next);
      setAiStatus('Готово.');
      setNotice('Черновик оформлен.');
    } catch (cause) {
      setAiStatus(null);
      setNotice('Не удалось оформить.');
    } finally {
      setFormattingId(null);
    }
  }, []);

  return (
    <View style={styles.root}>
      <AppHeader title="SOS" />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.badge}>
          <Icon name="lifebuoy" size={42} color={theme.colors.primary} />
        </View>
        <Text style={styles.title}>Нужен совет по полю?</Text>

        <View style={styles.voiceCard}>
          <Text style={styles.quickTitle}>Голос → готовый SOS-пост</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Начать голосовую диктовку SOS"
            style={({ pressed }) => [
              styles.micButton,
              recorderState.isRecording ? styles.micButtonRecording : null,
              pressed ? { transform: [{ scale: 0.98 }] } : null,
            ]}
            onPress={() => void toggleVoiceRecording()}
          >
            <Icon
              name={recorderState.isRecording ? 'stop-circle-outline' : 'microphone-outline'}
              size={46}
              color={theme.colors.onPrimary}
            />
            <Text style={styles.micButtonText}>
              {recorderState.isRecording ? 'Остановить' : 'Записать'}
            </Text>
          </Pressable>
          <Text style={styles.recordingStatus}>
            {recorderState.isRecording
              ? `Запись: ${formatDuration(recorderState.durationMillis)}`
              : voiceAudioUri
                ? 'Аудио записано.'
                : 'Нажмите, чтобы записать.'}
          </Text>
          <TextInput
            ref={voiceInputRef}
            value={voiceText}
            onChangeText={setVoiceText}
            placeholder="Опишите проблему"
            placeholderTextColor={theme.colors.onSurfaceVariant}
            multiline
            style={styles.voiceInput}
          />
          <SelectMenu
            label="Поле"
            value={selectedVoiceFieldId}
            options={[
              { value: null, label: 'Поле из текста' },
              ...fields.map((field) => ({ value: field.id, label: field.name })),
            ]}
            onChange={selectVoiceField}
          />
          {fieldsLoading ? <Text style={styles.guideItemText}>Загружаю поля...</Text> : null}
          <Button
            mode="contained"
            icon="auto-fix"
            loading={generatingVoiceDraft}
            disabled={generatingVoiceDraft || publishingVoiceDraft}
            contentStyle={styles.buttonContent}
            onPress={() => void buildVoiceDraft()}
          >
            Обработать
          </Button>
        </View>

        {voiceDraft ? (
          <View style={styles.voiceDraftCard}>
            <Text style={styles.guideTitle}>Черновик SOS</Text>
            <Text style={styles.inputLabel}>Заголовок</Text>
            <TextInput
              value={voiceDraft.title}
              onChangeText={(title) => setVoiceDraft((current) => current ? { ...current, title } : current)}
              placeholder="Заголовок SOS-поста"
              placeholderTextColor={theme.colors.onSurfaceVariant}
              style={styles.singleInput}
            />
            <Text style={styles.inputLabel}>Описание</Text>
            <TextInput
              value={voiceDraft.body}
              onChangeText={(body) => setVoiceDraft((current) => current ? { ...current, body } : current)}
              placeholder="Описание проблемы"
              placeholderTextColor={theme.colors.onSurfaceVariant}
              multiline
              style={styles.voiceInput}
            />
            <Text style={styles.inputLabel}>Этап</Text>
            <PostStageToggle
              value={voiceDraft.stageCode}
              onChange={(stageCode) =>
                setVoiceDraft((current) => current ? { ...current, stageCode } : current)
              }
            />
            <Text style={styles.guideItemText}>
              Поле: {voiceDraft.fieldName ?? 'не выбрано'}
            </Text>
            <View style={styles.draftActions}>
              <Button
                mode="outlined"
                compact
                disabled={publishingVoiceDraft || generatingVoiceDraft}
                onPress={() => setVoiceDraft(null)}
              >
                Сбросить
              </Button>
              <Button
                mode="contained"
                compact
                loading={publishingVoiceDraft}
                disabled={publishingVoiceDraft || generatingVoiceDraft}
                onPress={() => void publishVoiceDraft()}
              >
                Опубликовать SOS
              </Button>
            </View>
          </View>
        ) : null}

        <View style={styles.quickCard}>
          <Text style={styles.quickTitle}>Сфоткал → сохранил офлайн</Text>
          <Text style={styles.quickText}>
            Заметку можно написать коротко: культура, поле, симптом и примерная
            площадь. Фото, дата и GPS сохранятся в черновик.
          </Text>
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="Например: рапс, северное поле, пятна на 15% площади"
            placeholderTextColor={theme.colors.onSurfaceVariant}
            multiline
            style={styles.noteInput}
          />
          <Button
            mode="contained"
            icon="camera-outline"
            loading={capturing}
            disabled={capturing}
            contentStyle={styles.buttonContent}
            onPress={() => void captureObservation()}
          >
            Сфоткать наблюдение
          </Button>
        </View>
        {aiStatus ? (
          <View style={styles.aiStatus}>
            <Icon name="robot-outline" size={20} color={theme.colors.primary} />
            <Text style={styles.aiStatusText}>{aiStatus}</Text>
          </View>
        ) : null}
        <Button
          mode="contained"
          icon="plus-circle-outline"
          contentStyle={styles.buttonContent}
          onPress={() => navigation.navigate('Create', { intent: 'sos' })}
        >
          Создать SOS-пост вручную
        </Button>
        {drafts.length > 0 ? (
          <View style={styles.guide}>
            <Text style={styles.guideTitle}>Офлайн-черновики</Text>
            {drafts.map((draft) => (
              <View key={draft.id} style={styles.draft}>
                <Image
                  source={{ uri: draft.photoUri }}
                  style={styles.draftImage}
                  accessibilityIgnoresInvertColors
                />
                <View style={styles.draftBody}>
                  <Text style={styles.guideItemTitle}>{formatDate(draft.createdAt)}</Text>
                  <Text style={styles.guideItemText} numberOfLines={3}>
                    {draft.note || 'Без текстовой заметки'}
                  </Text>
                  <Text style={styles.guideItemText}>
                    {draft.location
                      ? `${draft.location.latitude.toFixed(5)}, ${draft.location.longitude.toFixed(5)}`
                      : 'GPS не сохранён'}
                  </Text>
                  {draft.formatted ? (
                    <View style={styles.formatted}>
                      <Text style={styles.formattedTitle}>{draft.formatted.title}</Text>
                      <Text style={styles.formattedText} numberOfLines={5}>
                        {draft.formatted.body}
                      </Text>
                    </View>
                  ) : null}
                  <View style={styles.draftActions}>
                    <Button
                      mode="outlined"
                      compact
                      loading={formattingId === draft.id}
                      disabled={formattingId !== null || syncingId !== null}
                      onPress={() => void formatDraft(draft)}
                    >
                      {formattingId === draft.id ? 'Обрабатываем…' : 'Оформить'}
                    </Button>
                    <Button
                      mode="contained-tonal"
                      compact
                      loading={syncingId === draft.id}
                      disabled={syncingId !== null || formattingId !== null}
                      onPress={() => void publishDraft(draft)}
                    >
                      Отправить
                    </Button>
                    <IconButton
                      icon="trash-can-outline"
                      size={20}
                      disabled={syncingId !== null || formattingId !== null}
                      onPress={() => void deleteDraft(draft.id)}
                      accessibilityLabel="Удалить черновик"
                    />
                  </View>
                </View>
              </View>
            ))}
          </View>
        ) : null}
        <View style={styles.guide}>
          <Text style={styles.guideTitle}>Памятка без интернета</Text>
          {FIELD_GUIDES.map((item) => (
            <View key={item.title} style={styles.guideItem}>
              <Icon name={item.icon} size={20} color={theme.colors.primary} />
              <View style={styles.guideTextWrap}>
                <Text style={styles.guideItemTitle}>{item.title}</Text>
                <Text style={styles.guideItemText}>{item.text}</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
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

const FIELD_GUIDES = [
  {
    icon: 'camera-outline',
    title: 'Сначала фото',
    text: 'Сними общий вид поля, крупный план листа и почву у корня. Так совет будет точнее.',
  },
  {
    icon: 'map-marker-radius-outline',
    title: 'Запомни место',
    text: 'Привяжи пост к полю или хотя бы укажи участок в тексте, пока связь нестабильна.',
  },
  {
    icon: 'weather-sunny-alert',
    title: 'Жара или засуха',
    text: 'Проверь влагу на глубине 5-10 см и отметь, меняется ли цвет листа утром и вечером.',
  },
  {
    icon: 'bug-outline',
    title: 'Вредители',
    text: 'Сфотографируй нижнюю сторону листа и границу повреждённого участка.',
  },
  {
    icon: 'sprout-outline',
    title: 'Болезнь растений',
    text: 'Не смешивай симптомы: один SOS-пост на одну проблему и одну культуру.',
  },
] as const;

const makeStyles = (theme: MD3Theme) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    content: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 28,
      paddingVertical: 32,
      gap: 18,
    },
    badge: {
      width: 92,
      height: 92,
      borderRadius: 46,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.primaryContainer,
      borderWidth: 1,
      borderColor: theme.colors.outline,
    },
    title: {
      color: theme.colors.onSurface,
      fontSize: 25,
      fontWeight: '800',
      textAlign: 'center',
    },
    text: {
      color: theme.colors.onSurfaceVariant,
      fontSize: 16,
      lineHeight: 23,
      textAlign: 'center',
    },
    buttonContent: {
      minHeight: 48,
      paddingHorizontal: 10,
    },
    voiceCard: {
      width: '100%',
      padding: 18,
      borderRadius: 18,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.primary,
      gap: 12,
    },
    micButton: {
      alignSelf: 'center',
      width: 168,
      height: 168,
      borderRadius: 84,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: theme.colors.primary,
      shadowColor: theme.colors.primary,
      shadowOpacity: 0.24,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 8 },
      elevation: 6,
    },
    micButtonRecording: {
      backgroundColor: theme.colors.error,
      shadowColor: theme.colors.error,
    },
    micButtonText: {
      color: theme.colors.onPrimary,
      fontSize: 16,
      fontWeight: '900',
    },
    recordingStatus: {
      color: theme.colors.onSurfaceVariant,
      fontSize: 13,
      lineHeight: 18,
      textAlign: 'center',
      fontWeight: '700',
    },
    quickCard: {
      width: '100%',
      padding: 16,
      borderRadius: 8,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.outline,
      gap: 12,
    },
    quickTitle: {
      color: theme.colors.onSurface,
      fontSize: 18,
      fontWeight: '800',
    },
    quickText: {
      color: theme.colors.onSurfaceVariant,
      fontSize: 14,
      lineHeight: 20,
    },
    noteInput: {
      minHeight: 86,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.colors.outline,
      paddingHorizontal: 12,
      paddingVertical: 10,
      color: theme.colors.onSurface,
      backgroundColor: theme.colors.background,
      textAlignVertical: 'top',
    },
    voiceInput: {
      minHeight: 110,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.colors.outline,
      paddingHorizontal: 12,
      paddingVertical: 10,
      color: theme.colors.onSurface,
      backgroundColor: theme.colors.background,
      textAlignVertical: 'top',
    },
    singleInput: {
      minHeight: 48,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.colors.outline,
      paddingHorizontal: 12,
      color: theme.colors.onSurface,
      backgroundColor: theme.colors.background,
    },
    inputLabel: {
      color: theme.colors.onSurface,
      fontSize: 13,
      fontWeight: '800',
    },
    fieldChips: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    fieldChip: {
      minHeight: 38,
      justifyContent: 'center',
      borderRadius: 999,
      borderWidth: 1,
      borderColor: theme.colors.outline,
      paddingHorizontal: 12,
      backgroundColor: theme.colors.background,
    },
    fieldChipActive: {
      borderColor: theme.colors.primary,
      backgroundColor: theme.colors.primaryContainer,
    },
    fieldChipText: {
      color: theme.colors.onSurfaceVariant,
      fontSize: 13,
      fontWeight: '700',
    },
    fieldChipTextActive: {
      color: theme.colors.onPrimaryContainer,
    },
    voiceDraftCard: {
      width: '100%',
      padding: 14,
      borderRadius: 8,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.primary,
      gap: 10,
    },
    metaText: {
      color: theme.colors.onSurfaceVariant,
      fontSize: 12,
      lineHeight: 17,
    },
    warningText: {
      color: theme.colors.error,
      fontSize: 12,
      lineHeight: 17,
      fontWeight: '700',
    },
    aiStatus: {
      width: '100%',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      padding: 12,
      borderRadius: 8,
      backgroundColor: theme.colors.primaryContainer,
      borderWidth: 1,
      borderColor: theme.colors.primary,
    },
    aiStatusText: {
      flex: 1,
      color: theme.colors.onPrimaryContainer,
      fontSize: 13,
      lineHeight: 18,
      fontWeight: '700',
    },
    guide: {
      width: '100%',
      marginTop: 8,
      padding: 14,
      borderRadius: 8,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.outline,
      gap: 12,
    },
    guideTitle: {
      color: theme.colors.onSurface,
      fontSize: 17,
      fontWeight: '800',
    },
    guideItem: {
      flexDirection: 'row',
      gap: 10,
      alignItems: 'flex-start',
    },
    guideTextWrap: {
      flex: 1,
      gap: 2,
    },
    guideItemTitle: {
      color: theme.colors.onSurface,
      fontSize: 14,
      fontWeight: '700',
    },
    guideItemText: {
      color: theme.colors.onSurfaceVariant,
      fontSize: 13,
      lineHeight: 18,
    },
    draft: {
      flexDirection: 'row',
      gap: 12,
      paddingTop: 4,
    },
    draftImage: {
      width: 76,
      height: 76,
      borderRadius: 8,
      backgroundColor: theme.colors.surfaceVariant,
    },
    draftBody: {
      flex: 1,
      gap: 4,
    },
    draftActions: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
      gap: 8,
      marginTop: 4,
    },
    aiUsage: {
      color: theme.colors.primary,
      fontSize: 12,
      fontWeight: '700',
      marginTop: 2,
    },
    formatted: {
      gap: 4,
      marginTop: 6,
      padding: 10,
      borderRadius: 8,
      backgroundColor: theme.colors.primaryContainer,
    },
    formattedTitle: {
      color: theme.colors.onPrimaryContainer,
      fontSize: 13,
      fontWeight: '800',
    },
    formattedText: {
      color: theme.colors.onPrimaryContainer,
      fontSize: 12,
      lineHeight: 17,
    },
  });

function buildTitle(draft: OfflineObservation): string {
  if (draft.formatted?.title) return draft.formatted.title;
  if (!draft.note) return 'SOS: проблема в поле';
  const firstLine = draft.note.split('\n')[0]?.trim();
  if (!firstLine) return 'SOS: проблема в поле';
  return firstLine.length > 70 ? `${firstLine.slice(0, 67)}...` : firstLine;
}

function buildBody(draft: OfflineObservation): string {
  if (draft.formatted?.body) return enrichFormattedBody(draft);

  const lines = [
    draft.note || 'Нужно определить проблему по фото.',
    '',
    `Дата наблюдения: ${formatDate(draft.createdAt)}`,
  ];

  if (draft.location) {
    lines.push(
      `GPS: ${draft.location.latitude.toFixed(6)}, ${draft.location.longitude.toFixed(6)}`,
    );
    if (draft.location.accuracy !== null) {
      lines.push(`Точность GPS: около ${Math.round(draft.location.accuracy)} м`);
    }
  } else {
    lines.push('GPS: не удалось сохранить');
  }

  lines.push('', 'Создано из офлайн-наблюдения AgroPulse.');
  return lines.join('\n');
}

function enrichFormattedBody(draft: OfflineObservation): string {
  const lines = [draft.formatted?.body ?? ''];

  if (draft.formatted?.crop) lines.push('', `Культура: ${draft.formatted.crop}`);
  if (draft.formatted?.fieldName) {
    lines.push(`Поле: ${draft.formatted.fieldName}`);
  }
  if (draft.formatted?.affectedAreaPercent !== null) {
    lines.push(`Поражённая площадь: около ${draft.formatted?.affectedAreaPercent}%`);
  }
  if (draft.formatted?.questionsForAgronomists.length) {
    lines.push('', 'Вопросы агрономам:');
    for (const question of draft.formatted.questionsForAgronomists) {
      lines.push(`- ${question}`);
    }
  }

  lines.push('', `Дата наблюдения: ${formatDate(draft.createdAt)}`);
  if (draft.location) {
    lines.push(
      `GPS: ${draft.location.latitude.toFixed(6)}, ${draft.location.longitude.toFixed(6)}`,
    );
  }
  lines.push('', 'Оформлено из офлайн-наблюдения AgroPulse.');

  return lines.filter(Boolean).join('\n');
}

function asPostStage(value: string | undefined): VoiceStage | null {
  return value === 'sowing' ||
    value === 'sprouting' ||
    value === 'flowering' ||
    value === 'problem' ||
    value === 'harvest'
    ? value
    : null;
}

function formatDuration(durationMillis: number): string {
  const totalSeconds = Math.max(0, Math.floor(durationMillis / 1000));
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
  const seconds = (totalSeconds % 60).toString().padStart(2, '0');
  return `${minutes}:${seconds}`;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}
