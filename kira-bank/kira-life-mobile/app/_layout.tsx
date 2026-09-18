import React from 'react';
import {Stack} from 'expo-router';
import {StatusBar} from 'expo-status-bar';
import {Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, useFonts} from '@expo-google-fonts/inter';
import {ActivityIndicator, Text, View} from 'react-native';
import {DemoProvider, useDemo} from '../src/store';
import {AuthProvider, useAuth} from '../src/auth';
import {ImportReviewProvider} from '../src/importReview';
import {Login} from '../src/login';
import {LanguageProvider, useT} from '../src/i18n';
import {ThemeProvider, useTheme} from '../src/theme';

function Routes() {
  const {colors} = useTheme();
  const {ready: demoReady} = useDemo();
  const {ready: authReady, session, unlocked} = useAuth();
  if (!authReady) return <View
    style={{flex: 1, backgroundColor: colors.bg, justifyContent: 'center'}}><ActivityIndicator color={colors.primary}/></View>;
  if (!session || !unlocked) return <Login/>;
  if (!demoReady) return <View
    style={{flex: 1, backgroundColor: colors.bg, justifyContent: 'center'}}><ActivityIndicator color={colors.primary}/></View>;
  return <Stack
    screenOptions={{headerShown: false, contentStyle: {backgroundColor: colors.bg}, animation: 'slide_from_right'}}>
    <Stack.Screen name="(tabs)" options={{animation: 'none'}}/>
  </Stack>;
}

function Inner() {
  const {colors} = useTheme();
  const t = useT();
  const [loaded, error] = useFonts({Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold});
  if (error) return <View style={{flex: 1, backgroundColor: colors.bg, padding: 32, justifyContent: 'center'}}><Text
    style={{color: colors.text}}>{t('Không tải được font. Vui lòng đóng và mở lại ứng dụng.')}</Text></View>;
  if (!loaded) return <View style={{flex: 1, backgroundColor: colors.bg, justifyContent: 'center'}}><ActivityIndicator
    color={colors.primary}/></View>;
  return <AuthProvider><ImportReviewProvider><DemoProvider><StatusBar
    style="light"/><Routes/></DemoProvider></ImportReviewProvider></AuthProvider>;
}

export default function Layout() {
  return <LanguageProvider><ThemeProvider><Inner/></ThemeProvider></LanguageProvider>;
}
