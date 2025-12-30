import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import SportsAnalyticsScreen from '@/screens/SportsAnalyticsScreen';
import { SportsStackParamList } from '@/types/navigation';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';

const Stack = createStackNavigator<SportsStackParamList>();

export default function SportsStack() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: colors.background,
        },
        headerTintColor: colors.text,
        headerTitleStyle: {
          fontWeight: '600',
        },
      }}
    >
      <Stack.Screen 
        name="SportsAnalytics" 
        component={SportsAnalyticsScreen}
        options={{
          title: 'Phân tích thể thao',
          headerShown: false, // Let the screen handle its own header
        }}
      />
    </Stack.Navigator>
  );
}