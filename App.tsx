import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/services/AuthContext';
import RootNavigator from './src/navigation/RootNavigator';

const linking = {
  prefixes: ['https://drift-medical-residency-xi.vercel.app', 'exp://'],
  config: {
    screens: {
      Login: 'login',
      SignUp: 'signup',
      ForgotPassword: 'forgot-password',
      ResetPassword: 'reset-password',
      CompleteProfile: 'complete-profile',
      Home: {
        path: 'home',
        screens: {
          HomeMain: '',
          CreateAnnouncement: 'create-announcement',
          EditAnnouncement: 'edit-announcement',
        },
      },
      Events: {
        path: 'events',
        screens: {
          EventsList: '',
          EventDetails: ':id',
          CreateEvent: 'create',
        },
      },
      Wellness: 'wellness',
      Profile: 'profile',
      Approvals: 'approvals',
    },
  },
};

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <NavigationContainer linking={linking as any}>
          <RootNavigator />
        </NavigationContainer>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
