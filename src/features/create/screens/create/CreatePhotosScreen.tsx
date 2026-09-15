
import { useFormContext, useWatch } from 'react-hook-form';

import type { CreatePhotosScreenProps } from '@/navigation/types';

import { CreateStepLayout } from '../../components/CreateStepLayout';
import { PhotoPicker } from '../../components/PhotoPicker';
import type { CreatePostFormValues } from '../../schemas/createPostSchema';

export default function CreatePhotosScreen({
  navigation,
}: CreatePhotosScreenProps) {
  const { control, setValue } = useFormContext<CreatePostFormValues>();
  const photos = useWatch({ control, name: 'photos' });

  return (
    <CreateStepLayout
      step={3}
      title="Фото"
      subtitle="Сфотографируйте или выберите из галереи. Не обязательно."
      onBack={navigation.goBack}
      onNext={() => navigation.navigate('CreateField')}
    >
      <PhotoPicker
        value={photos}
        onChange={(next) => setValue('photos', next, { shouldDirty: true })}
      />
    </CreateStepLayout>
  );
}
