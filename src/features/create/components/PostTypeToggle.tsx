import { PulseTabs as SegmentedButtons } from '@/components/PulseTabs';
import { Pressable, StyleSheet, View } from 'react-native';
import {  Text } from 'react-native-paper';

import { Icon, type IconName } from '@/components/Icon';
import { useAppTheme } from '@/theme';
import type { CreatePostFormValues } from '../schemas/createPostSchema';

type PostType = CreatePostFormValues['postTypeCode'];
type PostStage = CreatePostFormValues['stageCode'];

type Props = {
  value: PostType;
  onChange: (value: PostType) => void;
};

/** Тип поста — единственный способ задать обязательный `post_type_id`. */
export function PostTypeToggle({ value, onChange }: Props) {
  return (
    <SegmentedButtons
      value={value}
      onValueChange={(next) => onChange(next as PostType)}
      buttons={[
        { value: 'field_update', label: 'Пост', icon: 'sprout-outline' },
        { value: 'question', label: 'Вопрос', icon: 'help-circle-outline' },
      ]}
    />
  );
}

type StageToggleProps = {
  value: PostStage;
  onChange: (value: PostStage) => void;
};

export function PostStageToggle({ value, onChange }: StageToggleProps) {
  const theme = useAppTheme();

  return (
    <View style={styles.stageGrid}>
      {STAGES.map((stage) => {
        const active = value === stage.value;
        return (
          <Pressable
            key={stage.value}
            onPress={() => onChange(stage.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={`Этап поля: ${stage.label}`}
            style={[
              styles.stageChip,
              {
                backgroundColor: active
                  ? theme.colors.primary
                  : theme.colors.surface,
                borderColor: active ? theme.colors.primary : theme.colors.outline,
              },
            ]}
          >
            <Icon
              name={stage.icon}
              size={18}
              color={active ? theme.colors.onPrimary : theme.colors.primary}
            />
            <Text
              style={[
                styles.stageLabel,
                { color: active ? theme.colors.onPrimary : theme.colors.onSurface },
              ]}
            >
              {stage.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const STAGES: {
  value: PostStage;
  label: string;
  icon: IconName;
}[] = [
  { value: 'sowing', label: 'Посев', icon: 'seed-outline' },
  { value: 'sprouting', label: 'Всходы', icon: 'sprout-outline' },
  { value: 'flowering', label: 'Цветение', icon: 'flower-outline' },
  { value: 'problem', label: 'Проблема', icon: 'alert-outline' },
  { value: 'harvest', label: 'Урожай', icon: 'basket-outline' },
];

const styles = StyleSheet.create({
  stageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  stageChip: {
    minHeight: 44,
    minWidth: 104,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
  },
  stageLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
});
