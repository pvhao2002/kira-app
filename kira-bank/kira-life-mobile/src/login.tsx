import React, {useEffect, useRef, useState} from 'react';
import {KeyboardAvoidingView, Platform, Pressable, ScrollView, View} from 'react-native';
import {authErrorCode, useAuth} from './auth';
import {useT} from './i18n';
import {useTheme} from './theme';
import {Button, Card, Field, Icon, Info, T} from './ui';

const errorKey: Record<string, string> = {
  BAD_CREDENTIALS: 'Email hoặc mật khẩu không đúng.',
  LOGIN_RATE_LIMITED: 'Bạn đã thử đăng nhập quá nhiều lần. Vui lòng thử lại sau vài phút.',
  NETWORK: 'Không kết nối được máy chủ. Kiểm tra kết nối mạng và thử lại.',
};

function Brand() {
  const t = useT();
  const {colors: c} = useTheme();
  return <View style={{alignItems: 'center', gap: 8}}>
    <View style={{
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: c.primary + '22',
      alignItems: 'center',
      justifyContent: 'center'
    }}><Icon name="business-outline" size={30}/></View>
    <T size={12} color={c.primary} style={{letterSpacing: 0.6}}>KIRA BANK</T>
    <T size={22} bold>{t('Đăng nhập Kira Life')}</T>
  </View>;
}

function BiometricLock({onUseManual}: { onUseManual: () => void }) {
  const {session, biometric, unlockWithBiometrics} = useAuth();
  const t = useT();
  const {colors: c} = useTheme();
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);
  const attempted = useRef(false);

  async function attempt() {
    setChecking(true);
    setError('');
    const success = await unlockWithBiometrics();
    setChecking(false);
    if (!success) setError(t('Không thể xác thực. Hãy thử lại hoặc đăng nhập bằng tài khoản.'));
  }

  useEffect(() => {
    if (!attempted.current) {
      attempted.current = true;
      attempt();
    }
  }, []);

  return <KeyboardAvoidingView style={{flex: 1, backgroundColor: c.bg}}>
    <ScrollView contentContainerStyle={{flexGrow: 1, justifyContent: 'center', padding: 24, gap: 24}}>
      <Brand/>
      <Card style={{padding: 24, alignItems: 'center', gap: 14}}>
        <View style={{
          width: 64,
          height: 64,
          borderRadius: 32,
          backgroundColor: c.elevated,
          alignItems: 'center',
          justifyContent: 'center'
        }}><Icon name="finger-print" size={30}/></View>
        <T size={16} bold style={{textAlign: 'center'}}>{t('Chào {{name}}', {name: session?.user.fullName || ''})}</T>
        <T size={12} color={c.muted}
           style={{textAlign: 'center'}}>{biometric === 'face' ? t('Xác thực bằng Face ID để tiếp tục') : t('Xác thực sinh trắc học để tiếp tục')}</T>
        {error ? <Info tone="error">{error}</Info> : null}
        <Button label={biometric === 'face' ? t('Đăng nhập bằng Face ID') : t('Đăng nhập bằng sinh trắc học')}
                icon="finger-print" onPress={attempt} loading={checking}/>
        <Pressable accessibilityRole="button" onPress={onUseManual} style={{padding: 8}}><T size={12}
                                                                                            color={c.primary}>{t('Đăng nhập bằng tài khoản khác')}</T></Pressable>
      </Card>
    </ScrollView>
  </KeyboardAvoidingView>;
}

function ManualLogin() {
  const {login} = useAuth();
  const t = useT();
  const {colors: c} = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (!email.trim() || !password) {
      setError(t('Nhập email và mật khẩu.'));
      return;
    }
    setError('');
    setLoading(true);
    try {
      await login(email.trim(), password);
    } catch (e) {
      setError(t(errorKey[authErrorCode(e)] || errorKey.NETWORK));
    } finally {
      setLoading(false);
    }
  }

  return <KeyboardAvoidingView style={{flex: 1, backgroundColor: c.bg}}
                               behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <ScrollView keyboardShouldPersistTaps="handled"
                contentContainerStyle={{flexGrow: 1, justifyContent: 'center', padding: 24, gap: 24}}>
      <Brand/>
      <Card style={{padding: 20, gap: 16}}>
        <Field label={t('Email')} value={email} onChangeText={setEmail} autoCapitalize="none"
               keyboardType="email-address" placeholder="name@example.com"/>
        <Field label={t('Mật khẩu')} value={password} onChangeText={setPassword} secureTextEntry={!showPassword}
               placeholder="••••••••" accessory={<Pressable accessibilityRole="button"
                                                            accessibilityLabel={showPassword ? t('Ẩn mật khẩu') : t('Hiện mật khẩu')}
                                                            hitSlop={8} onPress={() => setShowPassword(v => !v)}
                                                            style={{padding: 10}}><Icon
          name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={18} color={c.muted}/></Pressable>}/>
        {error ? <Info tone="error">{error}</Info> : null}
        <Button label={t('Đăng nhập')} onPress={submit} loading={loading}/>
      </Card>
    </ScrollView>
  </KeyboardAvoidingView>;
}

export function Login() {
  const {session, unlocked, biometric} = useAuth();
  const [manual, setManual] = useState(false);
  if (session && !unlocked && biometric !== 'none' && !manual) return <BiometricLock
    onUseManual={() => setManual(true)}/>;
  return <ManualLogin/>;
}
