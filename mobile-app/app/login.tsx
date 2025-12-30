import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as LocalAuthentication from 'expo-local-authentication';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';
import { validateEmail, validateLoginForm } from '@/types/validation';
import { LoginFormData } from '@/types';
import { useAuth } from '@/contexts/AuthContext';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricType, setBiometricType] = useState<string>('');
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { login, loginWithBiometric, isLoading } = useAuth();

  // Check biometric availability on component mount
  useEffect(() => {
    checkBiometricAvailability();
  }, []);

  const checkBiometricAvailability = async () => {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      const supportedTypes = await LocalAuthentication.supportedAuthenticationTypesAsync();
      
      if (hasHardware && isEnrolled) {
        setBiometricAvailable(true);
        
        // Determine biometric type for display
        if (supportedTypes.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
          setBiometricType('Face ID');
        } else if (supportedTypes.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
          setBiometricType('Touch ID');
        } else {
          setBiometricType('Sinh trắc học');
        }
      }
    } catch (error) {
      console.log('Error checking biometric availability:', error);
    }
  };

  const handleBiometricAuth = async () => {
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Xác thực để đăng nhập',
        cancelLabel: 'Hủy',
        fallbackLabel: 'Sử dụng mật khẩu',
        disableDeviceFallback: false,
      });

      if (result.success) {
        // Attempt biometric login through auth context
        const success = await loginWithBiometric();
        if (success) {
          router.replace('/(tabs)');
        } else {
          Alert.alert('Lỗi', 'Không thể đăng nhập bằng sinh trắc học. Vui lòng sử dụng email và mật khẩu.');
        }
      } else if (result.error === 'user_cancel') {
        // User cancelled, do nothing
      } else if (result.error === 'user_fallback') {
        // User chose to use password fallback
        Alert.alert('Thông báo', 'Vui lòng sử dụng email và mật khẩu để đăng nhập');
      } else {
        Alert.alert('Lỗi xác thực', 'Không thể xác thực sinh trắc học. Vui lòng sử dụng email và mật khẩu.');
      }
    } catch (error) {
      Alert.alert('Lỗi', 'Có lỗi xảy ra trong quá trình xác thực sinh trắc học');
    }
  };

  // Real-time email validation
  useEffect(() => {
    if (email && !validateEmail(email)) {
      setEmailError('Định dạng email không hợp lệ');
    } else {
      setEmailError('');
    }
  }, [email]);

  // Real-time password validation
  useEffect(() => {
    if (password && password.length < 6) {
      setPasswordError('Mật khẩu phải có ít nhất 6 ký tự');
    } else {
      setPasswordError('');
    }
  }, [password]);

  const handleLogin = async () => {
    // Validate form data
    const formData: LoginFormData = { email, password };
    const validation = validateLoginForm(formData);

    if (!validation.isValid) {
      Alert.alert('Lỗi xác thực', validation.errors.join('\n'));
      return;
    }

    try {
      const success = await login(email, password);
      if (success) {
        router.replace('/(tabs)');
      } else {
        Alert.alert('Lỗi đăng nhập', 'Email hoặc mật khẩu không chính xác');
      }
    } catch (error) {
      Alert.alert('Lỗi đăng nhập', 'Có lỗi xảy ra trong quá trình đăng nhập. Vui lòng thử lại.');
    }
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      flex: 1,
      justifyContent: 'center',
      paddingHorizontal: 24,
    },
    title: {
      fontSize: 32,
      fontWeight: 'bold',
      color: colors.text,
      textAlign: 'center',
      marginBottom: 8,
    },
    subtitle: {
      fontSize: 16,
      color: colors.text,
      textAlign: 'center',
      marginBottom: 48,
      opacity: 0.7,
    },
    inputContainer: {
      marginBottom: 16,
    },
    label: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 8,
    },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 12,
      fontSize: 16,
      color: colors.text,
      backgroundColor: colors.card,
    },
    inputError: {
      borderColor: '#FF6B6B',
    },
    errorText: {
      color: '#FF6B6B',
      fontSize: 14,
      marginTop: 4,
      marginLeft: 4,
    },
    passwordContainer: {
      position: 'relative',
    },
    passwordToggle: {
      position: 'absolute',
      right: 16,
      top: 12,
      padding: 4,
    },
    passwordToggleText: {
      color: colors.tint,
      fontSize: 14,
      fontWeight: '600',
    },
    button: {
      backgroundColor: colors.tint,
      borderRadius: 12,
      paddingVertical: 16,
      marginTop: 24,
    },
    buttonDisabled: {
      opacity: 0.6,
    },
    buttonText: {
      color: '#FFFFFF',
      fontSize: 18,
      fontWeight: '600',
      textAlign: 'center',
    },
    forgotPassword: {
      marginTop: 16,
      alignItems: 'center',
    },
    forgotPasswordText: {
      color: colors.tint,
      fontSize: 16,
    },
    biometricButton: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.tint,
      borderRadius: 12,
      paddingVertical: 16,
      marginTop: 16,
    },
    biometricButtonText: {
      color: colors.tint,
      fontSize: 18,
      fontWeight: '600',
      textAlign: 'center',
    },
    divider: {
      flexDirection: 'row',
      alignItems: 'center',
      marginVertical: 24,
    },
    dividerLine: {
      flex: 1,
      height: 1,
      backgroundColor: colors.border,
    },
    dividerText: {
      marginHorizontal: 16,
      color: colors.text,
      opacity: 0.6,
      fontSize: 14,
    },
  });

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        style={styles.container} 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.content}>
          <Text style={styles.title}>Chào mừng</Text>
          <Text style={styles.subtitle}>Đăng nhập vào tài khoản của bạn</Text>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={[styles.input, emailError ? styles.inputError : null]}
              value={email}
              onChangeText={setEmail}
              placeholder="Nhập email của bạn"
              placeholderTextColor={colors.text + '80'}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
            {emailError ? <Text style={styles.errorText}>{emailError}</Text> : null}
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Mật khẩu</Text>
            <View style={styles.passwordContainer}>
              <TextInput
                style={[styles.input, passwordError ? styles.inputError : null]}
                value={password}
                onChangeText={setPassword}
                placeholder="Nhập mật khẩu của bạn"
                placeholderTextColor={colors.text + '80'}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity
                style={styles.passwordToggle}
                onPress={() => setShowPassword(!showPassword)}
              >
                <Text style={styles.passwordToggleText}>
                  {showPassword ? 'Ẩn' : 'Hiện'}
                </Text>
              </TouchableOpacity>
            </View>
            {passwordError ? <Text style={styles.errorText}>{passwordError}</Text> : null}
          </View>

          <TouchableOpacity
            style={[styles.button, (isLoading || !!emailError || !!passwordError || !email || !password) && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={isLoading || !!emailError || !!passwordError || !email || !password}
          >
            <Text style={styles.buttonText}>
              {isLoading ? 'Đang đăng nhập...' : 'Đăng nhập'}
            </Text>
          </TouchableOpacity>

          {biometricAvailable && (
            <>
              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>hoặc</Text>
                <View style={styles.dividerLine} />
              </View>

              <TouchableOpacity
                style={styles.biometricButton}
                onPress={handleBiometricAuth}
                disabled={isLoading}
              >
                <Text style={styles.biometricButtonText}>
                  Đăng nhập bằng {biometricType}
                </Text>
              </TouchableOpacity>
            </>
          )}

          <TouchableOpacity style={styles.forgotPassword}>
            <Text style={styles.forgotPasswordText}>Quên mật khẩu?</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}