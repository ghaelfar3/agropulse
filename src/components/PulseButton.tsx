import { Button, type ButtonProps } from 'react-native-paper';

export function PulseButton({ style, contentStyle, labelStyle, compact, ...props }: ButtonProps) {
  return <Button {...props} compact={compact}
    style={[{ borderRadius: 14 }, style]}
    contentStyle={[{ minHeight: compact ? 44 : 50 }, contentStyle]}
    labelStyle={[{ fontSize: 14, fontWeight: '700', letterSpacing: 0.1 }, labelStyle]} />;
}
