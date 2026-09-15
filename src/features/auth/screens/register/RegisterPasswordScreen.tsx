
import { useFormContext } from 'react-hook-form';
import { StyleSheet } from 'react-native';
import { HelperText } from 'react-native-paper';

import type { RegisterPasswordScreenProps } from '@/navigation/types';
import { useAuth } from '@/services/auth';

import { FormTextInput } from '@/components/FormTextInput';
import { RegisterStepLayout } from '../../components/RegisterStepLayout';
import type { RegisterFormValues } from '../../schemas/registerSchema';

export default function RegisterPasswordScreen({
  navigation,
}: RegisterPasswordScreenProps) {
  const { control, handleSubmit, formState } = useFormContext<RegisterFormValues>();
  const { error, signUp } = useAuth();

  // Единственный сетевой шаг мастера: создаём аккаунт и сразу пишем профиль.
  // Успех переводит status в 'authenticated' — навигатор сам переключится
  // на табы, отдельного navigate не нужно.
  const submit = handleSubmit((values) =>
    signUp({
      email: values.email,
      password: values.password,
      name: values.name,
      specialization: values.specialization,
      region: values.region,
    }).then(() => undefined),
  );

  return (
    <RegisterStepLayout
      step={3}
      title="Пароль"
      subtitle="Минимум 6 символов."
      onBack={navigation.goBack}
      onNext={submit}
      nextLabel="Зарегистрироваться"
      nextLoading={formState.isSubmitting}
    >
      <FormTextInput
        control={control}
        name="password"
        label="Пароль"
        secureTextEntry
        autoCapitalize="none"
        autoComplete="new-password"
        textContentType="newPassword"
      />
      <FormTextInput
        control={control}
        name="confirmPassword"
        label="Повторите пароль"
        secureTextEntry
        autoCapitalize="none"
        autoComplete="new-password"
        textContentType="newPassword"
      />
      {error ? (
        <HelperText type="error" visible style={styles.formError}>
          {error}
        </HelperText>
      ) : null}
    </RegisterStepLayout>
  );
}

const styles = StyleSheet.create({
  formError: {
    paddingHorizontal: 0,
  },
});
