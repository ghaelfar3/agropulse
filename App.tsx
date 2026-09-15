import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PaperProvider } from 'react-native-paper';

import { RootNavigator } from './src/navigation/RootNavigator';
import { AuthProvider } from './src/services/auth';
import { appTheme } from './src/theme';
import { Icon } from './src/components/Icon';
import { AppErrorBoundary } from './src/components/AppErrorBoundary';

export default function App() {
  return (
    <SafeAreaProvider>
      <PaperProvider theme={appTheme} settings={{ icon: props => <Icon {...props} /> }}>
        <AppErrorBoundary>
          <AuthProvider>
            <RootNavigator />
          </AuthProvider>
        </AppErrorBoundary>
      </PaperProvider>
    </SafeAreaProvider>
  );
}
