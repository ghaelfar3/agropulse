
import Feather from '@expo/vector-icons/Feather';
import type { ComponentProps } from 'react';
import type { StyleProp, TextStyle } from 'react-native';
import { useAppTheme } from '../theme';
export type IconName = string;
type FeatherName = ComponentProps<typeof Feather>['name'];
const names: Record<string, FeatherName> = {
  'account': 'user', 'account-outline': 'user', 'account-circle-outline': 'user',
  'menu': 'menu', 'close': 'x', 'logout': 'log-out', 'login': 'log-in',
  'camera-outline': 'camera', 'image-multiple-outline': 'image', 'image-outline': 'image',
  'pencil-outline': 'edit-2', 'pencil-plus-outline': 'edit-3', 'content-save-outline': 'save',
  'trash-can-outline': 'trash-2', 'dots-horizontal': 'more-horizontal', 'dots-vertical': 'more-vertical',
  'text-box-outline': 'file-text', 'text-box-multiple-outline': 'layers', 'view-grid-outline': 'grid',
  'map-marker-radius-outline': 'compass', 'map-marker-outline': 'map-pin', 'map-outline': 'map',
  'crosshairs-gps': 'navigation', 'crosshairs': 'crosshair', 'vector-polygon': 'hexagon',
  'vector-square-edit': 'edit', 'cursor-move': 'move', 'lifebuoy': 'life-buoy',
  'alert-circle-outline': 'alert-circle', 'sprout-outline': 'sun', 'leaf-circle-outline': 'feather',
  'heart-outline': 'heart', 'heart': 'heart', 'forum-outline': 'message-circle', 'comment-outline': 'message-square',
  'reply-outline': 'corner-up-left', 'bookmark-outline': 'bookmark', 'microphone-outline': 'mic',
  'stop-circle-outline': 'stop-circle', 'auto-fix': 'zap', 'restart': 'rotate-ccw',
  'send-outline': 'send', 'format-list-bulleted': 'align-left', 'eye-off': 'eye-off', 'eye': 'eye',
  'plus-circle-outline': 'plus-circle', 'robot-outline': 'cpu', 'chevron-down': 'chevron-down',
  'check-circle': 'check-circle', 'circle-outline': 'circle', 'help-circle-outline': 'help-circle',
  'magnify': 'search', 'menu-down': 'chevron-down', 'arrow-left': 'arrow-left',
  'email-outline': 'mail', 'lock-outline': 'lock', 'bell-outline': 'bell',
};
export function Icon({ name, size = 24, color, style }: { name: string; size?: number; color?: string; style?: StyleProp<TextStyle> }) {
  const theme = useAppTheme();
  const resolved = names[name] ?? (name in Feather.glyphMap ? name as FeatherName : 'circle');
  return <Feather name={resolved} size={size} color={color ?? theme.colors.onSurface} style={style} />;
}
