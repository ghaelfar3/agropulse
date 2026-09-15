import { PulseButton as Button } from '@/components/PulseButton';
import { PulseDialog as Dialog } from '@/components/PulseDialog';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { View, StyleSheet } from 'react-native';
import {   Portal, type MD3Theme } from 'react-native-paper';

import { FormTextInput } from '@/components/FormTextInput';
import { RegionSelect } from '@/components/RegionSelect';
import { SelectMenu } from '@/components/SelectMenu';
import { dictionaries, type Crop, type PostStage } from '@/services/supabase';
import { useAppTheme } from '@/theme';

import { fieldSchema, type FieldFormValues } from '../schemas/fieldSchema';

type FieldFormDialogProps = {
  visible: boolean;
  /** Заголовок диалога — форма одна и для создания, и для правки. */
  title: string;
  submitLabel: string;
  defaults: FieldFormValues;
  saving: boolean;
  onCancel: () => void;
  onSubmit: (
    values: FieldFormValues,
    selectedCrop: Pick<Crop, 'id' | 'slug' | 'name'> | null,
  ) => void;
};

/**
 * Название и регион поля — при создании и при правке.
 *
 * Диалог, а не отдельный экран: два поля не стоят вложенного навигатора, а
 * карта под диалогом остаётся видна — пользователь не теряет из виду то, что
 * нарисовал. `PaperProvider` уже даёт `Portal.Host`, добавлять ничего не нужно.
 */
export function FieldFormDialog({
  visible,
  title,
  submitLabel,
  defaults,
  saving,
  onCancel,
  onSubmit,
}: FieldFormDialogProps) {
  const theme = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const [crops, setCrops] = useState<Pick<Crop, 'id' | 'slug' | 'name'>[]>([]);
  const [stages, setStages] = useState<PostStage[]>([]);
  const { control, handleSubmit, reset, setValue, watch } = useForm<FieldFormValues>({
    resolver: zodResolver(fieldSchema),
    defaultValues: defaults,
    mode: 'onTouched',
  });
  const cropId = watch('cropId');
  const stageId = watch('stageId');
  const selectedCrop = useMemo(
    () => crops.find((crop) => crop.id === cropId) ?? null,
    [cropId, crops],
  );

  // Диалог не размонтируется между показами, поэтому значения по умолчанию
  // (в том числе «Поле N» с новым номером) подставляем при каждом открытии.
  useEffect(() => {
    if (visible) reset(defaults);
  }, [visible, defaults, reset]);

  useEffect(() => {
    if (!visible || (crops.length > 0 && stages.length > 0)) return;
    let cancelled = false;
    Promise.all([dictionaries.getCrops(), dictionaries.getPostStages()])
      .then(([nextCrops, nextStages]) => {
        if (cancelled) return;
        setCrops(nextCrops);
        setStages(nextStages);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [crops.length, stages.length, visible]);

  return (
    <Portal>
      {visible ? <>
      <Dialog visible={visible} onDismiss={saving ? () => {} : onCancel} dismissable={!saving}>
        <Dialog.Title>{title}</Dialog.Title>
        <Dialog.Content>
          <View style={styles.content}>
            <FormTextInput control={control} name="name" label="Как назовём поле?" placeholder="Например, Северный склон" />
            <SelectMenu
              label="Что выращиваем"
              value={cropId}
              options={[
                { value: null, label: 'Культура не указана' },
                ...crops.map((crop) => ({ value: crop.id, label: crop.name })),
              ]}
              onChange={(value) => setValue('cropId', value, { shouldDirty: true })}
            />
            <SelectMenu
              label="Состояние посевов"
              value={stageId}
              options={[
                { value: null, label: 'Статус не указан' },
                ...stages.map((stage) => ({ value: stage.id, label: stage.name })),
              ]}
              onChange={(value) => setValue('stageId', value, { shouldDirty: true })}
            />
            <RegionSelect control={control} name="region" label="Где находится" clearable />
          </View>
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={onCancel} disabled={saving}>
            Отмена
          </Button>
          <Button
            onPress={handleSubmit((values) => onSubmit(values, selectedCrop))}
            loading={saving}
            disabled={saving}
          >
            {submitLabel}
          </Button>
        </Dialog.Actions>
      </Dialog>
      </> : null}
    </Portal>
  );
}

const makeStyles = (theme: MD3Theme) =>
  StyleSheet.create({
    scroll: {
      maxHeight: 420,
    },
    content: {
      gap: 8,
      paddingBottom: 4,
    },
  });
