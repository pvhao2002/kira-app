import React, { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, TextInputProps, View, ViewStyle } from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, usePathname } from 'expo-router';
import { colors as c, fonts } from './theme';
import { useDemo } from './store';
export type IconName = React.ComponentProps<typeof Ionicons>['name'];
export const go = (screen: string, params: Record<string, string> = {}) => router.push({ pathname: '/[page]', params: { page: screen, ...params } });
export function T({ children, size = 14, color = c.text, bold = false, style }: { children: React.ReactNode; size?: number; color?: string; bold?: boolean; style?: React.ComponentProps<typeof Text>['style'] }) {
  return <Text style={[{ fontFamily: bold ? fonts.semibold : fonts.regular, fontSize: size, lineHeight: size * 1.35, color }, style]}>{children}</Text>;
}
const materialIcons: Partial<Record<IconName, React.ComponentProps<typeof MaterialIcons>['name']>> = { 'business-outline': 'account-balance', 'card-outline': 'credit-card', 'gift-outline': 'redeem', 'notifications-outline': 'notifications-none', 'person-outline': 'person-outline', 'options-outline': 'tune', 'calendar-outline': 'event-note', 'wallet-outline': 'account-balance-wallet', 'shield-checkmark-outline': 'verified-user', 'receipt-outline': 'receipt-long', 'scan-outline': 'document-scanner', 'document-lock-outline': 'lock-outline' };
export function Icon({ name, color = c.primary, size = 22 }: { name: IconName; color?: string; size?: number }) { return materialIcons[name] ? <MaterialIcons name={materialIcons[name]} size={size} color={color} /> : <Ionicons name={name} size={size} color={color} />; }
export function Row({ children, style }: { children: React.ReactNode; style?: ViewStyle }) { return <View style={[s.row, style]}>{children}</View>; }
export function Card({ children, style, tint = false }: { children: React.ReactNode; style?: ViewStyle; tint?: boolean }) {
  return <BlurView intensity={tint ? 24 : 16} tint="dark" style={[s.card, style]}><LinearGradient pointerEvents="none" colors={tint ? ['rgba(15,21,36,0.8)', 'rgba(18,27,43,0.8)', 'rgba(25,39,54,0.75)'] : ['rgba(15,21,36,0.7)', 'rgba(15,21,36,0.7)']} style={StyleSheet.absoluteFill} />{children}</BlurView>;
}
export function Badge({ children, tone = 'primary' }: { children: React.ReactNode; tone?: 'primary' | 'success' | 'warning' | 'error' | 'muted' }) { return <View style={[s.badge, { backgroundColor: c[tone] + '15', borderColor: c[tone] + '44' }]}><T size={11} bold color={c[tone]}>{children}</T></View>; }
export function Button({ label, onPress, icon, kind = 'primary', disabled = false, loading = false }: { label: string; onPress: () => void; icon?: IconName; kind?: 'primary' | 'secondary' | 'danger'; disabled?: boolean; loading?: boolean }) {
  const color = kind === 'primary' ? c.ink : kind === 'danger' ? c.error : c.primary;
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: disabled || loading }} disabled={disabled || loading} onPress={onPress} style={({ pressed }) => [s.button, { backgroundColor: kind === 'primary' ? c.primary : c.elevated, borderColor: kind === 'danger' ? c.error + '55' : c.border, opacity: disabled || loading ? 0.5 : pressed ? 0.75 : 1 }]}>
    {loading ? <ActivityIndicator color={color} /> : icon ? <Icon name={icon} color={color} size={18} /> : null}<T bold color={color} style={{ flexShrink: 1, textAlign: 'center' }}>{label}</T>
  </Pressable>;
}
export function Field({ label, hint, error, ...props }: TextInputProps & { label: string; hint?: string; error?: string }) { return <View style={{ gap: 7 }}><T size={12} color={c.muted}>{label}</T><TextInput accessibilityLabel={label} placeholderTextColor="#71889a" selectionColor={c.primary} {...props} style={[s.input, props.multiline && { height: 110, textAlignVertical: 'top' }, error ? { borderColor: c.error } : null, props.style]} />{error || hint ? <T size={12} color={error ? c.error : c.muted}>{error || hint}</T> : null}</View>; }
export function Chips({ values, value, onChange }: { values: { label: string; value: string }[]; value: string; onChange: (v: string) => void }) { return <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 2 }}>{values.map(item => <Pressable key={item.value} hitSlop={5} accessibilityRole="button" aria-pressed={item.value === value} accessibilityState={{ selected: item.value === value }} onPress={() => onChange(item.value)} style={[s.chip, item.value === value && { backgroundColor: '#1a3a4e', borderColor: '#58859c' }]}><T size={12} bold={item.value === value} color={item.value === value ? c.primary : c.muted}>{item.label}</T></Pressable>)}</ScrollView>; }
export function Section({ title, action, onPress }: { title: string; action?: string; onPress?: () => void }) { return <Row style={{ justifyContent: 'space-between', marginTop: 4 }}><T size={13} bold style={{ flex: 1, letterSpacing: 0.7 }}>{title.toLocaleUpperCase('vi')}</T>{action && onPress ? <Pressable accessibilityRole="button" onPress={onPress} style={{ minHeight: 20, justifyContent: 'center', paddingLeft: 10 }}><T size={12} color={c.primary}>{action}</T></Pressable> : null}</Row>; }
export function Info({ children, tone = 'primary' }: { children: React.ReactNode; tone?: 'primary' | 'error' | 'warning' | 'success' }) { return <View style={[s.info, { borderColor: c[tone] + '22' }]}><Icon name={tone === 'error' ? 'alert-circle-outline' : 'information-circle-outline'} color={c[tone]} size={19} /><T size={12} color={tone === 'primary' ? c.muted : c[tone]} style={{ flex: 1 }}>{children}</T></View>; }
export function FitValue({ value, size = 13, color = c.primary }: { value: string; size?: number; color?: string }) {
  const [width, setWidth] = useState(0);
  const fontSize = width ? Math.min(size, Math.max(8, width / Math.max(1, value.length * 0.57))) : size;
  return <View style={{ alignSelf: 'stretch', minWidth: 0 }} onLayout={event => setWidth(event.nativeEvent.layout.width)}><Text accessibilityLabel={value} numberOfLines={1} style={{ fontFamily: fonts.semibold, fontSize, lineHeight: fontSize * 1.35, color }}>{value}</Text></View>;
}
export function Metric({ label, value, color = c.primary }: { label: string; value: string; color?: string }) { return <View style={s.metric}><T size={10} color={c.muted}>{label}</T><FitValue value={value} color={color} /></View>; }
export function Progress({ value, color = c.primary }: { value: number; color?: string }) { return <View style={s.track}><View style={{ width: `${Math.min(100, Math.max(0, value))}%`, height: 6, backgroundColor: color, borderRadius: 8 }} /></View>; }
export function Empty({ title = 'Chưa có giao dịch', description = 'Thử thay đổi bộ lọc hoặc nhập chứng từ mẫu.', action, onPress }: { title?: string; description?: string; action?: string; onPress?: () => void }) { return <Card style={{ alignItems: 'center', paddingVertical: 36 }}><Icon name="file-tray-outline" size={48} /><T size={20} bold style={{ textAlign: 'center' }}>{title}</T><T color={c.muted} style={{ textAlign: 'center' }}>{description}</T>{action && onPress ? <Button label={action} onPress={onPress} /> : null}</Card>; }
export function Dialog({ visible, title, message, onClose, onConfirm, confirmLabel = 'Xác nhận' }: { visible: boolean; title: string; message: string; onClose: () => void; onConfirm?: () => void; confirmLabel?: string }) { return <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}><View style={s.scrim}><View style={{ width: '100%', maxWidth: 390 }}><Card><Icon name="information-circle-outline" size={30} /><T size={20} bold>{title}</T><T color={c.muted}>{message}</T>{onConfirm ? <Button label={confirmLabel} onPress={onConfirm} /> : null}<Button label={onConfirm ? 'Hủy bỏ' : 'Đã hiểu'} kind="secondary" onPress={onClose} /></Card></View></View></Modal>; }
export function useNotice() { const [message, setMessage] = useState(''); return { notify: setMessage, dialog: <Dialog visible={!!message} title="Kira Life · Bản demo" message={message} onClose={() => setMessage('')} /> }; }
export function BottomNav() {
  const inset = useSafeAreaInsets(); const path = usePathname();
  return <View style={{ backgroundColor: c.surface, paddingBottom: Math.max(inset.bottom, 8), paddingTop: 8, flexDirection: 'row' }}>{([{ label: 'Thẻ tín dụng', path: '/', icon: 'card-outline' }, { label: 'Đầu tư', path: '/investment', icon: 'trending-up' }, { label: 'Cá nhân', path: '/profile', icon: 'person-outline' }] as const).map(item => <Pressable key={item.path} accessibilityRole="tab" aria-selected={path === item.path} accessibilityState={{ selected: path === item.path }} onPress={() => router.replace(item.path)} style={{ flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', gap: 4 }}><Icon name={item.icon} color={path === item.path ? c.primary : c.muted} size={22} /><T size={10} color={c.muted}>{item.label}</T></Pressable>)}</View>;
}
export function Screen({ title, subtitle, children, back = false, footer, sheet = false }: { title: string; subtitle?: string; children: React.ReactNode; back?: boolean; footer?: React.ReactNode; sheet?: boolean }) {
  const inset = useSafeAreaInsets(); const { storageError } = useDemo(); const { notify, dialog } = useNotice();
  const brandTitle = ['Thẻ tín dụng', 'Thẻ của tôi', 'Ưu đãi & hoàn tiền'].includes(title) ? 'Thẻ Tín Dụng' : ['Đầu tư', 'Nhập giao dịch', 'Hàng đợi AI'].includes(title) ? 'Đầu Tư' : 'Cá Nhân';
  return <KeyboardAvoidingView style={s.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <View style={{ backgroundColor: c.surface, paddingTop: inset.top }}><View style={s.header}>
      <Pressable accessibilityRole="button" accessibilityLabel="Trang chủ" onPress={() => router.replace('/')} style={[s.iconButton, { width: 36, height: 36 }]}><Icon name="business-outline" size={20} /></Pressable>
      <View style={{ flex: 1 }}><T size={11} color={c.primary} style={{ letterSpacing: 0.5 }}>KIRA BANK</T><T size={16} bold>{brandTitle}</T></View>
      <Pressable accessibilityRole="button" accessibilityLabel="Thông báo" onPress={() => notify('Bạn đã xem hết thông báo.')} style={{ padding: 10 }}><Icon name="notifications-outline" color={c.muted} /><View style={{ position: 'absolute', right: 10, top: 8, width: 7, height: 7, borderRadius: 4, backgroundColor: c.primary }} /></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Cá nhân" onPress={() => router.replace('/profile')} style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' }}><Icon name="person-outline" color={c.ink} size={18} /></Pressable>
    </View></View>
    <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} style={sheet ? { marginTop: 40, borderTopLeftRadius: 28, borderTopRightRadius: 28, backgroundColor: c.surface } : undefined} contentContainerStyle={s.content}>
      {back && !['Thẻ của tôi', 'Ưu đãi & hoàn tiền', 'Nhập giao dịch', 'Hàng đợi AI', 'Lịch sử giao dịch'].includes(title) ? <Row style={{ paddingVertical: 8 }}><Pressable accessibilityRole="button" accessibilityLabel="Quay lại" onPress={() => router.canGoBack() ? router.back() : router.replace('/')} style={s.iconButton}><Icon name="arrow-back" color={c.text} /></Pressable><View style={{ flex: 1 }}><T size={18} bold>{title}</T>{subtitle ? <T size={11} color={c.muted}>{subtitle}</T> : null}</View></Row> : subtitle ? <T size={12} color={c.muted}>{subtitle}</T> : null}{storageError ? <Info tone="warning">{storageError}</Info> : null}{children}
    </ScrollView>
    {footer ? <View style={s.footer}>{footer}</View> : null}<BottomNav />{dialog}
  </KeyboardAvoidingView>;
}
export const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.bg }, row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  card: { padding: 16, gap: 12, borderRadius: 24, borderWidth: 0, borderColor: c.border, overflow: 'hidden' },
  content: { padding: 16, gap: 16, width: '100%', maxWidth: 600, alignSelf: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 64, paddingHorizontal: 16, paddingVertical: 8 },
  iconButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: '#18293a' },
  button: { minHeight: 40, borderRadius: 24, paddingHorizontal: 16, paddingVertical: 10, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, borderWidth: 1 },
  input: { minHeight: 44, borderRadius: 14, borderWidth: 1, borderColor: c.border, backgroundColor: '#182132', color: c.text, padding: 12, fontFamily: fonts.regular, fontSize: 14 },
  badge: { alignSelf: 'flex-start', borderRadius: 20, borderWidth: 0, paddingHorizontal: 9, paddingVertical: 3, maxWidth: '100%' },
  chip: { minHeight: 34, justifyContent: 'center', paddingHorizontal: 16, borderRadius: 24, borderWidth: 1, borderColor: c.border },
  info: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: '#101a2a', borderWidth: 0, padding: 10, borderRadius: 14 },
  metric: { flex: 1, padding: 12, gap: 6, borderRadius: 16, backgroundColor: '#152032', minWidth: 0 },
  track: { height: 6, backgroundColor: '#263348', borderRadius: 8, overflow: 'hidden' },
  footer: { padding: 16, gap: 8, backgroundColor: c.surface, borderTopWidth: 1, borderColor: c.border },
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', padding: 24, alignItems: 'center', justifyContent: 'center' },
});

