import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import ProfileScreen from '@/screens/ProfileScreen';
import { ProfileStackParamList } from '@/types/navigation';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';

const Stack = createStackNavigator<ProfileStackParamList>();

export default function ProfileStack() {
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
        name="Profile" 
        component={ProfileScreen}
        options={{
          title: 'Hồ sơ',
          headerShown: false, // Let the screen handle its own header
        }}
      />
    </Stack.Navigator>
  );
}