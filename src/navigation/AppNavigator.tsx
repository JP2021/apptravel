import { NavigationContainer } from '@react-navigation/native';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Platform } from 'react-native';
import { CreateTripScreen } from '../screens/CreateTripScreen';
import { MyTripsScreen } from '../screens/MyTripsScreen';
import { TripTimelineScreen } from '../screens/TripTimelineScreen';
import { RootStackParamList, TabParamList } from '../types';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createMaterialTopTabNavigator<TabParamList>();

function TabsNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarStyle: {
          backgroundColor: '#060917',
          elevation: 0,
          shadowOpacity: 0,
          borderBottomWidth: 1,
          borderBottomColor: '#1E293B',
          ...(Platform.OS === 'web' && {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.12,
            shadowRadius: 12,
          }),
        },
        tabBarActiveTintColor: '#FFFFFF',
        tabBarInactiveTintColor: '#94A3B8',
        tabBarLabelStyle: {
          fontSize: 15,
          fontWeight: '800',
          textTransform: 'none',
        },
        tabBarIndicatorStyle: {
          backgroundColor: '#3B82F6',
          height: 3,
        },
        tabBarIndicatorContainerStyle: {
          backgroundColor: '#060917',
        },
        tabBarItemStyle: {
          paddingVertical: 14,
        },
      }}
    >
      <Tab.Screen
        name="MinhasViagens"
        component={MyTripsScreen}
        options={{
          title: 'Minhas viagens',
          tabBarLabel: 'Minhas viagens',
        }}
      />
      <Tab.Screen
        name="Cadastrar"
        component={CreateTripScreen}
        options={{
          title: 'Cadastrar',
          tabBarLabel: 'Cadastrar',
        }}
      />
    </Tab.Navigator>
  );
}

const darkTheme = {
  dark: true,
  colors: {
    primary: '#60A5FA',
    background: '#060917',
    card: '#060917',
    text: '#F8FAFC',
    border: '#1E293B',
    notification: '#3B82F6',
  },
  fonts: {
    regular: { fontFamily: 'System', fontWeight: '400' as const },
    medium: { fontFamily: 'System', fontWeight: '500' as const },
    bold: { fontFamily: 'System', fontWeight: '700' as const },
    heavy: { fontFamily: 'System', fontWeight: '900' as const },
  },
};

export function AppNavigator() {
  return (
    <NavigationContainer theme={darkTheme}>
      <Stack.Navigator>
        <Stack.Screen name="Tabs" component={TabsNavigator} options={{ headerShown: false }} />
        <Stack.Screen
          name="Timeline"
          component={TripTimelineScreen}
          options={{
            title: 'Timeline da viagem',
            headerStyle: { backgroundColor: '#060917' },
            headerTintColor: '#F8FAFC',
            headerTitleStyle: { fontWeight: '800' },
          }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
