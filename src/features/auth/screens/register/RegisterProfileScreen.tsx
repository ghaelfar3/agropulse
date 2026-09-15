
import { useFormContext } from 'react-hook-form';

import type { RegisterProfileScreenProps } from '@/navigation/types';

import { FormTextInput } from '@/components/FormTextInput';
import { RegionSelect } from '@/components/RegionSelect';
import { RegisterStepLayout } from '../../components/RegisterStepLayout';
import {
  REGISTER_STEP_FIELDS,
  type RegisterFormValues,
} from '../../schemas/registerSchema';

export default function RegisterProfileScreen({
  navigation,
}: RegisterProfileScreenProps) {
  const { control, trigger } = useFormContext<RegisterFormValues>();

  const handleNext = async () => {
    if (!(await trigger(REGISTER_STEP_FIELDS.profile))) return;
    navigation.navigate('RegisterPassword');
  };

  // Поля повторяют колонки `profiles`. Справочника под специализацию в схеме БД
  // нет, поэтому она остаётся свободным вводом; регион — выбор из списка
  // регионов РФ (см. RegionSelect).
  return (
    <RegisterStepLayout
      step={2}
      title="О себе"
      subtitle="Как вас показывать другим пользователям."
      onBack={navigation.goBack}
      onNext={handleNext}
    >
      <FormTextInput
        control={control}
        name="name"
        label="Имя"
        autoComplete="name"
        textContentType="name"
      />
      <FormTextInput
        control={control}
        name="specialization"
        label="Специализация"
        placeholder="Например, растениеводство"
      />
      <RegionSelect control={control} name="region" label="Регион" />
    </RegisterStepLayout>
  );
}
