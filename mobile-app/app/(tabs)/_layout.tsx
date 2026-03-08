import { Redirect, Tabs } from 'expo-router';
import React from 'react';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { HapticTab } from '@/components/haptic-tab';
import { AppPalette } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { ActivityIndicator, View } from 'react-native';

export default function TabLayout() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: AppPalette.background }}>
        <ActivityIndicator size="large" color={AppPalette.primary} />
      </View>
    );
  }

  if (!isAuthenticated) {
    return <Redirect href="/login" />;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarStyle: {
          height: 60,
          backgroundColor: AppPalette.tabBarBackground,
          borderTopColor: AppPalette.tabBarBorder,
          borderTopWidth: 1,
        },
        tabBarActiveTintColor: AppPalette.tabBarActive,
        tabBarInactiveTintColor: AppPalette.tabBarInactive,
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
        },
      }}>
      <Tabs.Screen
        name="home"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <MaterialIcons name="dashboard" size={26} color={color} />,
        }}
      />
      <Tabs.Screen
        name="sports"
        options={{
          title: 'Bóng đá',
          tabBarIcon: ({ color }) => <MaterialIcons name="sports-soccer" size={26} color={color} />,
        }}
      />
      <Tabs.Screen
        name="results"
        options={{
          title: 'Kết quả',
          tabBarIcon: ({ color }) => <MaterialIcons name="analytics" size={26} color={color} />,
        }}
      />
      <Tabs.Screen
        name="cards"
        options={{
          title: 'Thẻ',
          tabBarIcon: ({ color }) => <MaterialIcons name="credit-card" size={26} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Cá nhân',
          tabBarIcon: ({ color }) => <MaterialIcons name="person" size={26} color={color} />,
        }}
      />
    </Tabs>
  );
}
