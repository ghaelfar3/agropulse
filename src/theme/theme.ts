import {
  DefaultTheme as NavigationLightBase,
  type Theme as NavigationTheme,
} from '@react-navigation/native';
import { MD3LightTheme, type MD3Theme } from 'react-native-paper';

const brand = {
  primary: '#007F65',
  onPrimary: '#FFFFFF',
  accentSoft: '#D5F5E8',
  onAccentSoft: '#063B2B',
  background: '#F3F8FC',
  surface: '#FFFFFF',
  surfaceRaised: '#EAF2F6',
  text: '#15231F',
  textMuted: '#60706A',
  border: '#D8E5ED',
  danger: '#C24136',
  onDanger: '#FFFFFF',
};

/**
 * Светлая тема Material Design 3 для Agro SOS: чистый фон, зелёный основной
 * акцент и мягкие поверхности для ленты и форм.
 */
export const appTheme: MD3Theme = {
  ...MD3LightTheme,
  roundness: 5,
  colors: {
    ...MD3LightTheme.colors,
    primary: brand.primary,
    onPrimary: brand.onPrimary,
    primaryContainer: brand.accentSoft,
    onPrimaryContainer: brand.onAccentSoft,
    background: brand.background,
    onBackground: brand.text,
    surface: brand.surface,
    onSurface: brand.text,
    surfaceVariant: brand.surfaceRaised,
    onSurfaceVariant: brand.textMuted,
    outline: brand.border,
    outlineVariant: brand.border,
    error: brand.danger,
    errorContainer: brand.danger,
    onError: brand.onDanger,
    onErrorContainer: brand.onDanger,

    elevation: {
      level0: 'transparent',
      level1: brand.surface,
      level2: brand.surface,
      level3: brand.surface,
      level4: brand.surface,
      level5: brand.surface,
    },
    secondary: brand.primary,
    onSecondary: brand.onPrimary,
    secondaryContainer: brand.accentSoft, // выбранный сегмент SegmentedButtons
    onSecondaryContainer: brand.onAccentSoft,
    tertiary: '#4C69D8',
    onTertiary: brand.onPrimary,
    tertiaryContainer: brand.accentSoft,
    onTertiaryContainer: brand.onAccentSoft,
    backdrop: 'rgba(21, 35, 31, 0.45)',
    surfaceDisabled: 'rgba(21, 35, 31, 0.12)',
    onSurfaceDisabled: 'rgba(21, 35, 31, 0.38)',
    inverseSurface: brand.text,
    inverseOnSurface: brand.background,
    inversePrimary: brand.accentSoft,
  },
};

/** Тема навигации (навбар, хедер, активный таб) из той же палитры. */
export const navigationTheme: NavigationTheme = {
  ...NavigationLightBase,
  colors: {
    ...NavigationLightBase.colors,
    primary: appTheme.colors.primary,
    background: appTheme.colors.background,
    card: appTheme.colors.surface,
    text: appTheme.colors.onSurface,
    border: appTheme.colors.outline,
    notification: appTheme.colors.error,
  },
};
