import React from 'react';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { TamaguiProvider, Theme } from 'tamagui';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import config from './tamagui.config';
import { COLORS } from './lib/constants';

import SendScreen from './screens/SendScreen';
import ReceiveScreen from './screens/ReceiveScreen';
import HistoryScreen from './screens/HistoryScreen';
import SettingsScreen from './screens/SettingsScreen';

const Tab = createBottomTabNavigator();

const DarkNavTheme = {
  ...DefaultTheme,
  dark: true,
  colors: {
    ...DefaultTheme.colors,
    primary: COLORS.primary,
    background: COLORS.bgDeep,
    card: COLORS.bgCard,
    text: COLORS.textPrimary,
    border: COLORS.border,
    notification: COLORS.primary,
  },
};

export default function App() {
  return (
    <TamaguiProvider config={config} defaultTheme="dark">
      <Theme name="dark">
        <StatusBar style="light" />
        <NavigationContainer theme={DarkNavTheme}>
          <Tab.Navigator
            screenOptions={{
              headerShown: false,
              tabBarStyle: {
                backgroundColor: COLORS.bgCard,
                borderTopColor: COLORS.border,
                borderTopWidth: 1,
                height: 65,
                paddingBottom: 8,
                paddingTop: 8,
                elevation: 0,
                shadowOpacity: 0,
              },
              tabBarActiveTintColor: COLORS.primary,
              tabBarInactiveTintColor: COLORS.textMuted,
              tabBarLabelStyle: {
                fontSize: 11,
                fontWeight: '600',
                letterSpacing: 0.3,
              },
            }}
          >
            <Tab.Screen
              name="Send"
              component={SendScreen}
              options={{
                tabBarIcon: ({ color, size }) => (
                  <Ionicons name="arrow-up-circle" size={size} color={color} />
                ),
              }}
            />
            <Tab.Screen
              name="Receive"
              component={ReceiveScreen}
              options={{
                tabBarIcon: ({ color, size }) => (
                  <Ionicons name="arrow-down-circle" size={size} color={color} />
                ),
              }}
            />
            <Tab.Screen
              name="History"
              component={HistoryScreen}
              options={{
                tabBarIcon: ({ color, size }) => (
                  <Ionicons name="time" size={size} color={color} />
                ),
              }}
            />
            <Tab.Screen
              name="Settings"
              component={SettingsScreen}
              options={{
                tabBarIcon: ({ color, size }) => (
                  <Ionicons name="settings-sharp" size={size} color={color} />
                ),
              }}
            />
          </Tab.Navigator>
        </NavigationContainer>
      </Theme>
    </TamaguiProvider>
  );
}
