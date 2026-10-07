import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import {Platform} from 'react-native';

const TOKEN_KEY = 'kira-life-push-token';
const PREFERENCE_KEY = 'kira-life-notifications';
const PATH = '/api/v1/notifications/push-devices';

type RequestJson = <T>(path: string, init?: RequestInit) => Promise<T>;

Notifications.setNotificationHandler({
  handleNotification: async () => ({shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false})
});

/**
 * Registers this device's Expo push token for the signed-in account, or removes it when the "Thông báo" preference
 * is off. Best effort: never throws, and the token is never logged. Remote push needs a development/production build
 * (unavailable in Expo Go on Android) and an EAS projectId (`eas init`).
 */
export async function syncPushRegistration(requestJson: RequestJson): Promise<void> {
  try {
    if (await AsyncStorage.getItem(PREFERENCE_KEY) === 'false') return await unregisterPush(requestJson);
    if (Platform.OS === 'web' || (Constants.executionEnvironment === 'storeClient' && Platform.OS === 'android')) return;
    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    if (!projectId) {
      if (__DEV__) console.warn('[push] No EAS projectId; run `eas init` to enable push notifications.');
      return;
    }
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Kira Life',
        importance: Notifications.AndroidImportance.HIGH
      });
    }
    let {status} = await Notifications.getPermissionsAsync();
    if (status !== 'granted') status = (await Notifications.requestPermissionsAsync()).status;
    if (status !== 'granted') return;
    const token = (await Notifications.getExpoPushTokenAsync({projectId})).data;
    await requestJson(PATH, {method: 'PUT', body: JSON.stringify({token, platform: Platform.OS === 'ios' ? 'IOS' : 'ANDROID'})});
    await AsyncStorage.setItem(TOKEN_KEY, token);
  } catch {
    if (__DEV__) console.warn('[push] Registration skipped.');
  }
}

/** Removes this device's token from the account (logout, preference off). Best effort. */
export async function unregisterPush(requestJson: RequestJson): Promise<void> {
  try {
    const token = await AsyncStorage.getItem(TOKEN_KEY);
    if (!token) return;
    await requestJson(PATH, {method: 'DELETE', body: JSON.stringify({token})});
    await AsyncStorage.removeItem(TOKEN_KEY);
  } catch { /* the server also drops tokens Expo reports as unregistered */
  }
}
