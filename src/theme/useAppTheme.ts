import { useTheme, type MD3Theme } from 'react-native-paper';

/**
 * Типизированный доступ к теме приложения (`appTheme`) внутри экранов и
 * компонентов. Используйте для цветов/токенов вместо хардкода hex.
 */
export const useAppTheme = () => useTheme<MD3Theme>();
