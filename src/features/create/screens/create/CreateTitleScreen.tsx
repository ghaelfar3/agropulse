
import { useFormContext, useWatch } from 'react-hook-form';
import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';

import { FormTextInput } from '@/components/FormTextInput';
import type { CreateTitleScreenProps } from '@/navigation/types';

import { CreateStepLayout } from '../../components/CreateStepLayout';
import { PostStageToggle, PostTypeToggle } from '../../components/PostTypeToggle';
import { useCreatePostMeta } from '../../forms/CreatePostProvider';
import {
  CREATE_STEP_FIELDS,
  type CreatePostFormValues,
} from '../../schemas/createPostSchema';

export default function CreateTitleScreen({ navigation }: CreateTitleScreenProps) {
  const { control, trigger, setValue } = useFormContext<CreatePostFormValues>();
  const { postId } = useCreatePostMeta();
  const postTypeCode = useWatch({ control, name: 'postTypeCode' });
  const stageCode = useWatch({ control, name: 'stageCode' });

  const handleNext = async () => {
    if (!(await trigger(CREATE_STEP_FIELDS.title))) return;
    navigation.navigate('CreateBody');
  };

  return (
    <CreateStepLayout
      step={1}
      title="Заголовок или вопрос"
      onNext={handleNext}
      // В режиме редактирования шаг 1 — не корень: «назад» закрывает мастер.
      onBack={postId ? navigation.goBack : undefined}
    >
      <View style={styles.toggle}>
        <Text variant="labelLarge" style={styles.label}>
          Выберите тип
        </Text>
        <PostTypeToggle
          value={postTypeCode}
          onChange={(value) =>
            setValue('postTypeCode', value, { shouldDirty: true })
          }
        />
      </View>
      <View style={styles.toggle}>
        <Text variant="labelLarge" style={styles.label}>
          Этап поля
        </Text>
        <PostStageToggle
          value={stageCode}
          onChange={(value) =>
            setValue('stageCode', value, { shouldDirty: true })
          }
        />
      </View>
      <FormTextInput control={control} name="title" label="Заголовок или вопрос" />
    </CreateStepLayout>
  );
}

const styles = StyleSheet.create({
  toggle: {
    marginBottom: 16,
  },
  label: {
    marginBottom: 8,
  },
});
