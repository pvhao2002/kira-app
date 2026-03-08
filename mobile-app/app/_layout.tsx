// @ts-nocheck
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { AuthProvider } from '@/contexts/AuthContext';

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <AuthProvider>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack screenOptions={{ headerShown: false, title: '' }} initialRouteName="index">
          <Stack.Screen name="index" options={{ title: '' }} />
          <Stack.Screen name="(tabs)" options={{ title: '' }} />
          <Stack.Screen name="login" options={{ title: '' }} />
          <Stack.Screen name="add-card" options={{ headerShown: true, title: 'Thêm thẻ mới' }} />
          <Stack.Screen name="query-execute" options={{ headerShown: false }} />
          <Stack.Screen name="history-1x" options={{ headerShown: false }} />
          <Stack.Screen name="event-detail" options={{ headerShown: false }} />
          <Stack.Screen name="add-transaction" options={{ headerShown: false }} />
          <Stack.Screen name="modal" options={{ presentation: 'modal', title: '' }} />
        </Stack>
        <StatusBar style="light" backgroundColor="transparent" />
      </ThemeProvider>
    </AuthProvider>
  );
}
