import { useState, useCallback, useEffect } from 'react';
import {
  YStack,
  XStack,
  Text,
  Button,
  Card,
  ScrollView,
  Spinner,
} from 'tamagui';
import { SafeAreaView, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { COLORS, ADS_REQUIRED_FOR_BONUS } from '../lib/constants';
import { useP2PSend } from '../lib/useP2PSend';
import { formatBytes, getFileIcon } from '../lib/fileUtils';
import { addTransferRecord } from '../lib/storage';
import { getStoredUser, updateStoredUserPlan } from '../services/auth';
import { canTransferFile, getCurrentUsage, recordTransferUsage, UsageInfo } from '../services/usage';
import { showInterstitial, loadInterstitial } from '../services/ads';
import {
  checkSubscriptionStatus,
  isSubscriptionAvailable,
  purchaseProSubscription,
} from '../services/subscription';
import { useAuth } from '../contexts/auth';
import ShareCodeDisplay from '../components/ShareCodeDisplay';
import TransferProgress from '../components/TransferProgress';

interface SelectedFile {
  uri: string;
  name: string;
  size: number;
  mimeType: string;
}

export default function SendScreen() {
  const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);
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
  const { status, code, progress, speed, error, isWebRTCReady, startSend, cancel } =
    useP2PSend();

  // Preload interstitial ad
  useEffect(() => {
    loadInterstitial();
  }, []);

  const loadUsage = useCallback(async () => {
    const usageInfo = await getCurrentUsage(
      user?.id || null,
      user?.plan === 'pro'
    );
    setUsage(usageInfo);
  }, [user]);

  useEffect(() => {
    loadUsage();
  }, [loadUsage]);

  // Record completed transfer
  useEffect(() => {
    if (status === 'complete' && selectedFiles.length > 0) {
      (async () => {
        const user = await getStoredUser();
        const totalSize = selectedFiles.reduce((sum, f) => sum + f.size, 0);

        // Record usage
        await recordTransferUsage(totalSize, user?.id || null);

        // Record history
        for (const file of selectedFiles) {
          await addTransferRecord({
            fileName: file.name,
            fileSize: file.size,
            mimeType: file.mimeType,
            direction: 'sent',
          });
        }

        await loadUsage();
      })();
    }
  }, [status, selectedFiles, loadUsage]);

  const pickFiles = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        multiple: true,
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets.length > 0) {
        const files = result.assets.map((asset) => ({
          uri: asset.uri,
          name: asset.name,
          size: asset.size ?? 0,
          mimeType: asset.mimeType ?? 'application/octet-stream',
        }));
        setSelectedFiles(files);
      }
    } catch (err) {
      console.error('File picker error:', err);
      Alert.alert('Error', 'Failed to pick files');
    }
  }, []);

  const removeFile = useCallback((index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleSend = useCallback(async () => {
    if (selectedFiles.length === 0) return;

    if (!isWebRTCReady) {
      Alert.alert(
        'Development Build Required',
        'File transfers require a development build. The UI works in Expo Go, but actual transfers need react-native-webrtc.',
        [{ text: 'OK' }]
      );
      return;
    }

    // Check usage limits
    const user = await getStoredUser();
    const isPro = user?.plan === 'pro';
    const totalSize = selectedFiles.reduce((sum, f) => sum + f.size, 0);
    const check = await canTransferFile(totalSize, user?.id || null, isPro);

    if (!check.allowed) {
      Alert.alert('Transfer Limit', check.reason || 'Daily limit reached.');
      return;
    }

    // Show interstitial ad for free users
    if (!isPro) {
      await showInterstitial();
    }

    await startSend(selectedFiles);
  }, [selectedFiles, isWebRTCReady, startSend]);

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
      await loadUsage();
    }
  }, [loadUsage, setUser]);

  const handleNewTransfer = useCallback(() => {
    setSelectedFiles([]);
    cancel();
  }, [cancel]);

  const totalSize = selectedFiles.reduce((sum, f) => sum + f.size, 0);
  const isPro = user?.plan === 'pro';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.bgDeep }}>
      <ScrollView
        flex={1}
        backgroundColor={COLORS.bgDeep}
        contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
      >
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
                size="$4"
                backgroundColor={COLORS.primary}
                color={COLORS.bgDeep}
                fontWeight="700"
                borderRadius={12}
                borderWidth={1}
                borderColor={COLORS.primaryLight}
                pressStyle={{ opacity: 0.9, scale: 0.98 }}
                shadowColor={COLORS.primary}
                shadowOpacity={0.35}
                shadowRadius={12}
                shadowOffset={{ width: 0, height: 6 }}
                elevation={4}
                onPress={handleUpgrade}
                icon={
                  <Ionicons name="diamond" size={18} color={COLORS.bgDeep} />
                }
              >
                Upgrade to Pro
              </Button>
            )}
          </YStack>
        </Card>

        {/* Header */}
        <YStack alignItems="center" marginTop="$4" marginBottom="$6">
          <XStack alignItems="center" gap="$2.5" marginBottom="$3">
            <YStack
              width={36}
              height={36}
              borderRadius={12}
              backgroundColor={COLORS.primary}
              alignItems="center"
              justifyContent="center"
            >
              <Ionicons name="arrow-up" size={18} color={COLORS.bgDeep} />
            </YStack>
            <Text
              color={COLORS.textPrimary}
              fontSize={20}
              fontWeight="700"
              letterSpacing={-0.5}
            >
              Send Files
            </Text>
          </XStack>
          <Text color={COLORS.textSecondary} fontSize={13} textAlign="center">
            Pick files to share peer-to-peer. No cloud. No limits.
          </Text>
        </YStack>

        {/* Transfer states */}
        {(status === 'waiting' || status === 'connected' || status === 'transferring') && code ? (
          <YStack gap="$4">
            <ShareCodeDisplay
              code={code}
              status={status}
              fileName={
                selectedFiles.length === 1
                  ? selectedFiles[0].name
                  : `${selectedFiles.length} files`
              }
              fileSize={totalSize}
            />
            {status === 'transferring' && (
              <TransferProgress
                progress={progress}
                speed={speed}
                label="Sending"
                fileName={
                  selectedFiles.length === 1
                    ? selectedFiles[0].name
                    : `${selectedFiles.length} files`
                }
                totalSize={totalSize}
              />
            )}
          </YStack>
        ) : status === 'complete' ? (
          <YStack gap="$4" alignItems="center">
            <YStack
              width={80}
              height={80}
              borderRadius={40}
              backgroundColor={COLORS.successBg}
              alignItems="center"
              justifyContent="center"
              borderWidth={2}
              borderColor={COLORS.success + '30'}
            >
              <Ionicons name="checkmark-circle" size={44} color={COLORS.success} />
            </YStack>
            <Text color={COLORS.textPrimary} fontSize={20} fontWeight="700">
              Transfer Complete!
            </Text>
            <Text color={COLORS.textSecondary} fontSize={14} textAlign="center">
              {selectedFiles.length === 1
                ? selectedFiles[0].name
                : `${selectedFiles.length} files`}{' '}
              sent successfully
            </Text>
            <Button
              size="$4"
              backgroundColor={COLORS.primary}
              color={COLORS.bgDeep}
              fontWeight="700"
              borderRadius={14}
              marginTop="$3"
              pressStyle={{ opacity: 0.85, scale: 0.98 }}
              onPress={handleNewTransfer}
              width="100%"
            >
              Send More Files
            </Button>
          </YStack>
        ) : status === 'error' ? (
          <YStack gap="$4" alignItems="center">
            <YStack
              width={80}
              height={80}
              borderRadius={40}
              backgroundColor={COLORS.errorBg}
              alignItems="center"
              justifyContent="center"
              borderWidth={2}
              borderColor={COLORS.error + '30'}
            >
              <Ionicons name="close-circle" size={44} color={COLORS.error} />
            </YStack>
            <Text color={COLORS.textPrimary} fontSize={20} fontWeight="700">
              Transfer Failed
            </Text>
            <Text
              color={COLORS.textSecondary}
              fontSize={14}
              textAlign="center"
              paddingHorizontal="$4"
            >
              {error || 'Something went wrong'}
            </Text>
            <Button
              size="$4"
              backgroundColor={COLORS.bgCard}
              color={COLORS.textPrimary}
              fontWeight="600"
              borderRadius={14}
              borderWidth={1}
              borderColor={COLORS.border}
              marginTop="$3"
              pressStyle={{ opacity: 0.85 }}
              onPress={handleNewTransfer}
              width="100%"
            >
              Try Again
            </Button>
          </YStack>
        ) : (
          /* Default: File picker state */
          <YStack gap="$4">
            {/* Drop zone / file picker */}
            <Card
              backgroundColor={COLORS.bgCard}
              borderRadius={18}
              borderWidth={2}
              borderColor={
                selectedFiles.length > 0 ? COLORS.primary + '30' : COLORS.border
              }
              borderStyle="dashed"
              pressStyle={{ scale: 0.99, borderColor: COLORS.primary + '50' }}
              onPress={pickFiles}
              animation="fast"
              padding="$5"
            >
              <YStack alignItems="center" gap="$3">
                <YStack
                  width={56}
                  height={56}
                  borderRadius={16}
                  backgroundColor={COLORS.primaryGlow}
                  alignItems="center"
                  justifyContent="center"
                  borderWidth={1}
                  borderColor={COLORS.primary + '20'}
                >
                  <Ionicons
                    name="cloud-upload-outline"
                    size={28}
                    color={COLORS.primary}
                  />
                </YStack>
                <Text
                  color={COLORS.textPrimary}
                  fontSize={15}
                  fontWeight="600"
                  textAlign="center"
                >
                  Tap to select files
                </Text>
                <Text
                  color={COLORS.textMuted}
                  fontSize={12}
                  textAlign="center"
                  lineHeight={18}
                >
                  Any file type • Multiple files supported
                </Text>
              </YStack>
            </Card>

            {/* Selected files list */}
            {selectedFiles.length > 0 && (
              <YStack gap="$2">
                <XStack
                  justifyContent="space-between"
                  alignItems="center"
                  paddingHorizontal="$1"
                >
                  <Text color={COLORS.textSecondary} fontSize={12} fontWeight="600">
                    {selectedFiles.length} FILE{selectedFiles.length > 1 ? 'S' : ''} •{' '}
                    {formatBytes(totalSize)}
                  </Text>
                  <Text
                    color={COLORS.primary}
                    fontSize={12}
                    fontWeight="600"
                    onPress={pickFiles}
                  >
                    Add More
                  </Text>
                </XStack>

                {selectedFiles.map((file, index) => (
                  <Card
                    key={`${file.name}-${index}`}
                    backgroundColor={COLORS.bgCard}
                    borderRadius={14}
                    borderWidth={1}
                    borderColor={COLORS.border}
                    padding="$3"
                  >
                    <XStack alignItems="center" gap="$3">
                      <YStack
                        width={40}
                        height={40}
                        borderRadius={12}
                        backgroundColor={COLORS.primaryGlow}
                        alignItems="center"
                        justifyContent="center"
                        borderWidth={1}
                        borderColor={COLORS.primary + '15'}
                      >
                        <Text fontSize={18}>{getFileIcon(file.mimeType)}</Text>
                      </YStack>
                      <YStack flex={1}>
                        <Text
                          color={COLORS.textPrimary}
                          fontSize={14}
                          fontWeight="500"
                          numberOfLines={1}
                        >
                          {file.name}
                        </Text>
                        <Text
                          color={COLORS.textMuted}
                          fontSize={12}
                          marginTop={2}
                        >
                          {formatBytes(file.size)}
                        </Text>
                      </YStack>
                      <Button
                        size="$2"
                        circular
                        backgroundColor="transparent"
                        pressStyle={{ backgroundColor: COLORS.bgElevated }}
                        onPress={() => removeFile(index)}
                      >
                        <Ionicons
                          name="close"
                          size={16}
                          color={COLORS.textMuted}
                        />
                      </Button>
                    </XStack>
                  </Card>
                ))}

                {/* Send button */}
                <Button
                  size="$5"
                  backgroundColor={COLORS.primary}
                  color={COLORS.bgDeep}
                  fontWeight="700"
                  fontSize={15}
                  borderRadius={14}
                  marginTop="$2"
                  pressStyle={{ opacity: 0.85, scale: 0.98 }}
                  animation="fast"
                  disabled={status === 'preparing'}
                  onPress={handleSend}
                  iconAfter={
                    status === 'preparing' ? (
                      <Spinner size="small" color={COLORS.bgDeep} />
                    ) : (
                      <Ionicons name="arrow-forward" size={18} color={COLORS.bgDeep} />
                    )
                  }
                >
                  {status === 'preparing' ? 'Generating Code...' : 'Generate Share Code'}
                </Button>
              </YStack>
            )}

            {/* Info badges */}
            <XStack
              justifyContent="center"
              gap="$4"
              marginTop="$2"
              flexWrap="wrap"
            >
              {['End-to-end encrypted', 'Zero cloud storage', 'No account needed'].map(
                (label) => (
                  <XStack key={label} alignItems="center" gap="$1.5">
                    <YStack
                      width={5}
                      height={5}
                      borderRadius={3}
                      backgroundColor={COLORS.primary + '60'}
                    />
                    <Text color={COLORS.textMuted} fontSize={11}>
                      {label}
                    </Text>
                  </XStack>
                )
              )}
            </XStack>
          </YStack>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
