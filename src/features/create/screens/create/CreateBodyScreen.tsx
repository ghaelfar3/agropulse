
import { useFormContext } from 'react-hook-form';
import { StyleSheet } from 'react-native';

import { FormTextInput } from '@/components/FormTextInput';
import type { CreateBodyScreenProps } from '@/navigation/types';

import { CreateStepLayout } from '../../components/CreateStepLayout';
import type { CreatePostFormValues } from '../../schemas/createPostSchema';

export default function CreateBodyScreen({ navigation }: CreateBodyScreenProps) {
  const { control } = useFormContext<CreatePostFormValues>();

  return (
    <CreateStepLayout
      step={2}
      title="Описание"
      subtitle="Подробности. Не обязательно."
      onBack={navigation.goBack}
      onNext={() => navigation.navigate('CreatePhotos')}
    >
      <FormTextInput
        control={control}
        name="body"
        label="Описание"
        placeholder="Что произошло, что заметили, что планируете"
        multiline
        numberOfLines={6}
        style={styles.input}
      />
    </CreateStepLayout>
  );
}

const styles = StyleSheet.create({
  input: {
    minHeight: 140,
  },
});
