import DraftsScreen from '@/features/drafts/DraftsScreen';

import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import CreateScreen from '../features/create/screens/CreateScreen';
import HomeScreen from '../features/home/screens/HomeScreen';
import MapScreen from '../features/map/screens/MapScreen';
import ProfileScreen from '../features/profile/screens/ProfileScreen';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { RootTabParamList } from './types';

const Tab = createBottomTabNavigator<RootTabParamList>();

export function MainTabs() {


  return (
    <SafeAreaView edges={['bottom']} style={{ flex: 1 }}>
      <Tab.Navigator
        tabBar={() => null}
        initialRouteName="Home"
        screenOptions={{ headerShown: false }}
      >
        <Tab.Screen name="Drafts" component={DraftsScreen} options={{ title: 'На устройстве' }} />
        <Tab.Screen name="Home" component={HomeScreen} options={{ title: 'Лента' }} />
        <Tab.Screen
          name="Map"
          component={MapScreen}
          options={{
            title: 'Карта',
            lazy: true,
          }}
        />
        <Tab.Screen
          name="Create"
          component={CreateScreen}
          options={{ title: 'Создать' }}
          listeners={({ navigation }) => ({
            tabPress: () => navigation.setParams({ intent: undefined }),
          })}
        />
        <Tab.Screen
          name="Profile"
          component={ProfileScreen}
          options={{ title: 'Профиль' }}
        />
      </Tab.Navigator>
    </SafeAreaView>
  );
}
