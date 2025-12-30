import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import CardManagementScreen from '@/screens/CardManagementScreen';
import { HomeStackParamList } from '@/types/navigation';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';

const Stack = createStackNavigator<HomeStackParamList>();

export default function HomeStack() {
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
        name="CardManagement" 
        component={CardManagementScreen}
        options={{
          title: 'Quản lý thẻ',
          headerShown: false, // Let the screen handle its own header
        }}
      />
    </Stack.Navigator>
  );
}