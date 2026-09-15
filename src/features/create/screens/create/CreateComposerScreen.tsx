import { saveDraft, deleteDraft } from '@/features/drafts/draftStorage';
import { PulseButton as Button } from '@/components/PulseButton';
import { PulseInput as TextInput } from '@/components/PulseInput';
import { PulseTabs as SegmentedButtons } from '@/components/PulseTabs';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Keyboard,
  TextInput as NativeTextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { useFocusEffect } from '@react-navigation/native';
import { Controller, useFormContext, useWatch } from 'react-hook-form';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import {
  
  
  Snackbar,
  Switch,
  Text,
  
  type MD3Theme,
} from 'react-native-paper';

import { AppHeader } from '@/components/AppHeader';
import { Icon } from '@/components/Icon';
import { KeyboardAwareScreen, useFieldFocus } from '@/components/KeyboardAwareScreen';
import { PostCard } from '@/components/PostCard';
import { SelectMenu } from '@/components/SelectMenu';
import {
  generatePostDraft,
  generatePostDraftFromAudio,
  type GeneratePostDraftResponse,
} from '@/features/sos/services/generatePostDraft';
import { useFields } from '@/hooks/useFields';
import type { CreateComposerScreenProps, RootTabParamList } from '@/navigation/types';
import { useAuth } from '@/services/auth';
import { createPostWithMedia, updatePostWithMedia } from '@/services/posts';
import { dictionaries, storage, type Crop } from '@/services/supabase';
import { useAppTheme } from '@/theme';

import { PhotoPicker } from '../../components/PhotoPicker';
import { PostTypeToggle } from '../../components/PostTypeToggle';
import { useCreatePostMeta } from '../../forms/CreatePostProvider';
import { createPostDefaults, type CreatePostFormValues, type PhotoItem } from '../../schemas/createPostSchema';

type Mode = 'quick' | 'details';
type StatusCode = CreatePostFormValues['statusCode'];

const STATUS_OPTIONS: { value: StatusCode; label: string; description: string }[] = [
  { value: 'open', label: 'Открыт', description: 'Можно отвечать и обсуждать' },
  { value: 'solved', label: 'Решён', description: 'Совет найден' },
  { value: 'closed', label: 'Закрыт', description: 'Обсуждение закрыто' },
];

function FocusedInput(props: React.ComponentProps<typeof TextInput>) {
  const focus = useFieldFocus();
  return <TextInput {...props} onFocus={(event) => { focus(NativeTextInput.State.currentlyFocusedInput()); props.onFocus?.(event); }} />;
}

export default function CreateComposerScreen({ navigation }: CreateComposerScreenProps) {
  const theme = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { user, profile } = useAuth();
  const { postId, localDraft } = useCreatePostMeta();
  const isEdit = postId !== null;
  const { control, handleSubmit, setValue, getValues, reset, formState } =
    useFormContext<CreatePostFormValues>();
  const audioRecorder = useAudioRecorder(RecordingPresets.LOW_QUALITY);
  const recorderState = useAudioRecorderState(audioRecorder, 250);
  const [mode, setMode] = useState<Mode>(localDraft?.mode ?? (isEdit ? 'details' : 'quick'));
  const [sos, setSos] = useState(() => localDraft?.sos ?? (getValues('postTypeCode') === 'question' && getValues('stageCode') === 'problem'));
  const draftEpoch = useRef(0);
  const [recordingBusy, setRecordingBusy] = useState(false);
  const [recordingUri, setRecordingUri] = useState<string | null>(localDraft?.audioUri ?? null);
  const localId = useRef<string | undefined>(localDraft?.id);
  const [savedFingerprint, setSavedFingerprint] = useState<string | null>(() =>
    localDraft ? draftFingerprint(localDraft.values, localDraft.audioUri, localDraft.sos, localDraft.mode) : null,
  );
  const [savingLocal, setSavingLocal] = useState(false);
  const localLock = useRef(false);
  const audioPlayer = useAudioPlayer(recordingUri);
  const audioStatus = useAudioPlayerStatus(audioPlayer);
  const [voiceStatus, setVoiceStatus] = useState<string | null>(null);
  const [generatingDraft, setGeneratingDraft] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [crops, setCrops] = useState<Pick<Crop, 'id' | 'slug' | 'name'>[]>([]);
  const [cropsError, setCropsError] = useState<string | null>(null);
  const { fields, loading: fieldsLoading, error: fieldsError, reload: reloadFields } =
    useFields();

  const postTypeCode = useWatch({ control, name: 'postTypeCode' });
  const statusCode = useWatch({ control, name: 'statusCode' });
  const title = useWatch({ control, name: 'title' });
  const body = useWatch({ control, name: 'body' });
  const photos = useWatch({ control, name: 'photos' });
  const fieldId = useWatch({ control, name: 'fieldId' });
  const cropId = useWatch({ control, name: 'cropId' });
  const selectedField = fields.find((field) => field.id === fieldId) ?? null;
  const selectedCrop = selectedField ? selectedField.currentCrop : crops.find((crop) => crop.id === cropId) ?? null;

  useEffect(() => {
    if (selectedField && cropId !== (selectedField.currentCrop?.id ?? null)) {
      setValue('cropId', selectedField.currentCrop?.id ?? null, { shouldDirty: true });
    }
  }, [selectedField, cropId, setValue]);

  function valuesWithFieldCrop(values: CreatePostFormValues) {
    const field = fields.find((item) => item.id === values.fieldId);
    return field ? { ...values, cropId: field.currentCrop?.id ?? null } : values;
  }

  useWatch({ control });
  const savedOnDevice = !savingLocal && !recorderState.isRecording && !recordingBusy &&
    savedFingerprint !== null && savedFingerprint === draftFingerprint(getValues(), recordingUri, sos, mode);

  useFocusEffect(
    useCallback(() => {
      void reloadFields();
    }, [reloadFields]),
  );

  useEffect(() => {
    let active = true;
    void dictionaries.getCachedCrops().then(data => { if (active && data.length) setCrops(data); });
    dictionaries
      .getCrops()
      .then((data) => {
        if (active) setCrops(data);
      })
      .catch((cause) => {
        if (active) {
          setCropsError('Не удалось загрузить культуры.');

        }
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => () => { draftEpoch.current++; }, []);

  async function keepOnDevice(audioOverride?: string | null, quiet = false, savedMode: Mode = mode) {
    if (!user || isEdit || localLock.current) return;
    const values = valuesWithFieldCrop(getValues());
    const audioUri = audioOverride === undefined ? recordingUri : audioOverride;
    if (!audioUri && !values.body.trim() && !values.title.trim() && !values.photos.length) {
      if (!quiet) setError('Добавьте текст, аудио или фото.');
      return;
    }
    localLock.current = true;
    setSavingLocal(true);
    try {
      const saved = await saveDraft(user.id, { id: localId.current, values, audioUri, sos, mode: savedMode });
      localId.current = saved.id;
      // Use durable local copies for subsequent processing and publication.
      if (JSON.stringify(getValues('photos')) === JSON.stringify(values.photos)) setValue('photos', saved.values.photos);
      setRecordingUri(saved.audioUri);
      setSavedFingerprint(draftFingerprint(saved.values, saved.audioUri, saved.sos, saved.mode));
      return saved;
    } catch { setError('Не удалось сохранить на устройстве.'); }
    finally { localLock.current = false; setSavingLocal(false); }
  }

  async function startOver() {
    if (localLock.current) return;
    audioPlayer.pause();
    localId.current = undefined;
    setSavedFingerprint(null);
    draftEpoch.current++;
    setGeneratingDraft(false);
    setRecordingUri(null);
    setVoiceStatus(null);
    setError(null);
    setSos(false);
    reset({ ...createPostDefaults, photos: [] });
    setMode('quick');
    if (recorderState.isRecording) {
      setRecordingBusy(true);
      try { await audioRecorder.stop(); } catch { /* Черновик уже очищен. */ }
      finally { setRecordingBusy(false); }
    }
  }

  const toggleRecording = useCallback(async () => {
    if (recordingBusy || generatingDraft) return;
    setRecordingBusy(true);
    if (recorderState.isRecording) {
      try {
        await audioRecorder.stop();
        setRecordingUri(audioRecorder.uri);
        setVoiceStatus('Аудио готово.');
        if (!isEdit && audioRecorder.uri) await keepOnDevice(audioRecorder.uri, true);
      } catch (cause) {
        setError('Не удалось сохранить запись.');
      } finally { setRecordingBusy(false); }
      return;
    }

    try {
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) {
        setError('Нужен доступ к микрофону.');
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      setRecordingUri(null);
      setVoiceStatus(null);
      await audioRecorder.prepareToRecordAsync({
        ...RecordingPresets.LOW_QUALITY,
        directory: 'document',
        isMeteringEnabled: true,
      });
      audioRecorder.record();
    } catch (cause) {
      setError('Не удалось начать запись.');
    } finally { setRecordingBusy(false); }
  }, [audioRecorder, recorderState.isRecording, recordingBusy, generatingDraft, user, sos, mode, recordingUri, isEdit]);

  const applyDraft = useCallback(
    (response: GeneratePostDraftResponse) => {
      const typeCode =
        response.display.post_type?.code === 'question' ? 'question' : 'field_update';

      const detectedCropId =
        typeof response.display.crop?.id === 'number' ? response.display.crop.id : null;

      setValue('postTypeCode', typeCode, { shouldDirty: true });

      if (!isEdit) setValue('statusCode', 'open', { shouldDirty: true });
      setValue('title', response.draft.title, { shouldDirty: true });
      setValue('body', response.draft.body, { shouldDirty: true });
      setValue('fieldId', response.draft.field_id, { shouldDirty: true });
      const draftField = fields.find((field) => field.id === response.draft.field_id);
      setValue('cropId', draftField ? draftField.currentCrop?.id ?? null : detectedCropId, { shouldDirty: true });

      setVoiceStatus('Готово. Проверьте поля.');
      setError(null);
    },
    [setValue, isEdit, fields],
  );

  const generateDraft = useCallback(async () => {
    if (!recordingUri && !body.trim()) {
      setError('Запишите аудио или введите описание.');
      return;
    }
    if (recordingUri && !user) {
      setError('Нужно войти заново.');
      return;
    }

    if (!isEdit && !await keepOnDevice(undefined, true)) return;
    const epoch = ++draftEpoch.current;
    setGeneratingDraft(true);
    setVoiceStatus('Обрабатываем…');
    try {
      const response = recordingUri
        ? await generatePostDraftFromAudio(recordingUri, user!.id, fieldId)
        : await generatePostDraft({ text: body, field_id: fieldId });
      if (epoch !== draftEpoch.current) return;
      applyDraft(response);
      setMode('details');
      if (!isEdit) await keepOnDevice(undefined, true, 'details');
    } catch (cause) {
      if (epoch !== draftEpoch.current) return;
      setError('Не удалось обработать. Попробуйте ещё раз.');
      setVoiceStatus(null);
    } finally {
      if (epoch === draftEpoch.current) setGeneratingDraft(false);
    }
  }, [applyDraft, body, fieldId, recordingUri, user, isEdit, sos, mode]);

  const avatarUrl = profile?.avatar_path
    ? storage.getAvatarUrl(profile.avatar_path)
    : undefined;

  const submit = handleSubmit(async (data) => {
    if (!user) {
      setError('Нужно войти заново.');
      return;
    }

    const normalizedTitle =
      mode === 'quick' && !data.title.trim()
        ? titleFromBody(data.body)
        : data.title.trim();

    if (!normalizedTitle) {
      setError(mode === 'quick' ? 'Добавьте описание.' : 'Введите заголовок.');
      return;
    }

    if (mode === 'quick' && !data.body.trim()) {
      setError('Добавьте описание.');
      return;
    }

    Keyboard.dismiss();
    setError(null);

    const input = {
      postTypeCode: sos ? 'question' : 'field_update',
      stageCode: sos ? 'problem' : (data.postTypeCode === 'question' && data.stageCode === 'problem' ? 'sowing' : data.stageCode),
      statusCode: isEdit ? data.statusCode : 'open',
      title: normalizedTitle,
      body: data.body,
      fieldId: data.fieldId,
      cropId: valuesWithFieldCrop(data).cropId,
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
        navigation.getParent()?.goBack();
        return;
      }

      await createPostWithMedia(user.id, input, newPhotos);
      audioPlayer.pause();
      if (localId.current) {
        try { await deleteDraft(user.id, localId.current); } catch { setError('Пост отправлен. Не удалось убрать локальную копию.'); }
      }
      await startOver();
      navigation
        .getParent<BottomTabNavigationProp<RootTabParamList>>()
        ?.navigate('Profile', { refresh: true });
    } catch (cause) {
      if (!isEdit) {
        const saved = await keepOnDevice(undefined, true);
        if (saved) setError('Не удалось отправить. Черновик сохранён на устройстве.');
      } else setError('Не удалось сохранить публикацию.');
    }
  }, () => setError('Проверьте длину заголовка и описания.'));

  return (
    <View style={styles.root}>
      <AppHeader title={isEdit ? 'Редактирование' : 'Новая запись'} />
      {!isEdit ? <Button icon="restart" disabled={formState.isSubmitting || recordingBusy || savingLocal} onPress={() => void startOver()} style={{ alignSelf: 'flex-end' }}>Очистить черновик</Button> : null}
      <KeyboardAwareScreen edges={['bottom']} contentContainerStyle={styles.content}>
            <View style={styles.section}>
              <Text style={styles.label}>Фото</Text>
              <PhotoPicker
                value={photos}
                onChange={(next: PhotoItem[]) => setValue('photos', next, { shouldDirty: true })}
              />
            </View>
        <SegmentedButtons
          value={mode}
          onValueChange={(value) => setMode(value as Mode)}
          buttons={[
            { value: 'quick', label: 'Наговорить', icon: 'microphone-outline' },
            { value: 'details', label: 'Заполнить', icon: 'format-list-bulleted' },
          ]}
        />

        {mode === 'quick' ? (
          <View style={styles.card}>
            <Text style={styles.title}>Что происходит?</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={recorderState.isRecording ? 'Остановить запись' : 'Начать запись'}
              disabled={recordingBusy || savingLocal || generatingDraft || formState.isSubmitting}
              onPress={() => void toggleRecording()}
              style={({ pressed }) => [
                styles.recordButton,
                recorderState.isRecording ? styles.recordButtonActive : null,
                pressed ? { transform: [{ scale: 0.98 }] } : null,
              ]}
            >
              <Icon
                name={recorderState.isRecording ? 'stop-circle-outline' : 'microphone-outline'}
                size={42}
                color={theme.colors.onPrimary}
              />
              <Text style={styles.recordButtonText}>
                {recorderState.isRecording ? 'Остановить' : 'Записать аудио'}
              </Text>
            </Pressable>
            <Text style={styles.recordState}>
              {recorderState.isRecording
                ? `Запись: ${formatDuration(recorderState.durationMillis)}`
                : recordingUri
                  ? 'Аудио сохранено.'
                  : 'Запишите аудио или введите текст.'}
            </Text>
            {voiceStatus ? <Text style={styles.voiceStatus}>{voiceStatus}</Text> : null}
            {recordingUri ? <Button icon={audioStatus.playing ? 'pause' : 'play'} onPress={() => { if (audioStatus.playing) audioPlayer.pause(); else { if (audioStatus.didJustFinish) void audioPlayer.seekTo(0).then(() => audioPlayer.play()); else audioPlayer.play(); } }}>{audioStatus.playing ? 'Пауза' : 'Прослушать запись'}</Button> : null}
         <Controller
              control={control}
              name="body"
              render={({ field: { value, onChange, onBlur } }) => (
                <FocusedInput
                  mode="outlined"
                  label="Общее описание"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  multiline
                  numberOfLines={7}
                  placeholder="Опишите ситуацию"
                  style={styles.multiline}
                />
              )}
            />
            <View style={styles.quickActions}>
              <Button
                mode="contained"
                icon="auto-fix"
                loading={generatingDraft}
                disabled={generatingDraft || savingLocal || recordingBusy || recorderState.isRecording}
                onPress={() => void generateDraft()}
              >
                Собрать запись
              </Button>
            </View>
   
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.title}>Детали записи</Text>


            {isEdit ? <View style={styles.section}>
              <Text style={styles.label}>Статус обсуждения</Text>
              <View style={styles.chips}>
                {STATUS_OPTIONS.map((option) => {
                  const active = statusCode === option.value;
                  return (
                    <Pressable
                      key={option.value}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      style={[styles.chip, active ? styles.chipActive : null]}
                      onPress={() => setValue('statusCode', option.value, { shouldDirty: true })}
                    >
                      <Text style={[styles.chipTitle, active ? styles.chipTitleActive : null]}>
                        {option.label}
                      </Text>
                      <Text style={[styles.chipText, active ? styles.chipTextActive : null]}>
                        {option.description}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View> : null}

            <Controller
              control={control}
              name="title"
              render={({ field: { value, onChange, onBlur } }) => (
                <View>
                  <FocusedInput
                    mode="outlined"
                    label="Заголовок"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                  />
                </View>
              )}
            />

            <Controller
              control={control}
              name="body"
              render={({ field: { value, onChange, onBlur } }) => (
                <View>
                  <FocusedInput
                    mode="outlined"
                    label="Описание"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    multiline
                    numberOfLines={6}
                    style={styles.multiline}
                  />
                </View>
              )}
            />



            <View style={styles.section}>
              <Text style={styles.label}>Поле</Text>
              {fieldsLoading && fields.length === 0 ? (
                <Text style={styles.stateText}>Загружаю поля...</Text>
              ) : fieldsError ? (
                <Text style={styles.stateText}>Поля недоступны.</Text>
              ) : (
                <SelectMenu
                  label="Поле"
                  value={fieldId}
                  options={[
                    { value: null, label: 'Без поля' },
                    ...fields.map((field) => ({
                      value: field.id,
                      label: field.name,
                      description: field.region ?? undefined,
                    })),
                  ]}
                  onChange={(value) => {
                    setValue('fieldId', value, { shouldDirty: true });
                    const field = fields.find((item) => item.id === value);
                    if (field) setValue('cropId', field.currentCrop?.id ?? null, { shouldDirty: true });
                  }}
                />
              )}
            </View>

            <View style={styles.section}>
              <Text style={styles.label}>Культура</Text>
              {fieldId ? (
                <View style={{ padding: 16, borderRadius: 16, backgroundColor: theme.colors.surfaceVariant }}>
                  <Text>{selectedCrop?.name ?? (selectedField ? 'На поле культура не указана' : fieldsLoading ? 'Загружаем…' : 'Культура недоступна')}</Text>
                </View>
              ) : <>
              {cropsError ? <Text style={styles.stateText}>Культуры недоступны.</Text> : null}
              <SelectMenu
                label="Культура"
                value={cropId}
                options={[
                  { value: null, label: 'Не указана' },
                  ...crops.map((crop) => ({ value: crop.id, label: crop.name })),
                ]}
                onChange={(value) => setValue('cropId', value, { shouldDirty: true })}
              />
              </>}
            </View>
          </View>
        )}

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: sos ? '#FFEAF0' : theme.colors.surface, padding: 16, borderRadius: 18 }}>
          <View><Text style={{ fontSize: 18, fontWeight: '800' }}>SOS · Нужен совет</Text></View>
          <Switch value={sos} onValueChange={setSos} disabled={formState.isSubmitting} color="#E44F78" accessibilityLabel="Пометить публикацию SOS" />
        </View>
        <View style={styles.previewWrap}>
          <Text style={styles.previewTitle}>Так увидят в ленте</Text>
          <PostCard
            preview
            author={{ nickname: profile?.name ?? 'вы', avatarUrl }}
            title={(title || titleFromBody(body)) || 'Новая публикация'}
            description={body || undefined}
            images={photos.map((photo) => (photo.kind === 'new' ? photo.uri : photo.url))}
            postTypeCode={sos ? 'question' : 'field_update'}
            isSos={sos && (!isEdit || statusCode === 'open')}
            stageCode={sos ? 'problem' : 'sowing'}
            statusCode={statusCode}
            statusName={isEdit ? STATUS_OPTIONS.find((item) => item.value === statusCode)?.label : undefined}
          />
          {selectedField ? (
            <Text style={styles.stateText}>Поле: {selectedField.name}</Text>
          ) : null}
          {selectedCrop ? (
            <Text style={styles.stateText}>Культура: {selectedCrop.name}</Text>
          ) : null}
        </View>

        {!isEdit ? <View style={{ gap: 8 }}>
          <Button mode="outlined" icon="download" loading={savingLocal} disabled={savingLocal || recordingBusy || recorderState.isRecording || formState.isSubmitting || generatingDraft} onPress={() => void keepOnDevice()}>Сохранить на устройстве</Button>
          {savedOnDevice ? (
            <View accessibilityLiveRegion="polite" style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
              <Icon name="check-circle" size={18} color={theme.colors.primary} />
              <Text style={{ color: theme.colors.primary, fontSize: 13, fontWeight: '600' }}>Сохранено на устройстве</Text>
            </View>
          ) : null}
          <Button icon="inbox" disabled={savingLocal || recorderState.isRecording || generatingDraft} onPress={() => navigation.getParent<BottomTabNavigationProp<RootTabParamList>>()?.navigate('Drafts')}>Мои черновики</Button>
        </View> : null}
        <Button
          mode="contained"
          icon={isEdit ? 'content-save-outline' : 'send-outline'}
          loading={formState.isSubmitting}
          disabled={formState.isSubmitting || savingLocal || recordingBusy || recorderState.isRecording || generatingDraft}
          contentStyle={styles.submitContent}
          onPress={() => void submit()}
        >
          {isEdit ? 'Применить' : 'В ленту'}
        </Button>
      </KeyboardAwareScreen>
      <Snackbar visible={error !== null} onDismiss={() => setError(null)} duration={3200}>
        {error ?? ''}
      </Snackbar>
    </View>
  );
}

function draftFingerprint(values: CreatePostFormValues, audioUri: string | null, sos: boolean, mode: Mode): string {
  return JSON.stringify([
    values.title, values.body, values.postTypeCode, values.stageCode, values.statusCode,
    values.fieldId, values.cropId, values.photos, audioUri, sos, mode,
  ]);
}

function asStatusCode(value: string | undefined): StatusCode | null {
  return value === 'open' || value === 'solved' || value === 'closed'
    ? value
    : null;
}

function titleFromBody(value: string): string {
  const first = value.split(/[.!?\n]/)[0]?.trim() ?? '';
  if (!first) return '';
  return first.length > 80 ? `${first.slice(0, 77).trimEnd()}...` : first;
}

function formatDuration(durationMillis: number): string {
  const totalSeconds = Math.max(0, Math.floor(durationMillis / 1000));
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
  const seconds = (totalSeconds % 60).toString().padStart(2, '0');
  return `${minutes}:${seconds}`;
}

const makeStyles = (theme: MD3Theme) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    content: {
      paddingHorizontal: 18,
      paddingTop: 18,
      paddingBottom: 28,
      gap: 16,
    },
    card: {
      gap: 14,
      padding: 16,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.colors.outline,
      backgroundColor: theme.colors.surface,
    },
    title: {
      color: theme.colors.onSurface,
      fontSize: 22,
      fontWeight: '900',
    },
    subtitle: {
      color: theme.colors.onSurfaceVariant,
      fontSize: 14,
      lineHeight: 20,
    },
    recordButton: {
      alignSelf: 'center',
      width: '100%',
      height: 96,
      borderRadius: 24,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: theme.colors.primary,
      elevation: 0,
    },
    recordButtonActive: {
      backgroundColor: theme.colors.error,
    },
    recordButtonText: {
      color: theme.colors.onPrimary,
      fontSize: 15,
      fontWeight: '900',
    },
    recordState: {
      color: theme.colors.onSurfaceVariant,
      fontSize: 13,
      fontWeight: '700',
      lineHeight: 18,
      textAlign: 'center',
    },
    voiceStatus: {
      color: theme.colors.primary,
      fontSize: 13,
      fontWeight: '800',
      lineHeight: 18,
    },
    quickActions: {
      gap: 10,
    },
    multiline: {
      minHeight: 128,
      textAlignVertical: 'top',
    },
    section: {
      gap: 8,
    },
    label: {
      color: theme.colors.onSurface,
      fontSize: 13,
      fontWeight: '800',
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },
    chips: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    chip: {
      minHeight: 42,
      justifyContent: 'center',
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.colors.outline,
      backgroundColor: theme.colors.background,
      paddingHorizontal: 12,
      paddingVertical: 8,
      maxWidth: '100%',
    },
    chipActive: {
      borderColor: theme.colors.primary,
      backgroundColor: theme.colors.primaryContainer,
    },
    chipTitle: {
      color: theme.colors.onSurface,
      fontSize: 13,
      fontWeight: '800',
    },
    chipTitleActive: {
      color: theme.colors.onPrimaryContainer,
    },
    chipText: {
      color: theme.colors.onSurfaceVariant,
      fontSize: 12,
      lineHeight: 16,
      marginTop: 2,
    },
    chipTextActive: {
      color: theme.colors.onPrimaryContainer,
    },
    stateText: {
      color: theme.colors.onSurfaceVariant,
      fontSize: 13,
      lineHeight: 18,
    },
    errorText: {
      color: theme.colors.error,
      fontSize: 13,
      lineHeight: 18,
    },
    previewWrap: {
      gap: 8,
    },
    previewTitle: {
      color: theme.colors.onSurface,
      fontSize: 16,
      fontWeight: '900',
    },
    submitError: {
      paddingHorizontal: 0,
    },
    submitContent: {
      minHeight: 50,
    },
  });
