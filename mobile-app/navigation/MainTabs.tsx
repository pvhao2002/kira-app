import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MainTabParamList } from '@/types/navigation';
import HomeStack from './HomeStack';
import TransactionStack from './TransactionStack';
import SportsStack from './SportsStack';
import ProfileStack from './ProfileStack';
import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

const Tab = createBottomTabNavigator<MainTabParamList>();

export default function MainTabs() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: colors.tint,
        tabBarInactiveTintColor: colors.text + '80',
        tabBarStyle: {
          backgroundColor: colors.background,
          borderTopColor: colors.border,
        },
        headerShown: false,
        tabBarButton: HapticTab,
      }}
    >
      <Tab.Screen
        name="HomeTab"
        component={HomeStack}
        options={{
          title: 'Thẻ',
          tabBarIcon: ({ color }) => (
            <IconSymbol size={28} name="creditcard.fill" color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="TransactionTab"
        component={TransactionStack}
        options={{
          title: 'Lịch sử',
          tabBarIcon: ({ color }) => (
            <IconSymbol size={28} name="list.bullet" color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="SportsTab"
        component={SportsStack}
        options={{
          title: 'Thể thao',
          tabBarIcon: ({ color }) => (
            <IconSymbol size={28} name="sportscourt.fill" color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="ProfileTab"
        component={ProfileStack}
        options={{
          title: 'Hồ sơ',
          tabBarIcon: ({ color }) => (
            <IconSymbol size={28} name="person.fill" color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}