
import { Pressable, StyleSheet, View, type GestureResponderEvent } from 'react-native';
import type { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';

import { Icon } from '../components/Icon';
import { useAppTheme } from '../theme';

/** Главная кнопка навбара: крупный «+» поверх плавающей панели. */
export function CreateTabButton({ onPress, accessibilityState }: BottomTabBarButtonProps) {
  const theme = useAppTheme();

  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={(event: GestureResponderEvent) => onPress?.(event)}
        accessibilityRole="button"
        accessibilityLabel="Создать"
        accessibilityState={accessibilityState}
        style={({ pressed }) => [
          styles.button,
          {
            backgroundColor: theme.colors.primary,
            borderColor: theme.colors.inverseSurface,
          },
          pressed && styles.pressed,
        ]}
      >
        <Icon name="plus" color={theme.colors.onPrimary} size={34} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -20,
  },
  button: {
    width: 66,
    height: 66,
    borderRadius: 33,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 6,
    elevation: 10,
    shadowColor: '#000',
    shadowOpacity: 0.22,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  pressed: {
    opacity: 0.85,
  },
});
