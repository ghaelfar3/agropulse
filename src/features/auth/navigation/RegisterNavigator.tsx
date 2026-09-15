
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import type { RegisterStackParamList } from '@/navigation/types';
import RegisterEmailScreen from '../screens/register/RegisterEmailScreen';
import RegisterProfileScreen from '../screens/register/RegisterProfileScreen';
import RegisterPasswordScreen from '../screens/register/RegisterPasswordScreen';

const Stack = createNativeStackNavigator<RegisterStackParamList>();

/**
 * Вложенный стек мастера регистрации. `goBack` на первом шаге всплывает
 * к экрану «Вход». Форма — в `RegisterFormProvider` над этим навигатором.
 */
export function RegisterNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{ headerShown: false, animation: 'slide_from_right' }}
    >
      <Stack.Screen name="RegisterEmail" component={RegisterEmailScreen} />
      <Stack.Screen name="RegisterProfile" component={RegisterProfileScreen} />
      <Stack.Screen name="RegisterPassword" component={RegisterPasswordScreen} />
    </Stack.Navigator>
  );
}
