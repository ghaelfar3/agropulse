
import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';

import { AuthNavigator } from '../features/auth';
import { useAuth } from '@/services/auth';
import { appTheme, navigationTheme } from '@/theme';
import { AppNavigator } from './AppNavigator';

/**
 * Гейт авторизации. Пока `status === 'loading'` — восстанавливаем сессию
 * Supabase, держим пустой экран цвета фона. Дальше показываем либо стек
 * логина/регистрации, либо основные табы. Навигатор переключается целиком —
 * без `navigate`.
 *
 * `registering` — это середина мастера: сессия после ввода кода уже есть,
 * но профиль и пароль не заданы, поэтому в табы не пускаем.
 */
export function RootNavigator() {
  const { status } = useAuth();

  if (status === 'loading') {
    return <View style={{ flex: 1, backgroundColor: appTheme.colors.background }} />;
  }

  return (
    <NavigationContainer theme={navigationTheme}>
      <StatusBar style="dark" />
      {status === 'authenticated' ? <AppNavigator /> : <AuthNavigator />}
    </NavigationContainer>
  );
}
