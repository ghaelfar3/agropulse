
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import EditPostScreen from '../features/create/screens/EditPostScreen';
import PostDetailScreen from '../features/post-detail/screens/PostDetailScreen';
import { MainTabs } from './MainTabs';
import type { AppStackParamList } from './types';

const Stack = createNativeStackNavigator<AppStackParamList>();

/**
 * Стек авторизованной части: таб-навигатор + детальные экраны поста поверх него.
 * `PostDetail` / `EditPost` подняты сюда, чтобы открываться и с «Главной», и с
 * «Профиля». Нативные хедеры выключены — экраны рисуют общий `AppHeader` сами.
 */
export function AppNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Tabs" component={MainTabs} />
      <Stack.Screen name="PostDetail" component={PostDetailScreen} />
      <Stack.Screen name="EditPost" component={EditPostScreen} />
    </Stack.Navigator>
  );
}
