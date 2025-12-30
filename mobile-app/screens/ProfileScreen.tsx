import React from 'react';
import { StyleSheet, ScrollView, View, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';

export default function ProfileScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { user, logout, isLoading } = useAuth();

  const handleLogout = () => {
    Alert.alert(
      'Đăng xuất',
      'Bạn có chắc chắn muốn đăng xuất khỏi tài khoản?',
      [
        {
          text: 'Hủy',
          style: 'cancel',
        },
        {
          text: 'Đăng xuất',
          style: 'destructive',
          onPress: async () => {
            try {
              await logout();
              router.replace('/login');
            } catch (error) {
              Alert.alert('Lỗi', 'Có lỗi xảy ra khi đăng xuất. Vui lòng thử lại.');
            }
          },
        },
      ]
    );
  };

  // Get user initials for avatar
  const getUserInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const menuItems = [
    {
      id: '1',
      title: 'Thông tin cá nhân',
      subtitle: 'Chỉnh sửa thông tin tài khoản',
      icon: '👤',
    },
    {
      id: '2',
      title: 'Bảo mật',
      subtitle: 'Mật khẩu và xác thực 2 bước',
      icon: '🔒',
    },
    {
      id: '3',
      title: 'Thông báo',
      subtitle: 'Cài đặt thông báo ứng dụng',
      icon: '🔔',
    },
    {
      id: '4',
      title: 'Ngôn ngữ',
      subtitle: 'Tiếng Việt',
      icon: '🌐',
    },
    {
      id: '5',
      title: 'Hỗ trợ',
      subtitle: 'Trung tâm trợ giúp và liên hệ',
      icon: '❓',
    },
    {
      id: '6',
      title: 'Về ứng dụng',
      subtitle: 'Phiên bản 1.0.0',
      icon: 'ℹ️',
    },
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView style={styles.scrollView}>
        <ThemedView style={styles.header}>
          <View style={styles.avatarContainer}>
            <View style={[styles.avatar, { backgroundColor: colors.tint }]}>
              <ThemedText style={[styles.avatarText, { color: '#FFFFFF' }]}>
                {user ? getUserInitials(user.name) : 'NA'}
              </ThemedText>
            </View>
          </View>
          
          <ThemedText type="title" style={styles.userName}>
            {user?.name || 'Người dùng'}
          </ThemedText>
          <ThemedText style={styles.userEmail}>
            {user?.email || 'email@example.com'}
          </ThemedText>
          
          <View style={[styles.premiumBadge, { backgroundColor: user?.isPremium ? '#FFD700' : '#E0E0E0' }]}>
            <ThemedText style={[styles.premiumText, { color: user?.isPremium ? '#000' : '#666' }]}>
              {user?.isPremium ? '⭐ Tài khoản Premium' : '👤 Tài khoản Thường'}
            </ThemedText>
          </View>
        </ThemedView>

        <ThemedView style={styles.statsContainer}>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <ThemedText style={styles.statValue}>5</ThemedText>
              <ThemedText style={styles.statLabel}>Thẻ đã liên kết</ThemedText>
            </View>
            <View style={styles.statItem}>
              <ThemedText style={styles.statValue}>127</ThemedText>
              <ThemedText style={styles.statLabel}>Giao dịch</ThemedText>
            </View>
            <View style={styles.statItem}>
              <ThemedText style={styles.statValue}>85%</ThemedText>
              <ThemedText style={styles.statLabel}>Độ chính xác dự đoán</ThemedText>
            </View>
          </View>
        </ThemedView>

        <ThemedView style={styles.menuContainer}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>
            Cài đặt tài khoản
          </ThemedText>
          
          {menuItems.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={[styles.menuItem, { backgroundColor: colors.background }]}
              activeOpacity={0.7}
            >
              <View style={styles.menuItemContent}>
                <View style={styles.menuItemLeft}>
                  <ThemedText style={styles.menuIcon}>{item.icon}</ThemedText>
                  <View style={styles.menuItemText}>
                    <ThemedText style={styles.menuItemTitle}>
                      {item.title}
                    </ThemedText>
                    <ThemedText style={styles.menuItemSubtitle}>
                      {item.subtitle}
                    </ThemedText>
                  </View>
                </View>
                <ThemedText style={styles.menuArrow}>›</ThemedText>
              </View>
            </TouchableOpacity>
          ))}
        </ThemedView>

        <ThemedView style={styles.actionsContainer}>
          <TouchableOpacity
            style={[styles.logoutButton, { backgroundColor: '#FF4444' }]}
            activeOpacity={0.8}
            onPress={handleLogout}
            disabled={isLoading}
          >
            <ThemedText style={[styles.logoutText, { color: '#FFFFFF' }]}>
              {isLoading ? 'Đang đăng xuất...' : 'Đăng xuất'}
            </ThemedText>
          </TouchableOpacity>
        </ThemedView>

        <ThemedView style={styles.footer}>
          <ThemedText style={styles.footerText}>
            Kira Finance App v1.0.0
          </ThemedText>
          <ThemedText style={styles.footerText}>
            © 2024 Kira Technology
          </ThemedText>
        </ThemedView>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  header: {
    alignItems: 'center',
    padding: 24,
    paddingBottom: 16,
  },
  avatarContainer: {
    marginBottom: 16,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 32,
    fontWeight: 'bold',
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 16,
    opacity: 0.7,
    marginBottom: 12,
  },
  premiumBadge: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  premiumText: {
    fontSize: 14,
    fontWeight: '600',
  },
  statsContainer: {
    padding: 16,
    paddingTop: 8,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    padding: 16,
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    opacity: 0.7,
    textAlign: 'center',
  },
  menuContainer: {
    padding: 16,
    paddingTop: 8,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 16,
  },
  menuItem: {
    marginBottom: 8,
    borderRadius: 8,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  menuItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  menuIcon: {
    fontSize: 24,
    marginRight: 16,
  },
  menuItemText: {
    flex: 1,
  },
  menuItemTitle: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 2,
  },
  menuItemSubtitle: {
    fontSize: 14,
    opacity: 0.6,
  },
  menuArrow: {
    fontSize: 20,
    opacity: 0.5,
  },
  actionsContainer: {
    padding: 16,
    paddingTop: 8,
  },
  logoutButton: {
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600',
  },
  footer: {
    alignItems: 'center',
    padding: 24,
    paddingTop: 16,
  },
  footerText: {
    fontSize: 12,
    opacity: 0.5,
    marginBottom: 4,
  },
});