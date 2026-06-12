import React from 'react';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useAuth } from '../services/AuthContext';

// Auth Screens
import LoginScreen from '../screens/LoginScreen';
import SignUpScreen from '../screens/SignUpScreen';

// Main Screens
import CompleteProfileScreen from '../screens/CompleteProfileScreen';
import HomeScreen from '../screens/HomeScreen';
import ApprovalsScreen from '../screens/ApprovalsScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function AuthStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="SignUp" component={SignUpScreen} />
    </Stack.Navigator>
  );
}

function MainTabs() {
  const { profile } = useAuth();
  const isApproved = profile?.is_approved;
  const canManageApprovals =
    isApproved && (profile?.role === 'admin' || profile?.role === 'chief_resident');

  return (
    <Tab.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: '#3498db',
        },
        headerTintColor: '#fff',
        headerTitleStyle: {
          fontWeight: 'bold',
        },
        tabBarActiveTintColor: '#3498db',
        tabBarInactiveTintColor: '#7f8c8d',
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          title: 'Drift',
          tabBarLabel: 'Home',
        }}
      />
      {canManageApprovals && (
        <Tab.Screen
          name="Approvals"
          component={ApprovalsScreen}
          options={{
            title: 'Manage Approvals',
            tabBarLabel: 'Approvals',
          }}
        />
      )}
    </Tab.Navigator>
  );
}

export default function RootNavigator() {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3498db" />
      </View>
    );
  }

  // Not authenticated
  if (!user) {
    return <AuthStack />;
  }

  // Authenticated but profile not complete
  if (!profile?.is_profile_complete) {
    return (
      <Stack.Navigator>
        <Stack.Screen
          name="CompleteProfile"
          component={CompleteProfileScreen}
          options={{
            title: 'Complete Profile',
            headerStyle: {
              backgroundColor: '#3498db',
            },
            headerTintColor: '#fff',
            headerTitleStyle: {
              fontWeight: 'bold',
            },
            headerLeft: () => null, // Prevent back navigation
          }}
        />
      </Stack.Navigator>
    );
  }

  // Profile complete - show main app (approval banner shown in HomeScreen if pending)
  return <MainTabs />;
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
});
