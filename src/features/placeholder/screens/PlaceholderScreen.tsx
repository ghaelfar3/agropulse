
import { View } from 'react-native';

import { AppHeader } from '@/components/AppHeader';
import { ScreenPlaceholder } from '@/components/ScreenPlaceholder';

export default function PlaceholderScreen() {
  return (
    <View style={{ flex: 1 }}>
      <AppHeader title="Раздел" />
      <ScreenPlaceholder text="Раздел в разработке" />
    </View>
  );
}
