
import { Pressable } from 'react-native';
import { Text } from 'react-native-paper';
import type { ReactionSummary } from '@/types/reactions';
import { useAppTheme } from '@/theme';
import { Icon } from './Icon';

type Props = { reactions: ReactionSummary[]; onToggle: (code: string) => void; disabled?: boolean };
export function ReactionControl({ reactions, onToggle, disabled }: Props) {
  const { colors } = useAppTheme();
  const mine = reactions.find(r => r.mine);
  const target = mine ?? reactions.find(r => r.code === 'like') ?? reactions.find(r => r.code === 'same') ?? reactions[0];
  const count = reactions.reduce((sum, r) => sum + r.count, 0);
  return <Pressable onPress={() => target && onToggle(target.code)} disabled={disabled || !target}
    accessibilityRole="button" accessibilityLabel={mine ? 'Убрать лайк' : 'Нравится'} accessibilityState={{ selected: Boolean(mine), disabled: disabled || !target }}
    style={({ pressed }) => ({ minWidth: 48, minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 7, opacity: pressed ? 0.6 : 1 })}>
    <Icon name={mine ? 'heart' : 'heart-outline'} size={23} color={mine ? '#E44F78' : colors.onSurfaceVariant} />
    <Text style={{ color: colors.onSurfaceVariant }}>{count || ''}</Text>
  </Pressable>;
}
