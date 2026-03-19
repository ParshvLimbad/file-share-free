import React from 'react';
import { YStack, XStack, Text, Card, Spinner } from 'tamagui';
import { Clipboard, Alert, Share as RNShare, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import { COLORS } from '../lib/constants';
import { formatBytes } from '../lib/fileUtils';

interface ShareCodeDisplayProps {
  code: string | null;
  status: string;
  fileName?: string;
  fileSize?: number;
}

export default function ShareCodeDisplay({
  code,
  status,
  fileName,
  fileSize,
}: ShareCodeDisplayProps) {
  const handleCopy = () => {
    if (!code) return;
    if (Platform.OS === 'web') {
      navigator.clipboard?.writeText(code);
    } else {
      Clipboard.setString(code);
    }
    Alert.alert('Copied!', 'Share code copied to clipboard');
  };

  const handleShare = async () => {
    if (!code) return;
    try {
      await RNShare.share({
        message: `Use code ${code} to receive my file on Drop!\n\nDownload Drop: https://dropshare.app`,
        title: 'Share File Code',
      });
    } catch {}
  };

  if (!code) {
    return (
      <YStack alignItems="center" paddingVertical="$6" gap="$3">
        <Spinner size="large" color={COLORS.primary} />
        <Text color={COLORS.textSecondary} fontSize={14}>
          Generating share code...
        </Text>
      </YStack>
    );
  }

  return (
    <Card
      backgroundColor={COLORS.bgCard}
      borderRadius={18}
      borderWidth={1}
      borderColor={COLORS.primary + '25'}
      padding="$4"
      animation="fast"
    >
      <YStack gap="$4" alignItems="center">
        {/* Status indicator */}
        <XStack
          alignItems="center"
          gap="$2"
          backgroundColor={
            status === 'connected' || status === 'transferring'
              ? COLORS.successBg
              : COLORS.warningBg
          }
          paddingHorizontal="$3"
          paddingVertical="$1.5"
          borderRadius={20}
          borderWidth={1}
          borderColor={
            status === 'connected' || status === 'transferring'
              ? COLORS.success + '20'
              : COLORS.warning + '20'
          }
        >
          <YStack
            width={7}
            height={7}
            borderRadius={4}
            backgroundColor={
              status === 'connected' || status === 'transferring'
                ? COLORS.success
                : COLORS.warning
            }
          />
          <Text
            fontSize={12}
            fontWeight="600"
            color={
              status === 'connected' || status === 'transferring'
                ? COLORS.success
                : COLORS.warning
            }
          >
            {status === 'waiting'
              ? 'Waiting for receiver...'
              : status === 'connected'
              ? 'Connected!'
              : status === 'transferring'
              ? 'Transferring...'
              : status}
          </Text>
        </XStack>

        {/* QR Code */}
        <YStack
          backgroundColor="#fff"
          padding="$3"
          borderRadius={14}
        >
          <QRCode
            value={`dropshare://receive?code=${code}`}
            size={160}
            backgroundColor="white"
            color={COLORS.bgDeep}
          />
        </YStack>

        {/* Share code display */}
        <YStack alignItems="center" gap="$1">
          <Text
            color={COLORS.textMuted}
            fontSize={11}
            fontWeight="600"
            textTransform="uppercase"
            letterSpacing={1.5}
          >
            Share Code
          </Text>
          <Text
            color={COLORS.primary}
            fontSize={36}
            fontWeight="800"
            letterSpacing={8}
            fontFamily="$mono"
            onPress={handleCopy}
          >
            {code}
          </Text>
        </YStack>

        {/* File info */}
        {fileName && (
          <XStack
            alignItems="center"
            gap="$2"
            backgroundColor={COLORS.bgElevated}
            paddingHorizontal="$3"
            paddingVertical="$2"
            borderRadius={10}
          >
            <Ionicons name="document-outline" size={14} color={COLORS.textMuted} />
            <Text
              color={COLORS.textSecondary}
              fontSize={12}
              numberOfLines={1}
              maxWidth={200}
            >
              {fileName}
            </Text>
            {fileSize && (
              <>
                <Text color={COLORS.textMuted} fontSize={10}>
                  •
                </Text>
                <Text color={COLORS.textMuted} fontSize={12}>
                  {formatBytes(fileSize)}
                </Text>
              </>
            )}
          </XStack>
        )}

        {/* Action buttons */}
        <XStack gap="$3" width="100%">
          <YStack
            flex={1}
            backgroundColor={COLORS.bgElevated}
            borderRadius={12}
            padding="$3"
            alignItems="center"
            gap="$1.5"
            pressStyle={{ backgroundColor: COLORS.bgCardHover, scale: 0.97 }}
            animation="fast"
            onPress={handleCopy}
            borderWidth={1}
            borderColor={COLORS.border}
          >
            <Ionicons name="copy-outline" size={20} color={COLORS.primary} />
            <Text color={COLORS.textSecondary} fontSize={11} fontWeight="500">
              Copy Code
            </Text>
          </YStack>
          <YStack
            flex={1}
            backgroundColor={COLORS.bgElevated}
            borderRadius={12}
            padding="$3"
            alignItems="center"
            gap="$1.5"
            pressStyle={{ backgroundColor: COLORS.bgCardHover, scale: 0.97 }}
            animation="fast"
            onPress={handleShare}
            borderWidth={1}
            borderColor={COLORS.border}
          >
            <Ionicons name="share-outline" size={20} color={COLORS.primary} />
            <Text color={COLORS.textSecondary} fontSize={11} fontWeight="500">
              Share
            </Text>
          </YStack>
        </XStack>
      </YStack>
    </Card>
  );
}
