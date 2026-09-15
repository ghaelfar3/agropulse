
import { useNavigation, StackActions } from '@react-navigation/native';
import { Modal, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { IconButton, Text } from 'react-native-paper';
import { Icon, type IconName } from './Icon';
import { useAppTheme } from '@/theme';

const items: { screen: string; label: string; detail: string; icon: IconName }[] = [
  { screen: 'Home', label: 'Пульс', detail: 'Новости сообщества', icon: 'text-box-multiple-outline' },
  { screen: 'Map', label: 'Атлас полей', detail: 'Участки рядом', icon: 'map-marker-radius-outline' },
  { screen: 'Create', label: 'Новая запись', detail: 'Голосом или вручную', icon: 'pencil-plus-outline' },
  { screen: 'Drafts', label: 'На устройстве', detail: 'Неопубликованные записи', icon: 'inbox' },
  { screen: 'Profile', label: 'Моя страница', detail: 'Публикации и поля', icon: 'account-circle-outline' },
];

export function AppDrawer({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const navigation = useNavigation();
  const { colors } = useAppTheme();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, flexDirection: 'row' }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Закрыть меню" onPress={onClose}
          style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: colors.backdrop }} />
        <SafeAreaView style={{ width: '86%', maxWidth: 340, backgroundColor: '#073F38', paddingHorizontal: 20 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginVertical: 20 }}>
            <Text style={{ fontSize: 28, fontWeight: '900', color: '#B5F5DD' }}>AgroPulse</Text>
            <IconButton icon="close" iconColor="white" accessibilityLabel="Закрыть меню" onPress={onClose} />
          </View>
          {items.map(item => (
            <Pressable key={item.screen} accessibilityRole="button" accessibilityLabel={item.label}
              onPress={() => {
                onClose();
                let target = navigation;
                while (!target.getState()?.routeNames.includes('Tabs') && target.getParent()) target = target.getParent()!;
                target.dispatch(StackActions.popTo('Tabs', { screen: item.screen, params: item.screen === 'Create' ? { intent: undefined, draftId: undefined, openedAt: undefined } : undefined }));
              }}
              style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 16, padding: 16, marginBottom: 10, borderRadius: 14, backgroundColor: pressed ? '#216359' : '#145047' })}>
              <Icon name={item.icon} color="#B5F5DD" />
              <View style={{ flex: 1 }}><Text style={{ fontSize: 17, fontWeight: '700', color: 'white' }}>{item.label}</Text><Text style={{ color: '#B1CFC8', marginTop: 3 }}>{item.detail}</Text></View>
            </Pressable>
          ))}
        </SafeAreaView>
      </View>
    </Modal>
  );
}
