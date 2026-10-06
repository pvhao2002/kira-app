import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Animated,
  ColorValue,
  Easing,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  PressableProps,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle
} from 'react-native';
import {Ionicons, MaterialIcons} from '@expo/vector-icons';
import {LinearGradient} from 'expo-linear-gradient';
import {BlurView} from 'expo-blur';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {router, useFocusEffect, usePathname} from 'expo-router';
import {colors as c, fonts, useTheme} from './theme';
import {useDemo} from './store';
import {useLanguage, useT} from './i18n';
import {useNotificationApi} from './notificationApi';

export type IconName = React.ComponentProps<typeof Ionicons>['name'];
export const go = (screen: string, params: Record<string, string> = {}) => router.push({
  pathname: '/[page]',
  params: {page: screen, ...params}
});

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const PRESS_MS = 120;
const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);

function useReduceMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduced).catch(() => {
    });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => sub.remove();
  }, []);
  return reduced;
}

// Press feedback: scale + dim on press-in, released on press-out. transform/opacity only, native driver.
export function Touch({style, scale = 0.97, opacity = 1, ...props}: Omit<PressableProps, 'style'> & {
  style?: ViewStyle | (ViewStyle | false | null | undefined)[];
  scale?: number;
  opacity?: number
}) {
  const reduced = useReduceMotion();
  const press = useRef(new Animated.Value(0)).current;
  const animate = (toValue: number) => Animated.timing(press, {
    toValue,
    duration: PRESS_MS,
    easing: EASE_OUT,
    useNativeDriver: true
  }).start();
  return <AnimatedPressable {...props} pressRetentionOffset={props.pressRetentionOffset ?? 12}
                            onPressIn={event => {
                              animate(1);
                              props.onPressIn?.(event);
                            }} onPressOut={event => {
    animate(0);
    props.onPressOut?.(event);
  }} style={[style as ViewStyle, {
    opacity: press.interpolate({inputRange: [0, 1], outputRange: [opacity, opacity * 0.75]}),
    transform: reduced ? [] : [{scale: press.interpolate({inputRange: [0, 1], outputRange: [1, scale]})}]
  }]}/>;
}

export function T({children, size = 14, color, bold = false, style}: {
  children: React.ReactNode;
  size?: number;
  color?: string;
  bold?: boolean;
  style?: React.ComponentProps<typeof Text>['style']
}) {
  const {colors: c} = useTheme();
  return <Text style={[{
    fontFamily: bold ? fonts.semibold : fonts.regular,
    fontSize: size,
    lineHeight: size * 1.35,
    color: color ?? c.text
  }, style]}>{children}</Text>;
}

const materialIcons: Partial<Record<IconName, React.ComponentProps<typeof MaterialIcons>['name']>> = {
  'business-outline': 'account-balance',
  'card-outline': 'credit-card',
  'gift-outline': 'redeem',
  'notifications-outline': 'notifications-none',
  'person-outline': 'person-outline',
  'options-outline': 'tune',
  'calendar-outline': 'event-note',
  'wallet-outline': 'account-balance-wallet',
  'shield-checkmark-outline': 'verified-user',
  'receipt-outline': 'receipt-long',
  'scan-outline': 'document-scanner',
  'document-lock-outline': 'lock-outline'
};

export function Icon({name, color, size = 22}: { name: IconName; color?: ColorValue; size?: number }) {
  const {colors: c} = useTheme();
  const iconColor = color ?? c.primary;
  return materialIcons[name] ? <MaterialIcons name={materialIcons[name]} size={size} color={iconColor}/> :
    <Ionicons name={name} size={size} color={iconColor}/>;
}

export function Row({children, style}: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[s.row, style]}>{children}</View>;
}

export function Card({children, style, tint = false}: {
  children: React.ReactNode;
  style?: ViewStyle;
  tint?: boolean
}) {
  const {colors: c} = useTheme();
  return <BlurView intensity={tint ? 24 : 16} tint="dark"
                   style={[s.card, {borderColor: c.border}, style]}><LinearGradient pointerEvents="none"
                                                                                    colors={tint ? [c.surface + 'cc', c.elevated + 'cc', c.surface + 'bf'] : [c.surface + 'b3', c.surface + 'b3']}
                                                                                    style={StyleSheet.absoluteFill}/>{children}
  </BlurView>;
}

export function Badge({children, tone = 'primary'}: {
  children: React.ReactNode;
  tone?: 'primary' | 'success' | 'warning' | 'error' | 'muted'
}) {
  const {colors: c} = useTheme();
  return <View style={[s.badge, {backgroundColor: c[tone] + '15', borderColor: c[tone] + '44'}]}><T size={11} bold
                                                                                                    color={c[tone]}>{children}</T></View>;
}

export function Button({label, onPress, icon, kind = 'primary', disabled = false, loading = false}: {
  label: string;
  onPress: () => void;
  icon?: IconName;
  kind?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
  loading?: boolean
}) {
  const {colors: c} = useTheme();
  const color = kind === 'primary' ? c.ink : kind === 'danger' ? c.error : c.primary;
  return <Touch accessibilityRole="button" accessibilityLabel={label}
                accessibilityState={{disabled: disabled || loading}} disabled={disabled || loading}
                opacity={disabled || loading ? 0.5 : 1} onPress={onPress} style={[s.button, {
    backgroundColor: kind === 'primary' ? c.primary : c.elevated,
    borderColor: kind === 'danger' ? c.error + '55' : c.border
  }]}>
    {loading ? <ActivityIndicator color={color}/> : icon ? <Icon name={icon} color={color} size={18}/> : null}<T bold
                                                                                                                 color={color}
                                                                                                                 style={{
                                                                                                                   flexShrink: 1,
                                                                                                                   textAlign: 'center'
                                                                                                                 }}>{label}</T>
  </Touch>;
}

export function Field({label, hint, error, accessory, ...props}: TextInputProps & {
  label: string;
  hint?: string;
  error?: string;
  accessory?: React.ReactNode
}) {
  const {colors: c} = useTheme();
  return <View style={{gap: 7}}><T size={12} color={c.muted}>{label}</T><View>
    <TextInput accessibilityLabel={label} placeholderTextColor={c.muted} selectionColor={c.primary} {...props}
               style={[s.input, {
                 backgroundColor: c.elevated,
                 borderColor: error ? c.error : c.border,
                 color: c.text
               }, accessory ? {paddingRight: 44} : null, props.multiline && {
                 height: 110,
                 textAlignVertical: 'top'
               }, props.style]}/>
    {accessory ? <View
      style={{position: 'absolute', right: 4, top: 0, bottom: 0, justifyContent: 'center'}}>{accessory}</View> : null}
  </View>{error || hint ? <T size={12} color={error ? c.error : c.muted}>{error || hint}</T> : null}</View>;
}

export function Chips({values, value, onChange}: {
  values: { label: string; value: string }[];
  value: string;
  onChange: (v: string) => void
}) {
  const {colors: c} = useTheme();
  return <ScrollView horizontal showsHorizontalScrollIndicator={false}
                     contentContainerStyle={{gap: 8, paddingVertical: 2}}>{values.map(item => <Touch
    key={item.value} hitSlop={5} accessibilityRole="button" aria-pressed={item.value === value}
    accessibilityState={{selected: item.value === value}} onPress={() => onChange(item.value)}
    style={[s.chip, {borderColor: c.border}, item.value === value && {
      backgroundColor: c.primary + '22',
      borderColor: c.primary
    }]}><T size={12} bold={item.value === value}
           color={item.value === value ? c.primary : c.muted}>{item.label}</T></Touch>)}</ScrollView>;
}

export function LangSwitch() {
  const {lang, setLang} = useLanguage();
  const {colors: c} = useTheme();
  return <View style={[s.langSegment, {backgroundColor: c.surface, borderColor: c.border}]}>{([{
    value: 'vi' as const,
    label: 'VI'
  }, {value: 'en' as const, label: 'EN'}]).map(item => {
    const selected = lang === item.value;
    return <Touch key={item.value} accessibilityRole="button"
                  accessibilityLabel={item.value === 'vi' ? 'Tiếng Việt' : 'English'}
                  accessibilityState={{selected}} onPress={() => setLang(item.value)}
                  style={[s.langSegmentItem, selected && {backgroundColor: c.primary}]}><T
      size={12} bold color={selected ? c.ink : c.muted}>{item.label}</T></Touch>;
  })}</View>;
}

export function Section({title, action, onPress}: { title: string; action?: string; onPress?: () => void }) {
  const {lang} = useLanguage();
  const {colors: c} = useTheme();
  return <Row style={{justifyContent: 'space-between', marginTop: 4}}><T size={13} bold style={{
    flex: 1,
    letterSpacing: 0.7
  }}>{title.toLocaleUpperCase(lang)}</T>{action && onPress ? <Touch accessibilityRole="button" onPress={onPress}
                                                                    style={{
                                                                      minHeight: 20,
                                                                      justifyContent: 'center',
                                                                      paddingLeft: 10
                                                                    }}><T size={12}
                                                                          color={c.primary}>{action}</T></Touch> : null}
  </Row>;
}

export function Info({children, tone = 'primary'}: {
  children: React.ReactNode;
  tone?: 'primary' | 'error' | 'warning' | 'success'
}) {
  const {colors: c} = useTheme();
  return <View style={[s.info, {backgroundColor: c.surface + 'cc', borderColor: c[tone] + '22'}]}><Icon
    name={tone === 'error' ? 'alert-circle-outline' : 'information-circle-outline'} color={c[tone]} size={19}/><T
    size={12} color={tone === 'primary' ? c.muted : c[tone]} style={{flex: 1}}>{children}</T></View>;
}

export function FitValue({value, size = 13, color}: { value: string; size?: number; color?: string }) {
  const {colors: c} = useTheme();
  const valueColor = color ?? c.primary;
  const [width, setWidth] = useState(0);
  const fontSize = width ? Math.min(size, Math.max(8, width / Math.max(1, value.length * 0.57))) : size;
  return <View style={{alignSelf: 'stretch', minWidth: 0}} onLayout={event => setWidth(event.nativeEvent.layout.width)}><Text
    accessibilityLabel={value} numberOfLines={1} style={{
    fontFamily: fonts.semibold,
    fontSize,
    lineHeight: fontSize * 1.35,
    color: valueColor
  }}>{value}</Text></View>;
}

export function Metric({label, value, color}: { label: string; value: string; color?: string }) {
  const {colors: c} = useTheme();
  return <View style={[s.metric, {backgroundColor: c.elevated + 'bb'}]}><T size={10}
                                                                           color={c.muted}>{label}</T><FitValue
    value={value} color={color ?? c.primary}/></View>;
}

export function Progress({value, color}: { value: number; color?: string }) {
  const {colors: c} = useTheme();
  return <View style={[s.track, {backgroundColor: c.elevated}]}><View style={{
    width: `${Math.min(100, Math.max(0, value))}%`,
    height: 6,
    backgroundColor: color ?? c.primary,
    borderRadius: 8
  }}/></View>;
}

export function Empty({title, description, action, onPress}: {
  title?: string;
  description?: string;
  action?: string;
  onPress?: () => void
}) {
  const t = useT();
  const {colors: c} = useTheme();
  return <Card style={{alignItems: 'center', paddingVertical: 36}}><Icon name="file-tray-outline" size={48}/><T
    size={20} bold style={{textAlign: 'center'}}>{title ?? t('Chưa có giao dịch')}</T><T color={c.muted}
                                                                                         style={{textAlign: 'center'}}>{description ?? t('Thử thay đổi bộ lọc hoặc nhập chứng từ mẫu.')}</T>{action && onPress ?
    <Button label={action} onPress={onPress}/> : null}</Card>;
}

export function Dialog({visible, title, message, onClose, onConfirm, confirmLabel}: {
  visible: boolean;
  title: string;
  message: string;
  onClose: () => void;
  onConfirm?: () => void;
  confirmLabel?: string
}) {
  const t = useT();
  const {colors: c} = useTheme();
  return <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}><View style={s.scrim}><View
    style={{width: '100%', maxWidth: 390}}><Card><Icon name="information-circle-outline" size={30}/><T size={20}
                                                                                                       bold>{title}</T><T
    color={c.muted}>{message}</T>{onConfirm ?
    <Button label={confirmLabel ?? t('Xác nhận')} onPress={onConfirm}/> : null}<Button
    label={onConfirm ? t('Hủy bỏ') : t('Đã hiểu')} kind="secondary" onPress={onClose}/></Card></View></View></Modal>;
}

export function useNotice() {
  const t = useT();
  const [message, setMessage] = useState('');
  return {
    notify: setMessage,
    dialog: <Dialog visible={!!message} title={t('Kira Life')} message={message} onClose={() => setMessage('')}/>
  };
}

function NotificationBell() {
  const api = useNotificationApi();
  const {colors: c} = useTheme();
  const [count, setCount] = useState(0);
  useFocusEffect(useCallback(() => {
    let active = true;
    const refresh = () => AsyncStorage.getItem('kira-life-notifications').then(value => {
      if (!active) return;
      if (value === 'false') {
        setCount(0);
        return;
      }
      api.unreadCount().then(result => {
        if (active) setCount(result.count);
      }).catch(() => {
      });
    }).catch(() => {
    });
    refresh();
    const timer = setInterval(refresh, 30000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []));
  const t = useT();
  return <Touch accessibilityRole="button" accessibilityLabel={t('Thông báo')}
                accessibilityHint={count ? t('{{n}} thông báo chưa đọc', {n: count}) : undefined}
                onPress={() => go('notifications')} style={{padding: 10}}><Icon name="notifications-outline"
                                                                                    color={c.muted}/>{count > 0 ? <View
    style={{
      position: 'absolute',
      right: 5,
      top: 3,
      minWidth: 16,
      height: 16,
      borderRadius: 8,
      backgroundColor: c.error,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 3
    }}><T size={9} bold color={c.ink}>{count > 99 ? '99+' : String(count)}</T></View> : null}</Touch>;
}

const creditPages = ['cards', 'cards-manage', 'card-add', 'card-edit', 'billing-cycle', 'benefits', 'card-recommend', 'statement-import', 'credit-stats', 'bank-balance', 'bank-balance-history', 'statements', 'statement-add', 'statement-pay', 'payments'];
const investmentPages = ['import', 'manual-transaction', 'queue', 'source', 'ai-result', 'draft-edit', 'decision', 'result-partial', 'result-success', 'account-add', 'account-edit', 'account-stats', 'history', 'filter', 'transaction-detail', 'report-create', 'report-success', 'reports', 'investment-report-create', 'investment-reports', 'investment-report-detail', 'admin-investment-reports', 'admin-cloudflare', 'admin-ai-queue', 'ai-job-detail', 'admin-ai-job-detail', 'admin-source', 'admin-ai-result'];
const travelPages = ['travel-edit'];
const healthPages = ['health-profile'];
const personalPages = ['favorite-songs', 'job-tracker'];
const noBackRowPages = ['cards', 'benefits', 'import', 'queue', 'history', 'filter'];

export function tabGroup(path: string) {
  const page = path.replace(/^\//, '');
  if (page === '' || creditPages.includes(page)) return '/';
  if (page === 'investment' || investmentPages.includes(page)) return '/investment';
  if (page === 'travel' || travelPages.includes(page)) return '/travel';
  if (page === 'health' || healthPages.includes(page)) return '/health';
  if (personalPages.includes(page)) return '/profile';
  return '/profile';
}

export function BottomNav() {
  const inset = useSafeAreaInsets();
  const active = tabGroup(usePathname());
  const t = useT();
  const {colors: c} = useTheme();
  return <View style={{
    backgroundColor: c.surface,
    paddingBottom: Math.max(inset.bottom, 8),
    paddingTop: 8,
    flexDirection: 'row',
    borderTopWidth: 2,
    borderTopColor: 'transparent'
  }}>{([{label: 'Thẻ tín dụng', path: '/', icon: 'card-outline'}, {
    label: 'Đầu tư',
    path: '/investment',
    icon: 'trending-up'
  }, {label: 'Du lịch', path: '/travel', icon: 'map-outline'}, {
    label: 'Sức khỏe',
    path: '/health',
    icon: 'heart-outline'
  }, {label: 'Cá nhân', path: '/profile', icon: 'person-outline'}] as const).map(item => {
    const selected = active === item.path;
    return <Pressable key={item.path} accessibilityRole="tab" aria-selected={selected} accessibilityState={{selected}}
                      onPress={() => router.replace(item.path)} style={{
      flex: 1,
      minHeight: 48,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      borderTopWidth: 2,
      borderTopColor: selected ? c.primary : 'transparent',
      marginTop: -2
    }}><Icon name={item.icon} color={selected ? c.primary : c.muted} size={22}/><T size={10} bold={selected}
                                                                                   color={selected ? c.primary : c.muted}>{t(item.label)}</T></Pressable>;
  })}</View>;
}

export function Screen({title, subtitle, children, back = false, footer, sheet = false}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  back?: boolean;
  footer?: React.ReactNode;
  sheet?: boolean
}) {
  const inset = useSafeAreaInsets();
  const {storageError} = useDemo();
  const {notify, dialog} = useNotice();
  const {colors: c} = useTheme();
  const t = useT();
  const {lang, toggle} = useLanguage();
  const pathname = usePathname();
  const group = tabGroup(pathname);
  const brandTitle = group === '/' ? t('Thẻ Tín Dụng') : group === '/investment' ? t('Đầu Tư') : group === '/travel' ? t('Du Lịch') : group === '/health' ? t('Sức Khỏe') : t('Cá Nhân');
  const page = pathname.replace(/^\//, '');
  return <KeyboardAvoidingView style={[s.screen, {backgroundColor: c.bg}]}
                               behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <View style={{backgroundColor: c.surface, paddingTop: inset.top}}><View style={s.header}>
      <Touch accessibilityRole="button" accessibilityLabel={t('Trang chủ')} onPress={() => router.replace('/')}
             style={[s.iconButton, {width: 36, height: 36, backgroundColor: c.elevated}]}><Icon
        name="business-outline" size={20}/></Touch>
      <View style={{flex: 1}}><T size={11} color={c.primary} style={{letterSpacing: 0.5}}>KIRA BANK</T><T size={16}
                                                                                                          bold>{brandTitle}</T></View>
      <Touch accessibilityRole="button" accessibilityLabel={t('Đổi ngôn ngữ')}
             accessibilityHint={lang === 'vi' ? 'English' : 'Tiếng Việt'} onPress={toggle}
             style={[s.langSwitch, {
               backgroundColor: c.primary + '15',
               borderColor: c.primary + '40'
             }]}>
        <Icon name="globe-outline" size={13} color={c.primary}/>
        <T size={11} bold color={c.primary} style={{letterSpacing: 0.3}}>{lang === 'vi' ? 'VI' : 'EN'}</T>
      </Touch>
      <NotificationBell/>
      <Touch accessibilityRole="button" accessibilityLabel={t('Cá nhân')} onPress={() => router.replace('/profile')}
             style={{
               width: 32,
               height: 32,
               borderRadius: 16,
               backgroundColor: c.primary,
               alignItems: 'center',
               justifyContent: 'center'
             }}><Icon name="person-outline" color={c.ink} size={18}/></Touch>
    </View></View>
    <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} style={sheet ? {
      marginTop: 40,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      backgroundColor: c.surface
    } : undefined} contentContainerStyle={s.content}>
      {back && !noBackRowPages.includes(page) ?
        <Row style={{paddingVertical: 8}}><Touch accessibilityRole="button" accessibilityLabel={t('Quay lại')}
                                                  onPress={() => router.canGoBack() ? router.back() : router.replace('/')}
                                                 style={[s.iconButton, {backgroundColor: c.elevated}]}><Icon
          name="arrow-back" color={c.text}/></Touch><View style={{flex: 1}}><T size={18} bold>{title}</T>{subtitle ?
          <T size={11} color={c.muted}>{subtitle}</T> : null}</View></Row> : subtitle ?
          <T size={12} color={c.muted}>{subtitle}</T> : null}{storageError ?
      <Info tone="warning">{t(storageError)}</Info> : null}{children}
    </ScrollView>
    {footer ? <View style={[s.footer, {
      backgroundColor: c.surface,
      borderColor: c.border
    }]}>{footer}</View> : null}<BottomNav/>{dialog}
  </KeyboardAvoidingView>;
}

export const s = StyleSheet.create({
  screen: {flex: 1, backgroundColor: c.bg}, row: {flexDirection: 'row', alignItems: 'center', gap: 12},
  card: {padding: 16, gap: 12, borderRadius: 24, borderWidth: 0, borderColor: c.border, overflow: 'hidden'},
  content: {padding: 16, gap: 16, width: '100%', maxWidth: 600, alignSelf: 'center'},
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 64,
    paddingHorizontal: 16,
    paddingVertical: 8
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#18293a'
  },
  button: {
    minHeight: 40,
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1
  },
  input: {
    minHeight: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: '#182132',
    color: c.text,
    padding: 12,
    fontFamily: fonts.regular,
    fontSize: 14
  },
  badge: {
    alignSelf: 'flex-start',
    borderRadius: 20,
    borderWidth: 0,
    paddingHorizontal: 9,
    paddingVertical: 3,
    maxWidth: '100%'
  },
  chip: {
    minHeight: 34,
    justifyContent: 'center',
    paddingHorizontal: 16,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: c.border
  },
  info: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#101a2a',
    borderWidth: 0,
    padding: 10,
    borderRadius: 14
  },
  metric: {flex: 1, padding: 12, gap: 6, borderRadius: 16, backgroundColor: '#152032', minWidth: 0},
  track: {height: 6, backgroundColor: '#263348', borderRadius: 8, overflow: 'hidden'},
  footer: {padding: 16, gap: 8, backgroundColor: c.surface, borderTopWidth: 1, borderColor: c.border},
  scrim: {flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', padding: 24, alignItems: 'center', justifyContent: 'center'},
  langSwitch: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 30,
    paddingHorizontal: 10,
    borderRadius: 16,
    backgroundColor: c.primary + '15',
    borderWidth: 1,
    borderColor: c.primary + '40'
  },
  langSegment: {
    flexDirection: 'row',
    backgroundColor: '#101a2a',
    borderRadius: 20,
    padding: 3,
    borderWidth: 1,
    borderColor: c.border
  },
  langSegmentItem: {minWidth: 44, minHeight: 30, borderRadius: 17, alignItems: 'center', justifyContent: 'center'},
  langSegmentItemActive: {backgroundColor: c.primary},
});
