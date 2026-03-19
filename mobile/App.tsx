import React, { useEffect, useState, useCallback } from 'react';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { TamaguiProvider, Theme, YStack, XStack, Text, Button, Card, Spinner } from 'tamagui';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView, Alert } from 'react-native';
import config from './tamagui.config';
import { COLORS } from './lib/constants';
import { getStoredUser, signInWithGoogle, User } from './services/auth';
import { AuthProvider } from './contexts/auth';
import {
  initializeRevenueCat,
  logInToRevenueCat,
  logOutOfRevenueCat,
} from './services/subscription';

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
  const [user, setUser] = useState<User | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [signingIn, setSigningIn] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const stored = await getStoredUser();
      if (mounted) {
        setUser(stored);
        setCheckingAuth(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    initializeRevenueCat();
  }, []);

  useEffect(() => {
    if (user?.id) {
      logInToRevenueCat(user.id);
    } else {
      logOutOfRevenueCat();
    }
  }, [user?.id]);

  const handleGoogleSignIn = useCallback(async () => {
    setSigningIn(true);
    try {
      const signedInUser = await signInWithGoogle();
      if (signedInUser) {
        setUser(signedInUser);
      } else {
        Alert.alert('Error', 'Sign-in failed. Please try again.');
      }
    } catch {
      Alert.alert('Error', 'Sign-in failed. Please try again.');
    } finally {
      setSigningIn(false);
    }
  }, []);

  return (
    <TamaguiProvider config={config} defaultTheme="dark">
      <Theme name="dark">
        <StatusBar style="light" />
        <AuthProvider user={user} setUser={setUser}>
          {checkingAuth ? (
            <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.bgDeep }}>
              <YStack flex={1} alignItems="center" justifyContent="center">
                <Spinner size="large" color={COLORS.primary} />
              </YStack>
            </SafeAreaView>
          ) : user ? (
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
          ) : (
            <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.bgDeep }}>
              <YStack
                flex={1}
                alignItems="center"
                justifyContent="center"
                padding="$6"
                gap="$5"
              >
                <XStack alignItems="center" gap="$3">
                  <YStack
                    width={52}
                    height={52}
                    borderRadius={16}
                    backgroundColor={COLORS.primary}
                    alignItems="center"
                    justifyContent="center"
                  >
                    <Ionicons name="paper-plane" size={26} color={COLORS.bgDeep} />
                  </YStack>
                  <YStack>
                    <Text color={COLORS.textPrimary} fontSize={22} fontWeight="800">
                      Drop
                    </Text>
                    <Text color={COLORS.textMuted} fontSize={12}>
                      P2P file sharing
                    </Text>
                  </YStack>
                </XStack>

                <Card
                  backgroundColor={COLORS.bgCard}
                  borderRadius={20}
                  borderWidth={1}
                  borderColor={COLORS.border}
                  padding="$5"
                  width="100%"
                >
                  <YStack gap="$4">
                    <Text color={COLORS.textPrimary} fontSize={18} fontWeight="700">
                      Sign in to continue
                    </Text>
                    <Text color={COLORS.textSecondary} fontSize={13}>
                      Connect your account to track usage, unlock Pro, and sync transfers.
                    </Text>
                    <Button
                      size="$4"
                      backgroundColor={COLORS.bgElevated}
                      color={COLORS.textPrimary}
                      fontWeight="600"
                      borderRadius={12}
                      borderWidth={1}
                      borderColor={COLORS.border}
                      pressStyle={{ backgroundColor: COLORS.bgCardHover }}
                      icon={
                        <Ionicons name="logo-google" size={18} color={COLORS.textSecondary} />
                      }
                      onPress={handleGoogleSignIn}
                      disabled={signingIn}
                    >
                      {signingIn ? 'Signing in...' : 'Sign in with Google'}
                    </Button>
                  </YStack>
                </Card>
              </YStack>
            </SafeAreaView>
          )}
        </AuthProvider>
      </Theme>
    </TamaguiProvider>
  );
}
