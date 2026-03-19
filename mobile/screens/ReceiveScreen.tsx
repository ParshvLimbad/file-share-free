import { useState, useCallback, useEffect } from 'react';
import {
  YStack,
  XStack,
  Text,
  Button,
  Card,
  Input,
  ScrollView,
  Spinner,
} from 'tamagui';
import { SafeAreaView, Alert, Share } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SHARE_CODE_LENGTH } from '../lib/constants';
import { useP2PReceive } from '../lib/useP2PReceive';
import { formatBytes, getFileIcon } from '../lib/fileUtils';
import { addTransferRecord } from '../lib/storage';
import { getStoredUser } from '../services/auth';
import { recordTransferUsage } from '../services/usage';
import TransferProgress from '../components/TransferProgress';

export default function ReceiveScreen() {
  const [codeInput, setCodeInput] = useState('');
  const {
    status,
    progress,
    speed,
    fileMetadata,
    receivedFile,
    error,
    isWebRTCReady,
    startReceive,
    cancel,
  } = useP2PReceive();

  // Record completed receive
  useEffect(() => {
    if (status === 'complete' && receivedFile) {
      (async () => {
        const user = await getStoredUser();

        // Record usage
        await recordTransferUsage(receivedFile.size, user?.id || null);

        // Record history
        await addTransferRecord({
          fileName: receivedFile.name,
          fileSize: receivedFile.size,
          mimeType: receivedFile.mimeType || 'application/octet-stream',
          direction: 'received',
          uri: receivedFile.uri,
        });
      })();
    }
  }, [status, receivedFile]);

  const handleCodeChange = useCallback((text: string) => {
    const cleaned = text.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, SHARE_CODE_LENGTH);
    setCodeInput(cleaned);
  }, []);

  const handleConnect = useCallback(async () => {
    if (codeInput.length !== SHARE_CODE_LENGTH) return;

    if (!isWebRTCReady) {
      Alert.alert(
        'Development Build Required',
        'File transfers require a development build. The UI works in Expo Go, but actual transfers need react-native-webrtc.',
        [{ text: 'OK' }]
      );
      return;
    }

    await startReceive(codeInput);
  }, [codeInput, isWebRTCReady, startReceive]);

  const handleReset = useCallback(() => {
    setCodeInput('');
    cancel();
  }, [cancel]);

  const handleOpenFile = useCallback(async () => {
    if (!receivedFile) return;
    try {
      await Share.share({
        url: receivedFile.uri,
        title: receivedFile.name,
      });
    } catch {
      Alert.alert('Info', `File saved to:\n${receivedFile.uri}`);
    }
  }, [receivedFile]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.bgDeep }}>
      <ScrollView
        flex={1}
        backgroundColor={COLORS.bgDeep}
        contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
      >
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
              <Ionicons name="arrow-down" size={18} color={COLORS.bgDeep} />
            </YStack>
            <Text
              color={COLORS.textPrimary}
              fontSize={20}
              fontWeight="700"
              letterSpacing={-0.5}
            >
              Receive Files
            </Text>
          </XStack>
          <Text color={COLORS.textSecondary} fontSize={13} textAlign="center">
            Enter the share code to receive files directly
          </Text>
        </YStack>

        {/* State-based content */}
        {status === 'idle' ? (
          <YStack gap="$4">
            {/* Code input */}
            <Card
              backgroundColor={COLORS.bgCard}
              borderRadius={18}
              borderWidth={1}
              borderColor={COLORS.border}
              padding="$5"
            >
              <YStack gap="$4">
                <Text
                  color={COLORS.textMuted}
                  fontSize={11}
                  fontWeight="600"
                  textTransform="uppercase"
                  letterSpacing={1.5}
                  textAlign="center"
                >
                  Share Code
                </Text>
                <Input
                  value={codeInput}
                  onChangeText={handleCodeChange}
                  placeholder="XXXXXX"
                  placeholderTextColor={COLORS.textMuted + '40'}
                  maxLength={SHARE_CODE_LENGTH}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  spellCheck={false}
                  textAlign="center"
                  fontSize={28}
                  fontWeight="800"
                  letterSpacing={8}
                  color={COLORS.primary}
                  backgroundColor={COLORS.bgInput}
                  borderWidth={1}
                  borderColor={
                    codeInput.length === SHARE_CODE_LENGTH
                      ? COLORS.primary + '40'
                      : COLORS.border
                  }
                  borderRadius={14}
                  paddingVertical="$4"
                />
                <Text
                  color={COLORS.textMuted}
                  fontSize={12}
                  textAlign="center"
                >
                  Enter the 6-digit code from the sender
                </Text>

                <Button
                  size="$5"
                  backgroundColor={COLORS.primary}
                  color={COLORS.bgDeep}
                  fontWeight="700"
                  fontSize={15}
                  borderRadius={14}
                  pressStyle={{ opacity: 0.85, scale: 0.98 }}
                  animation="fast"
                  disabled={codeInput.length !== SHARE_CODE_LENGTH}
                  opacity={codeInput.length !== SHARE_CODE_LENGTH ? 0.4 : 1}
                  onPress={handleConnect}
                  iconAfter={
                    <Ionicons
                      name="arrow-forward"
                      size={18}
                      color={COLORS.bgDeep}
                    />
                  }
                >
                  Connect & Receive
                </Button>
              </YStack>
            </Card>

            {/* Divider with OR */}
            <XStack alignItems="center" gap="$3" paddingHorizontal="$4">
              <YStack flex={1} height={1} backgroundColor={COLORS.border} />
              <Text color={COLORS.textMuted} fontSize={12} fontWeight="500">
                OR
              </Text>
              <YStack flex={1} height={1} backgroundColor={COLORS.border} />
            </XStack>

            {/* QR Scanner button */}
            <Button
              size="$5"
              backgroundColor={COLORS.bgCard}
              color={COLORS.textPrimary}
              fontWeight="600"
              fontSize={14}
              borderRadius={14}
              borderWidth={1}
              borderColor={COLORS.border}
              pressStyle={{
                backgroundColor: COLORS.bgCardHover,
                borderColor: COLORS.borderLight,
              }}
              icon={<Ionicons name="qr-code-outline" size={20} color={COLORS.primary} />}
              onPress={() =>
                Alert.alert('Coming Soon', 'QR code scanning will be available in the development build.')
              }
            >
              Scan QR Code
            </Button>
          </YStack>
        ) : status === 'connecting' ? (
          <YStack gap="$4" alignItems="center" paddingVertical="$8">
            <Spinner size="large" color={COLORS.primary} />
            <Text color={COLORS.textPrimary} fontSize={18} fontWeight="600">
              Connecting...
            </Text>
            <Text color={COLORS.textSecondary} fontSize={13} textAlign="center">
              Establishing peer-to-peer connection
            </Text>
            {fileMetadata && (
              <Card
                backgroundColor={COLORS.bgCard}
                borderRadius={14}
                borderWidth={1}
                borderColor={COLORS.border}
                padding="$3.5"
                width="100%"
                marginTop="$2"
              >
                <XStack alignItems="center" gap="$3">
                  <Text fontSize={24}>{getFileIcon(fileMetadata.type)}</Text>
                  <YStack flex={1}>
                    <Text
                      color={COLORS.textPrimary}
                      fontSize={14}
                      fontWeight="500"
                      numberOfLines={1}
                    >
                      {fileMetadata.name}
                    </Text>
                    <Text color={COLORS.textMuted} fontSize={12} marginTop={2}>
                      {formatBytes(fileMetadata.size)}
                    </Text>
                  </YStack>
                </XStack>
              </Card>
            )}
            <Button
              size="$3"
              backgroundColor="transparent"
              color={COLORS.textMuted}
              fontWeight="500"
              marginTop="$4"
              onPress={handleReset}
            >
              Cancel
            </Button>
          </YStack>
        ) : status === 'receiving' ? (
          <YStack gap="$4">
            <TransferProgress
              progress={progress}
              speed={speed}
              label="Receiving"
              fileName={fileMetadata?.name}
              totalSize={fileMetadata?.size}
            />
            <Button
              size="$3"
              backgroundColor="transparent"
              color={COLORS.textMuted}
              fontWeight="500"
              onPress={cancel}
            >
              Cancel Transfer
            </Button>
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
              File Received!
            </Text>
            {receivedFile && (
              <>
                <Text color={COLORS.textSecondary} fontSize={14} textAlign="center">
                  {receivedFile.name} ({formatBytes(receivedFile.size)})
                </Text>
                <Button
                  size="$4"
                  backgroundColor={COLORS.primary}
                  color={COLORS.bgDeep}
                  fontWeight="700"
                  borderRadius={14}
                  marginTop="$2"
                  pressStyle={{ opacity: 0.85, scale: 0.98 }}
                  onPress={handleOpenFile}
                  width="100%"
                  icon={
                    <Ionicons
                      name="share-outline"
                      size={18}
                      color={COLORS.bgDeep}
                    />
                  }
                >
                  Open / Share File
                </Button>
              </>
            )}
            <Button
              size="$4"
              backgroundColor={COLORS.bgCard}
              color={COLORS.textPrimary}
              fontWeight="600"
              borderRadius={14}
              borderWidth={1}
              borderColor={COLORS.border}
              pressStyle={{ opacity: 0.85 }}
              onPress={handleReset}
              width="100%"
            >
              Receive Another File
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
              Connection Failed
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
              onPress={handleReset}
              width="100%"
            >
              Try Again
            </Button>
          </YStack>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
