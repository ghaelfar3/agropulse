import { PulseButton as Button } from '@/components/PulseButton';

import { useMemo } from 'react';
import { Keyboard, StyleSheet, Text, View } from 'react-native';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {  HelperText, type MD3Theme } from 'react-native-paper';

import { KeyboardAwareScreen } from '@/components/KeyboardAwareScreen';
import { Icon } from '@/components/Icon';
import type { LoginScreenProps } from '@/navigation/types';
import { useAuth } from '@/services/auth';
import { useAppTheme } from '@/theme';

import { FormTextInput } from '@/components/FormTextInput';
import {
  loginDefaults,
  loginSchema,
  type LoginFormValues,
} from '../schemas/loginSchema';

export default function LoginScreen({ navigation }: LoginScreenProps) {
  const theme = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { status, error, signIn } = useAuth();
  const busy = status === 'authenticating';

  const { control, handleSubmit } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: loginDefaults,
    mode: 'onTouched',
  });

  const onSubmit = (values: LoginFormValues) => {
    Keyboard.dismiss();
    return signIn(values);
  };

  return (
    <KeyboardAwareScreen contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <View style={styles.logo}>
          <Icon name="lifebuoy" size={34} color={theme.colors.primary} />
        </View>
        <Text style={styles.brand}>AgroPulse</Text>
        <Text style={styles.title}>Поле просит внимания</Text>
        <Text style={styles.subtitle}>
          Короткие обновления, фото с участка и быстрый совет от аграриев рядом.
        </Text>
      </View>

      <View style={styles.formCard}>
        {error ? (
          <HelperText type="error" visible style={styles.formError}>
            {error}
          </HelperText>
        ) : null}

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

        <FormTextInput
          control={control}
          name="password"
          label="Пароль"
          secureTextEntry
          autoCapitalize="none"
          autoComplete="current-password"
          textContentType="password"
        />

        <Button
          mode="contained"
          icon="login"
          loading={busy}
          disabled={busy}
          onPress={handleSubmit(onSubmit)}
          style={styles.primaryButton}
          contentStyle={styles.primaryButtonContent}
          accessibilityLabel="Войти"
        >
          Войти
        </Button>

        <Button
          mode="text"
          disabled={busy}
          onPress={() => navigation.navigate('Register')}
          accessibilityLabel="Перейти к регистрации"
        >
          Создать аккаунт
        </Button>
      </View>
    </KeyboardAwareScreen>
  );
}

const makeStyles = (theme: MD3Theme) =>
  StyleSheet.create({
    content: {
      flexGrow: 1,
      justifyContent: 'center',
      paddingHorizontal: 18,
      paddingVertical: 24,
    },
    hero: {
      paddingHorizontal: 8,
      marginBottom: 22,
    },
    logo: {
      width: 64,
      height: 64,
      borderRadius: 32,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 18,
      backgroundColor: theme.colors.primaryContainer,
      borderWidth: 1,
      borderColor: theme.colors.outline,
    },
    brand: {
      color: theme.colors.primary,
      fontSize: 15,
      fontWeight: '800',
      marginBottom: 6,
    },
    title: {
      color: theme.colors.onBackground,
      fontSize: 33,
      fontWeight: '800',
      letterSpacing: 0,
    },
    subtitle: {
      color: theme.colors.onSurfaceVariant,
      fontSize: 16,
      lineHeight: 23,
      marginTop: 8,
    },
    formCard: {
      padding: 16,
      borderRadius: 8,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.outline,
    },
    formError: {
      paddingHorizontal: 0,
    },
    primaryButton: {
      marginTop: 8,
    },
    primaryButtonContent: {
      minHeight: 48,
    },
  });
