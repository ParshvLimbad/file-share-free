import { useState, useEffect, useCallback } from 'react';
import {
  YStack,
  XStack,
  Text,
  Button,
  Card,
  ScrollView,
} from 'tamagui';
import { SafeAreaView, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  COLORS,
  PRO_MONTHLY_PRICE,
  ADS_REQUIRED_FOR_BONUS,
} from '../lib/constants';
import { formatBytes } from '../lib/fileUtils';
import { signInWithGoogle, signOut, updateStoredUserPlan, User } from '../services/auth';
import { getCurrentUsage, UsageInfo, recordAdBonus } from '../services/usage';
import { showThreeRewardedAds } from '../services/ads';
import {
  checkSubscriptionStatus,
  isSubscriptionAvailable,
  purchaseProSubscription,
  restorePurchases,
} from '../services/subscription';
import { useAuth } from '../contexts/auth';

export default function SettingsScreen() {
  const { user, setUser } = useAuth();
  const [usage, setUsage] = useState<UsageInfo>({
    bytesUsed: 0,
    bonusBytes: 0,
    adWatchesToday: 0,
    adsRemaining: ADS_REQUIRED_FOR_BONUS,
    canWatchAds: true,
    totalLimit: 1073741824,
    remaining: 1073741824,
    percentUsed: 0,
    canTransfer: true,
  });
  const [loadingAds, setLoadingAds] = useState(false);
  const [signingIn, setSigningIn] = useState(false);

  const isPro = user?.plan === 'pro';

  const loadData = useCallback(
    async (nextUser?: User | null) => {
      const effectiveUser = nextUser ?? user;
      const usageInfo = await getCurrentUsage(
        effectiveUser?.id || null,
        effectiveUser?.plan === 'pro'
      );
      setUsage(usageInfo);
    },
    [user]
  );

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleGoogleSignIn = useCallback(async () => {
    setSigningIn(true);
    try {
      const signedInUser = await signInWithGoogle();
      if (signedInUser) {
        setUser(signedInUser);
        loadData(signedInUser);
      }
    } catch (error) {
      Alert.alert('Error', 'Sign-in failed. Please try again.');
    } finally {
      setSigningIn(false);
    }
  }, [loadData, setUser]);

  const handleSignOut = useCallback(async () => {
    await signOut();
    setUser(null);
    loadData(null);
  }, [loadData, setUser]);

  const handleWatchAds = useCallback(async () => {
    if (!usage.canWatchAds) {
      Alert.alert(
        'Ad limit reached',
        'You can watch only 3 ads every 24 hours. Please come back tomorrow.'
      );
      return;
    }
    setLoadingAds(true);
    try {
      const watched = await showThreeRewardedAds();
      if (watched) {
        const recorded = await recordAdBonus(user?.id || null);
        if (recorded) {
          Alert.alert('🎉 Bonus Added!', 'You earned an extra 1 GB of transfer data today!');
          loadData(); // Refresh usage
        } else {
          Alert.alert(
            'Ad limit reached',
            'You have already watched 3 ads today. Please try again tomorrow.'
          );
        }
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to show ads. Please try again.');
    } finally {
      setLoadingAds(false);
    }
  }, [loadData, user, usage.canWatchAds]);

  const handleUpgrade = useCallback(async () => {
    const purchased = await purchaseProSubscription();
    if (purchased) {
      if (isSubscriptionAvailable) {
        const status = await checkSubscriptionStatus();
        if (status.isPro) {
          await updateStoredUserPlan('pro', status.expiresAt);
          setUser((prev) =>
            prev ? { ...prev, plan: 'pro', planExpiresAt: status.expiresAt } : prev
          );
        }
      } else {
        await updateStoredUserPlan('pro', null);
        setUser((prev) => (prev ? { ...prev, plan: 'pro', planExpiresAt: null } : prev));
      }
      Alert.alert('🎉 Welcome to Pro!', 'You now have unlimited transfers up to 50GB per file.');
      loadData();
    }
  }, [loadData, setUser]);

  const handleRestore = useCallback(async () => {
    const restored = await restorePurchases();
    if (restored) {
      if (isSubscriptionAvailable) {
        const status = await checkSubscriptionStatus();
        if (status.isPro) {
          await updateStoredUserPlan('pro', status.expiresAt);
          setUser((prev) =>
            prev ? { ...prev, plan: 'pro', planExpiresAt: status.expiresAt } : prev
          );
        }
      }
      Alert.alert('Restored', 'Your Pro subscription has been restored.');
      loadData();
    }
  }, [loadData, setUser]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.bgDeep }}>
      <ScrollView
        flex={1}
        backgroundColor={COLORS.bgDeep}
        contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
      >
        {/* Header */}
        <YStack marginTop="$4" marginBottom="$5">
          <Text
            color={COLORS.textPrimary}
            fontSize={22}
            fontWeight="700"
            letterSpacing={-0.5}
          >
            Settings
          </Text>
        </YStack>

        {/* Usage Card */}
        <Card
          backgroundColor={COLORS.bgCard}
          borderRadius={18}
          borderWidth={1}
          borderColor={COLORS.border}
          padding="$4"
          marginBottom="$4"
        >
          <YStack gap="$3">
            <XStack justifyContent="space-between" alignItems="center">
              <Text
                color={COLORS.textMuted}
                fontSize={11}
                fontWeight="600"
                textTransform="uppercase"
                letterSpacing={1}
              >
                Daily Usage
              </Text>
              <XStack
                backgroundColor={isPro ? COLORS.primaryGlow : COLORS.warningBg}
                paddingHorizontal="$2.5"
                paddingVertical="$1"
                borderRadius={8}
                borderWidth={1}
                borderColor={isPro ? COLORS.primary + '20' : COLORS.warning + '20'}
              >
                <Text
                  color={isPro ? COLORS.primary : COLORS.warning}
                  fontSize={11}
                  fontWeight="700"
                >
                  {isPro ? 'PRO' : 'FREE'}
                </Text>
              </XStack>
            </XStack>

            {/* Progress bar */}
            <YStack gap="$2">
              <YStack
                height={8}
                borderRadius={4}
                backgroundColor={COLORS.bgElevated}
                overflow="hidden"
              >
                <YStack
                  height="100%"
                  width={`${usage.percentUsed}%` as any}
                  borderRadius={4}
                  backgroundColor={
                    usage.percentUsed > 80
                      ? COLORS.error
                      : usage.percentUsed > 50
                      ? COLORS.warning
                      : COLORS.primary
                  }
                />
              </YStack>
              <XStack justifyContent="space-between">
                <Text color={COLORS.textSecondary} fontSize={12}>
                  {formatBytes(usage.bytesUsed)} used
                </Text>
                <Text color={COLORS.textMuted} fontSize={12}>
                  {formatBytes(usage.totalLimit)} total
                </Text>
              </XStack>
              {usage.bonusBytes > 0 && (
                <Text color={COLORS.success} fontSize={11}>
                  +{formatBytes(usage.bonusBytes)} bonus from ads
                </Text>
              )}
            </YStack>

            {!isPro && (
              <Button
                size="$3"
                backgroundColor={COLORS.primaryGlow}
                color={COLORS.primary}
                fontWeight="600"
                fontSize={13}
                borderRadius={10}
                borderWidth={1}
                borderColor={COLORS.primary + '20'}
                pressStyle={{ opacity: 0.8 }}
                onPress={handleWatchAds}
                disabled={loadingAds || !usage.canWatchAds}
                icon={
                  <Ionicons name="play-circle" size={16} color={COLORS.primary} />
                }
              >
                {loadingAds
                  ? 'Playing Ads...'
                  : usage.canWatchAds
                  ? 'Watch 3 Ads → Get +1 GB Free'
                  : 'Ad limit reached today'}
              </Button>
            )}
            {!isPro && !usage.canWatchAds && (
              <Text color={COLORS.textMuted} fontSize={11}>
                Come back in 24 hours to watch more ads.
              </Text>
            )}
          </YStack>
        </Card>

        {/* Pro Card */}
        {!isPro && (
          <Card
            backgroundColor={COLORS.bgCard}
            borderRadius={18}
            borderWidth={1}
            borderColor={COLORS.primary + '30'}
            padding="$4"
            marginBottom="$4"
          >
            <YStack gap="$3">
              <XStack alignItems="center" gap="$2.5">
                <YStack
                  width={36}
                  height={36}
                  borderRadius={10}
                  backgroundColor={COLORS.primaryGlow}
                  alignItems="center"
                  justifyContent="center"
                >
                  <Ionicons name="diamond" size={18} color={COLORS.primary} />
                </YStack>
                <YStack>
                  <Text color={COLORS.textPrimary} fontSize={16} fontWeight="700">
                    Upgrade to Pro
                  </Text>
                  <Text color={COLORS.textMuted} fontSize={12}>
                    {PRO_MONTHLY_PRICE}/month
                  </Text>
                </YStack>
              </XStack>

              <YStack gap="$2" marginLeft="$1">
                {[
                  'Transfer up to 50GB per file',
                  'No daily transfer limits',
                  'No ads during transfers',
                  'Priority relay connection',
                ].map((feature) => (
                  <XStack key={feature} alignItems="center" gap="$2">
                    <Ionicons
                      name="checkmark-circle"
                      size={16}
                      color={COLORS.primary}
                    />
                    <Text color={COLORS.textSecondary} fontSize={13}>
                      {feature}
                    </Text>
                  </XStack>
                ))}
              </YStack>

              <Button
                size="$4"
                backgroundColor={COLORS.primary}
                color={COLORS.bgDeep}
                fontWeight="700"
                borderRadius={12}
                pressStyle={{ opacity: 0.85, scale: 0.98 }}
                marginTop="$1"
                onPress={handleUpgrade}
              >
                Subscribe Now
              </Button>

              <Button
                size="$2"
                backgroundColor="transparent"
                color={COLORS.textMuted}
                fontSize={12}
                onPress={handleRestore}
              >
                Restore Purchases
              </Button>
            </YStack>
          </Card>
        )}

        {/* Account Section */}
        <Card
          backgroundColor={COLORS.bgCard}
          borderRadius={18}
          borderWidth={1}
          borderColor={COLORS.border}
          padding="$4"
          marginBottom="$4"
        >
          <YStack gap="$3">
            <Text
              color={COLORS.textMuted}
              fontSize={11}
              fontWeight="600"
              textTransform="uppercase"
              letterSpacing={1}
            >
              Account
            </Text>

            {user ? (
              <YStack gap="$3">
                <XStack alignItems="center" gap="$3">
                  <YStack
                    width={44}
                    height={44}
                    borderRadius={22}
                    backgroundColor={COLORS.primaryGlow}
                    alignItems="center"
                    justifyContent="center"
                    borderWidth={1}
                    borderColor={COLORS.primary + '20'}
                  >
                    <Text fontSize={20}>
                      {user.name?.charAt(0)?.toUpperCase() || '?'}
                    </Text>
                  </YStack>
                  <YStack flex={1}>
                    <Text color={COLORS.textPrimary} fontSize={15} fontWeight="600">
                      {user.name}
                    </Text>
                    <Text color={COLORS.textMuted} fontSize={12}>
                      {user.email}
                    </Text>
                  </YStack>
                </XStack>
                <Button
                  size="$3"
                  backgroundColor="transparent"
                  color={COLORS.error}
                  fontWeight="500"
                  fontSize={13}
                  onPress={handleSignOut}
                >
                  Sign Out
                </Button>
              </YStack>
            ) : (
              <>
                <Button
                  size="$4"
                  backgroundColor={COLORS.bgElevated}
                  color={COLORS.textPrimary}
                  fontWeight="500"
                  borderRadius={12}
                  borderWidth={1}
                  borderColor={COLORS.border}
                  pressStyle={{ backgroundColor: COLORS.bgCardHover }}
                  justifyContent="flex-start"
                  icon={
                    <Ionicons name="logo-google" size={18} color={COLORS.textSecondary} />
                  }
                  onPress={handleGoogleSignIn}
                  disabled={signingIn}
                >
                  {signingIn ? 'Signing in...' : 'Sign in with Google'}
                </Button>
                <Text color={COLORS.textMuted} fontSize={12}>
                  Sign in to sync usage and subscription across devices
                </Text>
              </>
            )}
          </YStack>
        </Card>

        {/* About Section */}
        <Card
          backgroundColor={COLORS.bgCard}
          borderRadius={18}
          borderWidth={1}
          borderColor={COLORS.border}
          padding="$4"
        >
          <YStack gap="$3">
            <Text
              color={COLORS.textMuted}
              fontSize={11}
              fontWeight="600"
              textTransform="uppercase"
              letterSpacing={1}
            >
              About
            </Text>

            {[
              {
                icon: 'shield-checkmark' as const,
                label: 'End-to-end encrypted',
                sublabel: 'Files never touch any server',
              },
              {
                icon: 'git-branch' as const,
                label: 'Open source',
                sublabel: 'Built with WebRTC peer-to-peer tech',
              },
              {
                icon: 'information-circle' as const,
                label: 'Version 1.0.0',
                sublabel: 'Drop – P2P File Transfer',
              },
            ].map((item) => (
              <XStack key={item.label} alignItems="center" gap="$3">
                <YStack
                  width={36}
                  height={36}
                  borderRadius={10}
                  backgroundColor={COLORS.bgElevated}
                  alignItems="center"
                  justifyContent="center"
                >
                  <Ionicons
                    name={item.icon}
                    size={18}
                    color={COLORS.textSecondary}
                  />
                </YStack>
                <YStack>
                  <Text
                    color={COLORS.textPrimary}
                    fontSize={14}
                    fontWeight="500"
                  >
                    {item.label}
                  </Text>
                  <Text color={COLORS.textMuted} fontSize={12}>
                    {item.sublabel}
                  </Text>
                </YStack>
              </XStack>
            ))}
          </YStack>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}
