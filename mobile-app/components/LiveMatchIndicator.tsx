import React, { useEffect, useRef } from 'react';
import { StyleSheet, View, Animated } from 'react-native';
import { ThemedText } from '@/components/themed-text';

interface LiveMatchIndicatorProps {
  isLive: boolean;
  size?: 'small' | 'medium' | 'large';
}

export function LiveMatchIndicator({ isLive, size = 'medium' }: LiveMatchIndicatorProps) {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isLive) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();

      return () => pulse.stop();
    }
  }, [isLive, pulseAnim]);

  if (!isLive) {
    return null;
  }

  const sizeStyles = {
    small: styles.small,
    medium: styles.medium,
    large: styles.large,
  };

  const textSizeStyles = {
    small: styles.textSmall,
    medium: styles.textMedium,
    large: styles.textLarge,
  };

  return (
    <View style={[styles.container, sizeStyles[size]]}>
      <Animated.View
        style={[
          styles.indicator,
          sizeStyles[size],
          { transform: [{ scale: pulseAnim }] },
        ]}
      />
      <ThemedText style={[styles.text, textSizeStyles[size]]}>
        TRỰC TIẾP
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF4444',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  indicator: {
    backgroundColor: '#FFFFFF',
    borderRadius: 50,
    marginRight: 6,
  },
  text: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  small: {
    width: 6,
    height: 6,
  },
  medium: {
    width: 8,
    height: 8,
  },
  large: {
    width: 10,
    height: 10,
  },
  textSmall: {
    fontSize: 8,
  },
  textMedium: {
    fontSize: 10,
  },
  textLarge: {
    fontSize: 12,
  },
});