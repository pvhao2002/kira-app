import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, Href } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { AppPalette } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';

export default function LoginScreen() {
  const { login, isLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const cardBg = AppPalette.background;
  const inputBg = AppPalette.inputDark;
  const textSecondary = AppPalette.textSecondary;
  const labelColor = AppPalette.labelDark;
  const dividerBorder = AppPalette.borderDivider;
  const borderColor = AppPalette.borderStrong;
  const socialTextColor = '#e2e8f0';
  const blobTop = 'rgba(19, 127, 236, 0.2)';
  const blobBottom = 'rgba(19, 127, 236, 0.1)';

  const handleSubmit = async () => {
    try {
      await login(email.trim(), password);
      router.replace('/(tabs)/home' as Href);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Đăng nhập thất bại';
      Alert.alert('Lỗi', message);
    }
  };

  const handleQuickLogin = async (provider: 'faceid' | 'google') => {
    // Đơn giản: đăng nhập mock với email theo provider để flow hoạt động.
    const mockEmail = provider === 'faceid' ? 'faceid@kira.app' : 'google@kira.app';
    try {
      await login(mockEmail, 'social-login');
      router.replace('/(tabs)/home' as Href);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Đăng nhập nhanh thất bại';
      Alert.alert('Lỗi', message);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: AppPalette.background }]}>
      {/* Blurred background blobs (mockup: primary/20, primary/10) */}
      <View style={[styles.blob, styles.blobTopRight, { backgroundColor: blobTop }]} />
      <View style={[styles.blob, styles.blobBottomLeft, { backgroundColor: blobBottom }]} />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <View style={styles.centerWrap}>
          <View
            style={[
              styles.card,
              {
                backgroundColor: cardBg,
                borderColor: 'transparent',
                borderWidth: 0,
              },
            ]}
          >
            {/* Logo / Branding */}
            <View style={styles.branding}>
              <View style={[styles.logoGradient, { backgroundColor: AppPalette.primary }]}>
                <MaterialIcons name="sports-soccer" size={34} color="#ffffff" />
              </View>
              <Text style={[styles.title, { color: AppPalette.text }]}>Đăng nhập</Text>
              <Text style={[styles.subtitle, { color: textSecondary }]}>
                Chào mừng trở lại! Vui lòng đăng nhập để tiếp tục.
              </Text>
            </View>

            {/* Form */}
            <View style={styles.form}>
              {/* Username / Email */}
              <View style={styles.field}>
                <Text style={[styles.label, { color: labelColor }]}>
                  Email hoặc Tên đăng nhập
                </Text>
                <View
                  style={[
                    styles.inputWrap,
                    {
                      backgroundColor: inputBg,
                      borderColor: borderColor,
                    },
                  ]}
                >
                  <MaterialIcons
                    name="person"
                    size={20}
                    color={textSecondary}
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={[styles.input, { color: AppPalette.text }]}
                    placeholder="user@example.com"
                    placeholderTextColor={textSecondary}
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    autoComplete="email"
                  />
                </View>
              </View>

              {/* Password */}
              <View style={styles.field}>
                <View style={styles.passwordHeader}>
                  <Text style={[styles.label, { color: labelColor }]}>Mật khẩu</Text>
                  <TouchableOpacity activeOpacity={0.7}>
                    <Text style={[styles.forgotText, { color: AppPalette.primary }]}>
                      Quên mật khẩu?
                    </Text>
                  </TouchableOpacity>
                </View>
                <View
                  style={[
                    styles.inputWrap,
                    {
                      backgroundColor: inputBg,
                      borderColor: borderColor,
                    },
                  ]}
                >
                  <MaterialIcons
                    name="lock"
                    size={20}
                    color={textSecondary}
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={[styles.input, { color: AppPalette.text }]}
                    placeholder="Nhập mật khẩu"
                    placeholderTextColor={textSecondary}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                  />
                  <MaterialIcons
                    name="visibility-off"
                    size={20}
                    color={textSecondary}
                    style={styles.eyeIcon}
                  />
                </View>
              </View>

              {/* Primary submit */}
              <TouchableOpacity
                style={[styles.primaryBtn, { backgroundColor: AppPalette.primary }]}
                activeOpacity={0.95}
                onPress={handleSubmit}
                disabled={isLoading}
              >
                <Text style={styles.primaryBtnText}>
                  {isLoading ? 'Đang đăng nhập...' : 'Đăng nhập'}
                </Text>
              </TouchableOpacity>

              {/* Divider */}
              <View style={styles.dividerWrap}>
                <View style={[styles.dividerLine, { borderBottomColor: dividerBorder }]} />
                <Text
                  style={[
                    styles.dividerLabel,
                    { color: textSecondary, backgroundColor: cardBg },
                  ]}
                >
                  Hoặc đăng nhập với
                </Text>
                <View style={[styles.dividerLine, { borderBottomColor: dividerBorder }]} />
              </View>

              {/* Social / Biometric buttons */}
              <View style={styles.socialRow}>
                <TouchableOpacity
                  style={[
                    styles.socialBtn,
                    {
                      borderColor: borderColor,
                      backgroundColor: inputBg,
                    },
                  ]}
                  activeOpacity={0.9}
                  onPress={() => handleQuickLogin('faceid')}
                >
                  <MaterialIcons
                    name="fingerprint"
                    size={20}
                    color={textSecondary}
                  />
                  <Text style={[styles.socialText, { color: socialTextColor }]}>
                    Face ID
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.socialBtn,
                    {
                      borderColor: borderColor,
                      backgroundColor: inputBg,
                    },
                  ]}
                  activeOpacity={0.9}
                  onPress={() => handleQuickLogin('google')}
                >
                  <View style={styles.googleIcon}>
                    <Text style={styles.googleIconText}>G</Text>
                  </View>
                  <Text style={[styles.socialText, { color: socialTextColor }]}>
                    Google
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Footer */}
            <View style={styles.footer}>
              <Text style={[styles.footerText, { color: textSecondary }]}>
                Bạn chưa có tài khoản?{' '}
                <Text style={[styles.footerLink, { color: AppPalette.primary }]}>
                  Đăng ký ngay
                </Text>
              </Text>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  centerWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 24,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 30,
    elevation: 10,
  },
  branding: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logoGradient: {
    width: 80,
    height: 80,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
  },
  form: {
    gap: 18,
  },
  field: {
    gap: 8,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  inputIcon: {
    marginRight: 8,
  },
  eyeIcon: {
    marginLeft: 8,
  },
  input: {
    flex: 1,
    fontSize: 15,
  },
  passwordHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  forgotText: {
    fontSize: 12,
    fontWeight: '600',
  },
  primaryBtn: {
    marginTop: 6,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0ea5e9',
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 20,
    elevation: 4,
  },
  primaryBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
  },
  dividerWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
  },
  dividerLine: {
    flex: 1,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  dividerLabel: {
    marginHorizontal: 8,
    fontSize: 11,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  socialRow: {
    flexDirection: 'row',
    gap: 12,
  },
  socialBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    height: 44,
  },
  socialText: {
    fontSize: 14,
    fontWeight: '600',
  },
  googleIcon: {
    width: 20,
    height: 20,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  googleIconText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ea4335',
  },
  footer: {
    marginTop: 16,
  },
  footerText: {
    fontSize: 13,
    textAlign: 'center',
  },
  footerLink: {
    fontWeight: '700',
  },
  blob: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 999,
    opacity: 1,
  },
  blobTopRight: {
    top: -80,
    right: -80,
  },
  blobBottomLeft: {
    bottom: -80,
    left: -80,
  },
});

