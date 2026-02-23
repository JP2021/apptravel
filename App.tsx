import { StatusBar } from 'expo-status-bar';
import { Platform, View } from 'react-native';
import { TripsProvider } from './src/context/TripsContext';
import { AppNavigator } from './src/navigation/AppNavigator';
import { webScreen } from './src/theme/webTheme';

export default function App() {
  return (
    <TripsProvider>
      <View style={[styles.root, Platform.OS === 'web' && webScreen]}>
        <StatusBar style="light" />
        <AppNavigator />
      </View>
    </TripsProvider>
  );
}

const styles = {
  root: {
    flex: 1,
    backgroundColor: '#060917',
  },
};
