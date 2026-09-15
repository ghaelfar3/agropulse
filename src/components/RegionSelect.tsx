import { PulseInput as TextInput } from '@/components/PulseInput';
import { PulseDialog as Dialog } from '@/components/PulseDialog';
import { useMemo, useState } from 'react';
import {
  Controller,
  type Control,
  type FieldPath,
  type FieldValues,
} from 'react-hook-form';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import {
  
  HelperText,
  List,
  Portal,
  Searchbar,
  
  type MD3Theme,
} from 'react-native-paper';

import { RF_REGIONS_SORTED } from '@/constants/regions';
import { useAppTheme } from '@/theme';

const UNSET_LABEL = 'Не указан';

type RegionSelectProps<T extends FieldValues> = {
  control: Control<T>;
  name: FieldPath<T>;
  label: string;
  /** Добавляет пункт «Не указан» вверху списка — для необязательного региона. */
  clearable?: boolean;
};

/**
 * Мост react-hook-form ↔ выбор региона РФ (области, края, республики и т.п.,
 * без городов) из статического списка `RF_REGIONS`. Само поле выглядит как
 * `FormTextInput`, но не редактируется напрямую — тап открывает диалог с
 * поиском и прокручиваемым списком.
 */
export function RegionSelect<T extends FieldValues>({
  control,
  name,
  label,
  clearable,
}: RegionSelectProps<T>) {
  const theme = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const [visible, setVisible] = useState(false);
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return RF_REGIONS_SORTED;
    return RF_REGIONS_SORTED.filter((region) => region.toLowerCase().includes(q));
  }, [query]);

  return (
    <Controller
      control={control}
      name={name}
      render={({ field: { value, onChange }, fieldState: { error } }) => {
        const close = () => {
          setVisible(false);
          setQuery('');
        };
        const select = (region: string) => {
          onChange(region);
          close();
        };

        return (
          <View style={styles.field}>
            <Pressable
              onPress={() => setVisible(true)}
              accessibilityRole="button"
              accessibilityLabel={`${label}: ${value || UNSET_LABEL}`}
            >
              <View
                pointerEvents="none"
                importantForAccessibility="no-hide-descendants"
                accessibilityElementsHidden
              >
                <TextInput
                  mode="outlined"
                  label={label}
                  value={value || ''}
                  editable={false}
                  error={Boolean(error)}
                  right={<TextInput.Icon icon="chevron-down" />}
                />
              </View>
            </Pressable>
            <HelperText type="error" visible={Boolean(error)}>
              {error?.message ?? ' '}
            </HelperText>

            <Portal>
              <Dialog visible={visible} onDismiss={close} style={styles.dialog}>
                <Dialog.Title>{label}</Dialog.Title>
                <Dialog.Content>
                  <Searchbar
                    placeholder="Поиск региона"
                    value={query}
                    onChangeText={setQuery}
                  />
                </Dialog.Content>
                <Dialog.ScrollArea style={styles.scrollArea}>
                  <ScrollView>
                    {clearable ? (
                      <List.Item title={UNSET_LABEL} onPress={() => select('')} />
                    ) : null}
                    {filtered.map((region) => (
                      <List.Item
                        key={region}
                        title={region}
                        onPress={() => select(region)}
                      />
                    ))}
                    {filtered.length === 0 ? (
                      <List.Item title="Ничего не найдено" disabled />
                    ) : null}
                  </ScrollView>
                </Dialog.ScrollArea>
              </Dialog>
            </Portal>
          </View>
        );
      }}
    />
  );
}

const makeStyles = (theme: MD3Theme) =>
  StyleSheet.create({
    field: {
      width: '100%',
    },
    dialog: {
      maxHeight: '80%',
    },
    scrollArea: {
      maxHeight: 400,
      paddingHorizontal: 0,
      borderColor: theme.colors.outlineVariant,
    },
  });
