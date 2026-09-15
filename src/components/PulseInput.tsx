import { forwardRef, type ComponentRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text, TextInput as PaperInput, type TextInputProps } from 'react-native-paper';
import { useAppTheme } from '@/theme';

const Input = forwardRef<ComponentRef<typeof PaperInput>, TextInputProps>(function Input({ label, style, ...props }, ref) {
  const { colors } = useAppTheme();
  const { flex, flexGrow, flexShrink, ...inputStyle } = StyleSheet.flatten(style) ?? {};
  return <View style={{ flex, flexGrow, flexShrink: flexShrink ?? 1, gap: 7 }}>
    {label ? <Text style={{ fontSize: 12, fontWeight: '800', letterSpacing: 0.6, color: colors.onSurfaceVariant }}>{label}</Text> : null}
    <PaperInput {...props} ref={(instance: ComponentRef<typeof PaperInput> | null) => { if (typeof ref === 'function') ref(instance); else if (ref) ref.current = instance; }} label={undefined} mode="outlined"
      outlineStyle={{ borderRadius: 16, borderWidth: 1 }} outlineColor="transparent"
      activeOutlineColor={colors.primary} style={[{ backgroundColor: colors.surfaceVariant, fontSize: 16 }, inputStyle]} />
  </View>;
});
export const PulseInput = Object.assign(Input, { Icon: PaperInput.Icon, Affix: PaperInput.Affix });
