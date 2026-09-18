import React from 'react';
import {Tabs} from 'expo-router';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {Icon, IconName} from '../../src/ui';
import {useT} from '../../src/i18n';
import {fonts, useTheme} from '../../src/theme';

export default function Layout() {
  const insets = useSafeAreaInsets();
  const t = useT();
  const {colors} = useTheme();
  return <Tabs tabBar={() => null} screenOptions={{
    headerShown: false,
    tabBarActiveTintColor: colors.primary,
    tabBarInactiveTintColor: colors.muted,
    tabBarStyle: {
      backgroundColor: colors.surface,
      borderTopColor: colors.border,
      height: 72 + insets.bottom,
      paddingTop: 8,
      paddingBottom: Math.max(insets.bottom, 8)
    },
    tabBarIconStyle: {height: 24},
    tabBarItemStyle: {paddingBottom: 4},
    tabBarLabelStyle: {fontFamily: fonts.medium, fontSize: 11, lineHeight: 16}
  }}>
    {([{name: 'index', title: 'Thẻ tín dụng', icon: 'card-outline'}, {
      name: 'investment',
      title: 'Đầu tư',
      icon: 'trending-up-outline'
    }, {name: 'travel', title: 'Du lịch', icon: 'map-outline'}, {
      name: 'health',
      title: 'Sức khỏe',
      icon: 'heart-outline'
    }, {name: 'profile', title: 'Cá nhân', icon: 'person-outline'}] as const).map(tab => <Tabs.Screen key={tab.name}
                                                                                                      name={tab.name}
                                                                                                      options={{
                                                                                                        title: t(tab.title),
                                                                                                        tabBarIcon: ({color}) =>
                                                                                                          <Icon
                                                                                                            name={tab.icon as IconName}
                                                                                                            color={color}/>
                                                                                                      }}/>)}
  </Tabs>;
}

