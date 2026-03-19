import { useState, useEffect, useCallback } from 'react';
import {
  YStack,
  XStack,
  Text,
  Button,
  Card,
  ScrollView,
} from 'tamagui';
import { SafeAreaView, Alert, Share } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../lib/constants';
import {
  getTransferHistory,
  clearTransferHistory,
  TransferRecord,
} from '../lib/storage';
import { formatBytes } from '../lib/fileUtils';

export default function HistoryScreen() {
  const [history, setHistory] = useState<TransferRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    const records = await getTransferHistory();
    setHistory(records);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const handleClear = useCallback(() => {
    Alert.alert(
      'Clear History',
      'Are you sure you want to clear all transfer history?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            await clearTransferHistory();
            setHistory([]);
          },
        },
      ]
    );
  }, []);

  const handleShareFile = useCallback(async (record: TransferRecord) => {
    if (record.uri) {
      try {
        await Share.share({
          url: record.uri,
          title: record.fileName,
        });
      } catch {
        Alert.alert('Info', `File location: ${record.uri}`);
      }
    }
  }, []);

  const formatDate = (timestamp: number): string => {
    const now = Date.now();
    const diffMs = now - timestamp;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return new Date(timestamp).toLocaleDateString();
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.bgDeep }}>
      <ScrollView
        flex={1}
        backgroundColor={COLORS.bgDeep}
        contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
      >
        {/* Header */}
        <XStack
          justifyContent="space-between"
          alignItems="center"
          marginTop="$4"
          marginBottom="$5"
        >
          <YStack>
            <Text
              color={COLORS.textPrimary}
              fontSize={22}
              fontWeight="700"
              letterSpacing={-0.5}
            >
              Transfer History
            </Text>
            <Text color={COLORS.textMuted} fontSize={13} marginTop={4}>
              {history.length} transfer{history.length !== 1 ? 's' : ''}
            </Text>
          </YStack>
          {history.length > 0 && (
            <Button
              size="$3"
              backgroundColor="transparent"
              color={COLORS.error}
              fontWeight="500"
              fontSize={13}
              onPress={handleClear}
              pressStyle={{ opacity: 0.7 }}
            >
              Clear All
            </Button>
          )}
        </XStack>

        {history.length === 0 ? (
          <YStack
            alignItems="center"
            justifyContent="center"
            paddingVertical="$10"
            gap="$3"
          >
            <YStack
              width={72}
              height={72}
              borderRadius={20}
              backgroundColor={COLORS.bgCard}
              alignItems="center"
              justifyContent="center"
              borderWidth={1}
              borderColor={COLORS.border}
            >
              <Ionicons name="time-outline" size={32} color={COLORS.textMuted} />
            </YStack>
            <Text color={COLORS.textSecondary} fontSize={16} fontWeight="600">
              No transfers yet
            </Text>
            <Text
              color={COLORS.textMuted}
              fontSize={13}
              textAlign="center"
              maxWidth={260}
            >
              Your sent and received files will appear here
            </Text>
          </YStack>
        ) : (
          <YStack gap="$2">
            {history.map((record) => (
              <Card
                key={record.id}
                backgroundColor={COLORS.bgCard}
                borderRadius={14}
                borderWidth={1}
                borderColor={COLORS.border}
                padding="$3.5"
                pressStyle={{
                  backgroundColor: COLORS.bgCardHover,
                  scale: 0.99,
                }}
                animation="fast"
                onPress={() => handleShareFile(record)}
              >
                <XStack alignItems="center" gap="$3">
                  <YStack
                    width={44}
                    height={44}
                    borderRadius={13}
                    backgroundColor={
                      record.direction === 'sent'
                        ? COLORS.primaryGlow
                        : COLORS.successBg
                    }
                    alignItems="center"
                    justifyContent="center"
                    borderWidth={1}
                    borderColor={
                      record.direction === 'sent'
                        ? COLORS.primary + '15'
                        : COLORS.success + '15'
                    }
                  >
                    <Ionicons
                      name={
                        record.direction === 'sent'
                          ? 'arrow-up-outline'
                          : 'arrow-down-outline'
                      }
                      size={20}
                      color={
                        record.direction === 'sent'
                          ? COLORS.primary
                          : COLORS.success
                      }
                    />
                  </YStack>
                  <YStack flex={1}>
                    <Text
                      color={COLORS.textPrimary}
                      fontSize={14}
                      fontWeight="500"
                      numberOfLines={1}
                    >
                      {record.fileName}
                    </Text>
                    <XStack gap="$2" marginTop={3} alignItems="center">
                      <Text color={COLORS.textMuted} fontSize={12}>
                        {formatBytes(record.fileSize)}
                      </Text>
                      <Text color={COLORS.textMuted} fontSize={10}>
                        •
                      </Text>
                      <Text
                        color={
                          record.direction === 'sent'
                            ? COLORS.primary
                            : COLORS.success
                        }
                        fontSize={12}
                        fontWeight="500"
                      >
                        {record.direction === 'sent' ? 'Sent' : 'Received'}
                      </Text>
                    </XStack>
                  </YStack>
                  <Text color={COLORS.textMuted} fontSize={11}>
                    {formatDate(record.timestamp)}
                  </Text>
                </XStack>
              </Card>
            ))}
          </YStack>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
