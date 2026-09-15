
import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text, type MD3Theme } from 'react-native-paper';

import { Icon, type IconName } from '@/components/Icon';
import { useAppTheme } from '@/theme';

export type ProfileSection = 'posts' | 'bookmarks' | 'fields';

type Props = {
  value: ProfileSection;
  onChange: (section: ProfileSection) => void;
};

const TABS: { key: ProfileSection; icon: IconName; label: string }[] = [
  { key: 'posts', icon: 'text-box-outline', label: 'Записи' },
  { key: 'bookmarks', icon: 'bookmark-outline', label: 'Избранное' },
  { key: 'fields', icon: 'map-marker-radius-outline', label: 'Участки' },
];

/** Плоский переключатель секций профиля — только иконки, без подписей. */
export function ProfileSectionTabs({ value, onChange }: Props) {
  const theme = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  return (
    <View style={styles.row}>
      {TABS.map(({ key, icon, label }) => {
        const active = key === value;
        return (
          <Pressable
            key={key}
            onPress={() => onChange(key)}
            style={[styles.tab, active && styles.tabActive]}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={label}
          >
            <Icon
              name={icon}
              color={active ? theme.colors.onPrimary : theme.colors.onSurfaceVariant}
            />
            <Text style={{ color: active ? theme.colors.onPrimary : theme.colors.onSurfaceVariant, fontSize: 12, fontWeight: '700', textAlign: 'center' }}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const makeStyles = (theme: MD3Theme) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      padding: 16,
      gap: 10,
      borderBottomColor: theme.colors.outline,
    },
    tab: {
      flexGrow: 1,
      flexBasis: '28%',
      minHeight: 66,
      gap: 8,
      borderRadius: 14,
      backgroundColor: theme.colors.surfaceVariant,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 10,
      borderBottomWidth: 2,
      borderBottomColor: 'transparent',
    },
    featured: {
      flexBasis: '100%',
      flexDirection: 'row',
      justifyContent: 'flex-start',
      paddingHorizontal: 24,
      minHeight: 64,
      gap: 16,
    },
    tabActive: {
      backgroundColor: theme.colors.primary,
    },
  });
