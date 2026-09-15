import { Modal, Pressable, ScrollView, View, type ViewProps } from 'react-native';
import { Text, type TextProps } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { KeyboardLift } from './KeyboardLift';
import { Icon as PulseIcon } from './Icon';
import { useAppTheme } from '@/theme';
import type { ReactNode } from 'react';

function Sheet({ visible, onDismiss, dismissable = true, children }: { visible: boolean; onDismiss?: () => void; dismissable?: boolean; children: ReactNode; style?: ViewProps['style'] }) {
  const { colors } = useAppTheme();
  return <Modal visible={visible} transparent animationType="slide" onRequestClose={() => { if (dismissable) onDismiss?.(); }}>
    <KeyboardLift>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Закрыть окно" disabled={!dismissable} onPress={onDismiss}
          style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: colors.backdrop }} />
        <SafeAreaView edges={['bottom']} style={{ maxHeight: '90%', backgroundColor: colors.surface, borderTopLeftRadius: 32, borderTopRightRadius: 32, paddingTop: 12 }}>
          <View style={{ height: 4, width: 40, borderRadius: 4, backgroundColor: colors.outline, alignSelf: 'center', marginBottom: 20 }} />
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 16 }} bounces={false}>{children}</ScrollView>
        </SafeAreaView>
      </View>
    </KeyboardLift>
  </Modal>;
}
function Title(props: TextProps<string>) { return <Text {...props} style={[{ fontSize: 26, fontWeight: '800', paddingHorizontal: 24, marginBottom: 20 }, props.style]} />; }
function Content(props: ViewProps) { return <View {...props} style={[{ paddingHorizontal: 24, paddingBottom: 20 }, props.style]} />; }
function Actions(props: ViewProps) { return <View {...props} style={[{ paddingHorizontal: 24, gap: 12, paddingBottom: 12 }, props.style]} />; }
function SheetIcon({ icon, color }: { icon: string; color?: string }) { return <View style={{ paddingHorizontal: 24, marginBottom: 14 }}><PulseIcon name={icon} color={color} size={30} /></View>; }
export const PulseDialog = Object.assign(Sheet, { Title, Content, Actions, ScrollArea: Content, Icon: SheetIcon });
