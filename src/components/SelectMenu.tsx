import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Text, Searchbar } from 'react-native-paper';
import { PulseDialog } from './PulseDialog';
import { Icon } from './Icon';
import { useAppTheme } from '@/theme';
export type SelectMenuOption<T extends string | number | null> = { value: T; label: string; description?: string };
export function SelectMenu<T extends string | number | null>({ label, value, options, disabled, onChange }: { label: string; value: T; options: SelectMenuOption<T>[]; disabled?: boolean; onChange: (value: T) => void }) {
  const { colors } = useAppTheme();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const selected = options.find(o => o.value === value);
  const filtered = options.filter(o => o.label.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  return <View>
    <Pressable disabled={disabled} onPress={() => { setQuery(''); setOpen(true); }} accessibilityRole="button" accessibilityLabel={label + ': ' + (selected?.label ?? 'Выбрать')}
      style={{ minHeight: 62, backgroundColor: colors.surfaceVariant, borderRadius: 16, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, opacity: disabled ? 0.5 : 1 }}>
      <View style={{ flex: 1 }}><Text style={{ color: colors.onSurfaceVariant, fontSize: 11, fontWeight: '700' }}>{label}</Text><Text style={{ fontSize: 16, fontWeight: '600', marginTop: 3 }}>{selected?.label ?? 'Выбрать'}</Text></View><Icon name="chevron-down" size={18} />
    </Pressable>
    <PulseDialog visible={open} onDismiss={() => setOpen(false)}>
      <PulseDialog.Title>{label}</PulseDialog.Title>
      <PulseDialog.Content>
        {options.length > 7 ? <Searchbar placeholder="Найти в списке" value={query} onChangeText={setQuery} style={{ marginBottom: 12 }} /> : null}
        {filtered.map(o => <Pressable key={String(o.value)} onPress={() => { onChange(o.value); setOpen(false); }} accessibilityRole="radio" accessibilityState={{ checked: value === o.value }}
          style={{ paddingVertical: 16, paddingHorizontal: 12, borderRadius: 12, marginBottom: 4, backgroundColor: o.value === value ? colors.primaryContainer : colors.surface, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ flex: 1 }}><Text style={{ fontWeight: '600', fontSize: 16 }}>{o.label}</Text>{o.description ? <Text style={{ color: colors.onSurfaceVariant, marginTop: 3 }}>{o.description}</Text> : null}</View>{value === o.value ? <Icon name="check" color={colors.primary} size={20} /> : null}
        </Pressable>)}
        {filtered.length === 0 ? <Text>Ничего не найдено</Text> : null}
      </PulseDialog.Content>
    </PulseDialog>
  </View>;
}
