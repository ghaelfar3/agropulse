
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Keyboard, View, type StyleProp, type ViewStyle } from 'react-native';

/** Убирает только реальное перекрытие клавиатурой, в том числе в Expo Go. */
export function KeyboardLift({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const container = useRef<View>(null);
  const keyboardTop = useRef<number | null>(null);
  const [overlap, setOverlap] = useState(0);
  const measure = useCallback(() => {
    container.current?.measureInWindow((_x, y, _width, height) => {
      setOverlap(keyboardTop.current === null ? 0 : Math.max(0, y + height - keyboardTop.current));
    });
  }, []);
  useEffect(() => {
    const metrics = Keyboard.metrics();
    keyboardTop.current = metrics?.screenY ?? null;
    measure();
    const show = Keyboard.addListener('keyboardDidShow', event => {
      keyboardTop.current = event.endCoordinates.screenY;
      measure();
    });
    const frame = Keyboard.addListener('keyboardWillChangeFrame', event => {
      keyboardTop.current = event.endCoordinates.screenY;
      measure();
    });
    const hide = Keyboard.addListener('keyboardDidHide', () => {
      keyboardTop.current = null;
      setOverlap(0);
    });
    return () => { show.remove(); frame.remove(); hide.remove(); };
  }, [measure]);
  return <View ref={container} collapsable={false} onLayout={measure} style={[{ flex: 1 }, style]}>
    <View style={{ flex: 1, marginBottom: overlap }}>{children}</View>
  </View>;
}
