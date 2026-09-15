import { useState } from 'react';
import { Keyboard, View } from 'react-native';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Snackbar, Text } from 'react-native-paper';
import { AppHeader } from '@/components/AppHeader';
import { KeyboardAwareScreen } from '@/components/KeyboardAwareScreen';
import { FormTextInput } from '@/components/FormTextInput';
import { RegionSelect } from '@/components/RegionSelect';
import { PulseButton } from '@/components/PulseButton';
import { useAuth } from '@/services/auth';
import { useAppTheme } from '@/theme';
import type { RegisterScreenProps } from '@/navigation/types';
import { registerDefaults, registerSchema, type RegisterFormValues } from '../schemas/registerSchema';

export default function RegisterScreen({ navigation }: RegisterScreenProps) {
  const { colors } = useAppTheme();
  const { signUp } = useAuth();
  const [notice, setNotice] = useState<string | null>(null);
  const { control, handleSubmit, formState } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema), defaultValues: registerDefaults, mode: 'onTouched',
  });
  const busy = formState.isSubmitting;
  const submit = handleSubmit(async values => {
    Keyboard.dismiss();
    setNotice(null);
    try {
      const success = await signUp({ email: values.email, password: values.password, name: values.name, specialization: values.specialization, region: values.region });
      if (!success) setNotice('Не удалось создать аккаунт. Проверьте данные и попробуйте ещё раз.');
    } catch { setNotice('Не удалось создать аккаунт. Попробуйте ещё раз.'); }
  }, () => setNotice('Проверьте отмеченные поля.'));

  return <View style={{ flex: 1, backgroundColor: colors.background }}>
    <AppHeader title="Присоединиться" onBack={() => { if (!busy) navigation.goBack(); }} />
    <KeyboardAwareScreen edges={['bottom']} contentContainerStyle={{ padding: 22, gap: 18, paddingBottom: 32 }}>
      <View style={{ gap: 8, marginBottom: 8 }}>
        <Text style={{ color: colors.primary, fontSize: 13, fontWeight: '800', letterSpacing: 1 }}>AGROPULSE</Text>
        <Text style={{ fontSize: 30, fontWeight: '800', color: colors.onSurface }}>Давайте знакомиться</Text>
        <Text style={{ fontSize: 15, color: colors.onSurfaceVariant }}>Ваш профиль в сообществе аграриев.</Text>
      </View>
      <View pointerEvents={busy ? 'none' : 'auto'} style={{ gap: 4 }}>
        <FormTextInput control={control} name="name" label="Как вас называть" placeholder="Например, Алексей Иванов" autoComplete="name" textContentType="name" editable={!busy} />
        <RegionSelect control={control} name="region" label="Где вы работаете" />
        <FormTextInput control={control} name="specialization" label="Ваше направление" placeholder="Агрономия, фермерство, садоводство…" editable={!busy} />
        <FormTextInput control={control} name="email" label="Почта для входа" placeholder="name@example.ru" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" textContentType="emailAddress" editable={!busy} />
        <FormTextInput control={control} name="password" label="Придумайте пароль" placeholder="От 6 символов" secureTextEntry autoCapitalize="none" autoCorrect={false} autoComplete="new-password" textContentType="newPassword" editable={!busy} />
        <FormTextInput control={control} name="confirmPassword" label="Пароль ещё раз" placeholder="Введите тот же пароль" secureTextEntry autoCapitalize="none" autoCorrect={false} autoComplete="new-password" textContentType="newPassword" editable={!busy} />
      </View>
      <PulseButton mode="contained" icon="user-plus" loading={busy} disabled={busy} onPress={() => void submit()}>Создать профиль</PulseButton>
      <PulseButton disabled={busy} onPress={() => navigation.navigate('Login')}>Уже с нами? Войти</PulseButton>
    </KeyboardAwareScreen>
    <Snackbar visible={notice !== null} onDismiss={() => setNotice(null)}>{notice ?? ''}</Snackbar>
  </View>;
}
