import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { DarkTheme, DefaultTheme } from '@react-navigation/native';
import AuthStack from './AuthStack';
import MainTabs from './MainTabs';
import { RootStackParamList } from '@/types/navigation';
import { useColorScheme } from '@/hooks/use-color-scheme';

const Stack = createStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const colorScheme = useColorScheme();

  const handleLogin = () => {
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
  };

  return (
    <NavigationContainer theme={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {isAuthenticated ? (
          <Stack.Screen name="Main">
            {() => <MainTabs />}
          </Stack.Screen>
        ) : (
          <Stack.Screen name="Auth">
            {() => <AuthStack onLogin={handleLogin} />}
          </Stack.Screen>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}