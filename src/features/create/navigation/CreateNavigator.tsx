
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import type { CreateStackParamList } from '@/navigation/types';
import CreateComposerScreen from '../screens/create/CreateComposerScreen';

const Stack = createNativeStackNavigator<CreateStackParamList>();

/**
 * Вкладка создания теперь без пошагового мастера: один экран с режимами
 * «Быстро» и «Подробно». Форма всё ещё живёт в CreatePostProvider, чтобы
 * редактирование поста использовало тот же submit и предзаполнение.
 */
export function CreateNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="CreateComposer" component={CreateComposerScreen} />
    </Stack.Navigator>
  );
}
