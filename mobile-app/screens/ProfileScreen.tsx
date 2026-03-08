import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, Href } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { AppPalette } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';

const P = AppPalette;

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const [note, setNote] = useState('');
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(true);

  const displayName = 'Nguyễn Hoàng Nam';
  const displayEmail = user?.email ?? 'nam.nguyen@example.com';

  const handleLogout = async () => {
    await logout();
    router.replace('/login');
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: P.background }]} edges={['top']}>
      <View style={[styles.header, { backgroundColor: P.background, borderBottomColor: P.headerBorder }]}>
        <Text style={[styles.headerTitle, { color: P.text }]}>Hồ sơ cá nhân</Text>
        <TouchableOpacity style={[styles.headerBtn, { backgroundColor: P.surfaceInput }]} activeOpacity={0.8}>
          <MaterialIcons name="settings" size={24} color={P.text} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.profileSection}>
          <View style={styles.avatarWrap}>
            <View style={[styles.avatar, { backgroundColor: P.surfaceInput, borderColor: P.surfaceCard }]}>
              <MaterialIcons name="person" size={48} color={P.textSecondary} />
            </View>
            <TouchableOpacity style={[styles.editAvatarBtn, { backgroundColor: P.primary }]} activeOpacity={0.8}>
              <MaterialIcons name="edit" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
          <Text style={[styles.userName, { color: P.text }]}>{displayName}</Text>
          <Text style={[styles.userEmail, { color: P.textSecondary }]}>{displayEmail}</Text>
          <View style={[styles.premiumBadge, { backgroundColor: P.primarySoft }]}>
            <MaterialIcons name="verified" size={14} color={P.primary} />
            <Text style={[styles.premiumText, { color: P.primary }]}>Thành viên Premium</Text>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <Text style={[styles.sectionTitle, { color: P.textSecondary }]}>Ghi chú cá nhân</Text>
            <TouchableOpacity activeOpacity={0.8}>
              <Text style={[styles.sectionLink, { color: P.primary }]}>Lịch sử</Text>
            </TouchableOpacity>
          </View>
          <View style={[styles.noteCard, { backgroundColor: P.surfaceCard, borderColor: P.border }]}>
            <TextInput
              style={[styles.noteInput, { color: P.text }]}
              placeholder="Viết ghi chú nhanh của bạn tại đây... Ví dụ: Mua quà sinh nhật, lịch hẹn bác sĩ..."
              placeholderTextColor={P.textSecondary}
              value={note}
              onChangeText={setNote}
              multiline
              numberOfLines={4}
            />
            <View style={[styles.noteFooter, { borderTopColor: P.border }]}>
              <View style={styles.noteActions}>
                <TouchableOpacity style={styles.noteIconBtn}><MaterialIcons name="format-bold" size={20} color={P.textSecondary} /></TouchableOpacity>
                <TouchableOpacity style={styles.noteIconBtn}><MaterialIcons name="format-italic" size={20} color={P.textSecondary} /></TouchableOpacity>
                <TouchableOpacity style={styles.noteIconBtn}><MaterialIcons name="list" size={20} color={P.textSecondary} /></TouchableOpacity>
              </View>
              <TouchableOpacity style={[styles.saveNoteBtn, { backgroundColor: P.primary }]} activeOpacity={0.8}>
                <Text style={styles.saveNoteText}>Lưu</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.menuCard, { backgroundColor: P.surfaceCard, borderColor: P.border }]}
          activeOpacity={0.8}
          onPress={() => router.push('/history-1x' as Href)}
        >
          <View style={[styles.menuIconWrap, { backgroundColor: 'rgba(99,102,241,0.15)' }]}>
            <MaterialIcons name="history" size={24} color="#818cf8" />
          </View>
          <View style={styles.menuContent}>
            <Text style={[styles.menuTitle, { color: P.text }]}>Lịch sử 1x</Text>
            <Text style={[styles.menuSub, { color: P.textSecondary }]}>Xem lại lịch sử giao dịch 1x</Text>
          </View>
          <MaterialIcons name="chevron-right" size={24} color={P.textSecondary} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.menuCard, { backgroundColor: P.surfaceCard, borderColor: P.border, marginTop: 12 }]}
          activeOpacity={0.8}
          onPress={() => router.push('/query-execute' as Href)}
        >
          <View style={[styles.menuIconWrap, { backgroundColor: P.primarySoft }]}>
            <MaterialIcons name="search" size={24} color={P.primary} />
          </View>
          <View style={styles.menuContent}>
            <Text style={[styles.menuTitle, { color: P.text }]}>Tra cứu sự kiện</Text>
            <Text style={[styles.menuSub, { color: P.textSecondary }]}>Tìm kiếm và xem chi tiết sự kiện</Text>
          </View>
          <MaterialIcons name="chevron-right" size={24} color={P.textSecondary} />
        </TouchableOpacity>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: P.textSecondary, marginBottom: 12 }]}>Bảo mật & Cài đặt</Text>
          <View style={[styles.settingsCard, { backgroundColor: P.surfaceCard, borderColor: P.border }]}>
            <TouchableOpacity style={styles.settingRow} activeOpacity={0.8}>
              <View style={[styles.settingIconWrap, { backgroundColor: 'rgba(249,115,22,0.15)' }]}>
                <MaterialIcons name="lock-reset" size={24} color={P.orange} />
              </View>
              <View style={styles.settingContent}>
                <Text style={[styles.settingTitle, { color: P.text }]}>Đổi mật khẩu</Text>
                <Text style={[styles.settingSub, { color: P.textSecondary }]}>Cập nhật mật khẩu định kỳ</Text>
              </View>
              <MaterialIcons name="chevron-right" size={24} color={P.textSecondary} />
            </TouchableOpacity>
            <View style={[styles.settingDivider, { backgroundColor: P.border }]} />
            <View style={styles.settingRow}>
              <View style={[styles.settingIconWrap, { backgroundColor: P.greenSoft }]}>
                <MaterialIcons name="security" size={24} color={P.green} />
              </View>
              <View style={styles.settingContent}>
                <Text style={[styles.settingTitle, { color: P.text }]}>Bảo mật 2 lớp</Text>
                <Text style={[styles.settingSub, { color: P.textSecondary }]}>Bảo vệ tài khoản tối đa</Text>
              </View>
              <Switch
                value={twoFactorEnabled}
                onValueChange={setTwoFactorEnabled}
                trackColor={{ false: P.surfaceInput, true: P.primary }}
                thumbColor="#fff"
              />
            </View>
            <View style={[styles.settingDivider, { backgroundColor: P.border }]} />
            <TouchableOpacity style={styles.settingRow} activeOpacity={0.8}>
              <View style={[styles.settingIconWrap, { backgroundColor: 'rgba(168,85,247,0.15)' }]}>
                <MaterialIcons name="notifications-active" size={24} color="#a855f7" />
              </View>
              <View style={styles.settingContent}>
                <Text style={[styles.settingTitle, { color: P.text }]}>Thông báo</Text>
                <Text style={[styles.settingSub, { color: P.textSecondary }]}>Quản lý nhận thông báo</Text>
              </View>
              <MaterialIcons name="chevron-right" size={24} color={P.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.logoutBtn, { backgroundColor: P.redSoft }]}
          onPress={handleLogout}
          activeOpacity={0.8}
        >
          <MaterialIcons name="logout" size={22} color={P.red} />
          <Text style={[styles.logoutText, { color: P.red }]}>Đăng xuất</Text>
        </TouchableOpacity>

        <View style={styles.bottomPad} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 20, fontWeight: '700' },
  headerBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 100 },
  profileSection: { alignItems: 'center', paddingVertical: 24 },
  avatarWrap: { position: 'relative', marginBottom: 16 },
  avatar: {
    width: 112,
    height: 112,
    borderRadius: 56,
    borderWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editAvatarBtn: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: AppPalette.background,
  },
  userName: { fontSize: 24, fontWeight: '700', marginBottom: 4 },
  userEmail: { fontSize: 14, fontWeight: '500', marginBottom: 8 },
  premiumBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  premiumText: { fontSize: 12, fontWeight: '700' },
  section: { marginTop: 24 },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, paddingHorizontal: 4 },
  sectionTitle: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  sectionLink: { fontSize: 12, fontWeight: '500' },
  noteCard: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  noteInput: {
    minHeight: 120,
    padding: 16,
    fontSize: 16,
    textAlignVertical: 'top',
  },
  noteFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
  },
  noteActions: { flexDirection: 'row', gap: 8 },
  noteIconBtn: { padding: 4 },
  saveNoteBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  saveNoteText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  menuCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 24,
    gap: 16,
  },
  menuIconWrap: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  menuContent: { flex: 1 },
  menuTitle: { fontSize: 16, fontWeight: '600' },
  menuSub: { fontSize: 12, marginTop: 2 },
  settingsCard: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 16,
  },
  settingIconWrap: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  settingContent: { flex: 1 },
  settingTitle: { fontSize: 16, fontWeight: '600' },
  settingSub: { fontSize: 12, marginTop: 2 },
  settingDivider: { height: 1, marginLeft: 72 },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 48,
    borderRadius: 12,
    marginTop: 24,
  },
  logoutText: { fontSize: 16, fontWeight: '600' },
  bottomPad: { height: 24 },
});
