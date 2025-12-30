import { Tabs } from 'expo-router';
import React from 'react';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import AuthGuard from '@/components/AuthGuard';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  return (
    <AuthGuard>
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: colors.tint,
          tabBarInactiveTintColor: colors.text + '80',
          tabBarStyle: {
            backgroundColor: colors.background,
            borderTopColor: colors.border,
          },
          headerShown: false,
          tabBarButton: HapticTab,
        }}>
        <Tabs.Screen
          name="index"
          options={{
            title: 'Thẻ',
            tabBarIcon: ({ color }) => <IconSymbol size={28} name="creditcard.fill" color={color} />,
          }}
        />
        <Tabs.Screen
          name="transactions"
          options={{
            title: 'Lịch sử',
            tabBarIcon: ({ color }) => <IconSymbol size={28} name="list.bullet" color={color} />,
          }}
        />
        <Tabs.Screen
          name="sports"
          options={{
            title: 'Thể thao',
            tabBarIcon: ({ color }) => <IconSymbol size={28} name="sportscourt.fill" color={color} />,
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Hồ sơ',
            tabBarIcon: ({ color }) => <IconSymbol size={28} name="person.fill" color={color} />,
          }}
        />
      </Tabs>
    </AuthGuard>
  );
}
