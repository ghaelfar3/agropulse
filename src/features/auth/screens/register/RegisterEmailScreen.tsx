
import { useFormContext } from 'react-hook-form';

import type { RegisterEmailScreenProps } from '@/navigation/types';

import { FormTextInput } from '@/components/FormTextInput';
import { RegisterStepLayout } from '../../components/RegisterStepLayout';
import {
  REGISTER_STEP_FIELDS,
  type RegisterFormValues,
} from '../../schemas/registerSchema';

export default function RegisterEmailScreen({ navigation }: RegisterEmailScreenProps) {
  const { control, trigger } = useFormContext<RegisterFormValues>();

  // Сеть здесь не трогаем: аккаунт создаётся одним запросом на последнем шаге.
  // Поэтому «почта уже занята» всплывёт только там — раньше узнать неоткуда.
  const handleNext = async () => {
    if (!(await trigger(REGISTER_STEP_FIELDS.email))) return;
    navigation.navigate('RegisterProfile');
  };

  return (
    <RegisterStepLayout
      step={1}
      title="Ваш email"
      subtitle="По нему вы будете входить в приложение."
      onBack={navigation.goBack}
      onNext={handleNext}
    >
      <FormTextInput
        control={control}
        name="email"
        label="Email"
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        textContentType="emailAddress"
        autoCorrect={false}
      />
    </RegisterStepLayout>
  );
}
