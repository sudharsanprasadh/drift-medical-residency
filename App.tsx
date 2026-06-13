import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/services/AuthContext';
import RootNavigator from './src/navigation/RootNavigator';

const linking = {
  prefixes: ['https://drift-medical-residency-xi.vercel.app', 'exp://'],
  config: {
    screens: {
      Auth: {
        screens: {
          Login: 'login',
          SignUp: 'signup',
        },
      },
      CompleteProfile: 'complete-profile',
      Main: {
        screens: {
          HomeTabs: {
            path: 'home',
            screens: {
              Home: 'feed',
              Events: 'events',
              Approvals: 'approvals',
              Profile: 'profile',
            },
          },
          EventDetails: 'event/:id',
          CreateEvent: 'create-event',
          CreateAnnouncement: 'create-announcement',
        },
      },
    },
  },
};

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <NavigationContainer linking={linking}>
          <RootNavigator />
        </NavigationContainer>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
