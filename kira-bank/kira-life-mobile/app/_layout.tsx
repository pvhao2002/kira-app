import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { ActivityIndicator, Text, View } from 'react-native';
import { DemoProvider, useDemo } from '../src/store';
import { colors } from '../src/theme';
function Routes() {
  const { ready } = useDemo();
  if (!ready) return <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: 'center' }}><ActivityIndicator color={colors.primary} /></View>;
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg }, animation: 'slide_from_right' }} />;
}
export default function Layout() {
  const [loaded, error] = useFonts({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold });
  if (error) return <View style={{ flex: 1, backgroundColor: colors.bg, padding: 32, justifyContent: 'center' }}><Text style={{ color: colors.text }}>Không tải được font. Vui lòng đóng và mở lại ứng dụng.</Text></View>;
  if (!loaded) return <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: 'center' }}><ActivityIndicator color={colors.primary} /></View>;
  return <DemoProvider><StatusBar style="light" /><Routes /></DemoProvider>;
}
