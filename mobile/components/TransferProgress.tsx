import React, { useEffect, useRef } from 'react';
import { YStack, XStack, Text, Card } from 'tamagui';
import { Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../lib/constants';
import { formatBytes, formatSpeed, estimateTimeRemaining } from '../lib/fileUtils';

interface TransferProgressProps {
  progress: number;
  speed?: number;
  label: string;
  fileName?: string;
  totalSize?: number;
  startTime?: number;
}

export default function TransferProgress({
  progress,
  speed = 0,
  label,
  fileName,
  totalSize,
  startTime,
}: TransferProgressProps) {
  const animatedWidth = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(animatedWidth, {
      toValue: progress,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [progress, animatedWidth]);

  const isComplete = progress >= 100;

  return (
    <Card
      backgroundColor={COLORS.bgCard}
      borderRadius={18}
      borderWidth={1}
      borderColor={isComplete ? COLORS.success + '30' : COLORS.border}
      padding="$4"
    >
      <YStack gap="$3">
        {/* Header */}
        <XStack justifyContent="space-between" alignItems="center">
          <XStack alignItems="center" gap="$2">
            <Ionicons
              name={
                isComplete
                  ? 'checkmark-circle'
                  : label === 'Sending'
                  ? 'arrow-up-circle'
                  : 'arrow-down-circle'
              }
              size={18}
              color={isComplete ? COLORS.success : COLORS.primary}
            />
            <Text
              color={isComplete ? COLORS.success : COLORS.primary}
              fontSize={13}
              fontWeight="600"
            >
              {isComplete ? 'Complete' : label}
            </Text>
          </XStack>
          <Text
            color={COLORS.textPrimary}
            fontSize={18}
            fontWeight="800"
            fontFamily="$mono"
          >
            {progress}%
          </Text>
        </XStack>

        {/* Progress bar */}
        <YStack
          height={6}
          borderRadius={3}
          backgroundColor={COLORS.bgElevated}
          overflow="hidden"
        >
          <Animated.View
            style={{
              height: '100%',
              borderRadius: 3,
              backgroundColor: isComplete ? COLORS.success : COLORS.primary,
              width: animatedWidth.interpolate({
                inputRange: [0, 100],
                outputRange: ['0%', '100%'],
              }),
            }}
          />
        </YStack>

        {/* Details */}
        <XStack justifyContent="space-between" alignItems="center">
          <YStack gap={2}>
            {fileName && (
              <Text
                color={COLORS.textSecondary}
                fontSize={12}
                numberOfLines={1}
                maxWidth={180}
              >
                {fileName}
              </Text>
            )}
            {totalSize && !isComplete && (
              <Text color={COLORS.textMuted} fontSize={11}>
                {formatBytes((progress / 100) * totalSize)} / {formatBytes(totalSize)}
              </Text>
            )}
          </YStack>
          {speed > 0 && !isComplete && (
            <YStack alignItems="flex-end" gap={2}>
              <Text color={COLORS.textSecondary} fontSize={12} fontWeight="500">
                {formatSpeed(speed)}
              </Text>
              {totalSize && startTime && (
                <Text color={COLORS.textMuted} fontSize={11}>
                  {estimateTimeRemaining(
                    (progress / 100) * totalSize,
                    totalSize,
                    startTime
                  )}
                </Text>
              )}
            </YStack>
          )}
        </XStack>
      </YStack>
    </Card>
  );
}
