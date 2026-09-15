import { Pressable, View } from 'react-native';
import { Text } from 'react-native-paper';
import { useAppTheme } from '@/theme';

export function PulseTabs({ value, onValueChange, buttons }: {
  value: string; onValueChange: (value: string) => void;
  buttons: { value: string; label?: string; icon?: unknown; disabled?: boolean }[];
}) {
  const { colors } = useAppTheme();
  return <View style={{ flexDirection: 'row', backgroundColor: colors.surfaceVariant, padding: 5, borderRadius: 18, gap: 5 }}>
    {buttons.map(button => <Pressable key={button.value} disabled={button.disabled} onPress={() => onValueChange(button.value)}
      accessibilityRole="tab" accessibilityState={{ selected: value === button.value, disabled: button.disabled }}
      style={{ flex: 1, minHeight: 48, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 8, borderRadius: 13, backgroundColor: value === button.value ? colors.surface : 'transparent' }}>
      <Text style={{ color: value === button.value ? colors.primary : colors.onSurfaceVariant, fontWeight: '800', textAlign: 'center' }}>{button.label}</Text>
      {value === button.value ? <View style={{ width: 18, height: 3, borderRadius: 2, backgroundColor: colors.primary, marginTop: 4 }} /> : null}
    </Pressable>)}
  </View>;
}
