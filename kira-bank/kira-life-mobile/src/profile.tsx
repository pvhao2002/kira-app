import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import React, {useEffect, useState} from 'react';
import {Linking, Pressable, Switch, View} from 'react-native';
import {router} from 'expo-router';
import {useDemo} from './store';
import {ApiError, useAuth} from './auth';
import {useT} from './i18n';
import {ThemeName, useTheme} from './theme';
import {
  Badge,
  Button,
  Card,
  Chips,
  Dialog,
  Empty,
  Field,
  go,
  Icon,
  Info,
  LangSwitch,
  Row,
  Screen,
  Section,
  T,
  useNotice
} from './ui';

export function DemoTools() {
  const {state, scenario} = useDemo();
  const {logout} = useAuth();
  const {colors: c} = useTheme();
  const [pending, setPending] = useState('');
  const [notifications, setNotifications] = useState(true);
  const {notify, dialog} = useNotice();
  const t = useT();
  const scenarios = [
    {
      name: 'reference-history',
      label: t('Mockup · Lịch sử & chi tiết'),
      description: t('Năm giao dịch và ba hồ sơ tra soát đúng mẫu.'),
      target: 'history'
    },
    {
      name: 'reference-account',
      label: t('Mockup · Thống kê tài khoản'),
      description: t('Kịch bản thống kê 180 triệu, độc lập với số dư demo mặc định.'),
      target: 'account-stats'
    },
    {
      name: 'reference-partial',
      label: t('Mockup · Kết quả một phần'),
      description: t('Một thêm mới, một bỏ qua, một cần xử lý.'),
      target: 'result-partial'
    },
    {
      name: 'reference-success',
      label: t('Mockup · Kết quả toàn bộ'),
      description: t('Hai bản ghi đã ghi nhận.'),
      target: 'result-success'
    },
    {
      name: 'reference-filter',
      label: t('Mockup · Bộ lọc'),
      description: t('SSI, nạp và thưởng, kỳ tháng 10/2024.'),
      target: 'filter'
    },
    {
      name: 'ready',
      label: t('Mặc định · Xung đột một phần'),
      description: t('Một giao dịch hợp lệ, một khoản thưởng cần đối chiếu.'),
      target: 'import'
    },
    {
      name: 'success',
      label: t('Xác nhận thành công toàn bộ'),
      description: t('Hai bản ghi hợp lệ, không có xung đột.'),
      target: 'import'
    },
    {
      name: 'empty',
      label: t('Lịch sử trống'),
      description: t('Thử màn trống trước khi nhập giao dịch.'),
      target: 'history'
    },
    {name: 'pending', label: t('AI đang chờ'), description: t('Thử chạy hoặc hủy công việc.'), target: 'queue'},
    {
      name: 'running',
      label: t('AI đang xử lý'),
      description: t('Thử trạng thái tải và mô phỏng hoàn tất.'),
      target: 'queue'
    },
    {
      name: 'failed',
      label: t('AI thất bại'),
      description: t('Thử thông báo lỗi và thao tác thử lại.'),
      target: 'queue'
    },
  ];
  return <Screen title={t('Cá nhân')}><Card tint style={{alignItems: 'center', paddingVertical: 28}}><View style={{
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#25425a',
    alignItems: 'center',
    justifyContent: 'center'
  }}><T size={26} bold color={c.primary}>MT</T></View><T size={24} bold>Nguyễn Minh Triết</T><T
    color={c.muted}>triet@example.com</T><Badge>{t('HỒ SƠ MINH HỌA')}</Badge></Card><Section
    title={t('Tùy chọn ứng dụng')}/><Card><Row><Icon name="language-outline"/><View style={{flex: 1}}><T
    bold>{t('Ngôn ngữ')}</T></View><LangSwitch/></Row><Row><Icon name="notifications-outline"/><View
    style={{flex: 1}}><T bold>{t('Thông báo mẫu')}</T><T size={12}
                                                         color={c.muted}>{t('Chỉ thay đổi công tắc giao diện')}</T></View><Switch
    accessibilityLabel={t('Thông báo mẫu')} value={notifications} onValueChange={setNotifications}
    trackColor={{false: c.elevated, true: '#235979'}} thumbColor={notifications ? c.primary : c.muted}/></Row><Button
    label={t('Bảo mật & quyền thiết bị')} kind="secondary"
    onPress={() => notify(t('Bản demo không kích hoạt Face ID, không yêu cầu camera hoặc kết nối tài khoản thật.'))}/><Button
    label={t('Kết nối đối tác')} kind="secondary"
    onPress={() => notify(t('Kết nối và đồng bộ đối tác nằm ngoài bản demo.'))}/></Card><Section
    title={t('Khám phá các kịch bản')}/><Info>{t('Chọn kịch bản sẽ thay thế dữ liệu demo hiện tại. Các thay đổi chỉ lưu trên thiết bị này.')}</Info>{scenarios.map(item =>
    <Card key={item.name}><Row><T bold style={{flex: 1}}>{item.label}</T>{state.scenario === item.name ?
      <Badge>{t('Đang chọn')}</Badge> : null}</Row><T size={12} color={c.muted}>{item.description}</T><Button
      label={t('Mở kịch bản')} kind="secondary" onPress={() => setPending(item.name)}/></Card>)}<Button
    label={t('Đặt lại dữ liệu mẫu')} kind="danger" onPress={() => setPending('reset')}/><Button label={t('Đăng xuất')}
                                                                                                kind="secondary"
                                                                                                onPress={logout}/><T
    size={11} color={c.muted} style={{textAlign: 'center'}}>KIRA LIFE MOBILE · GLACIER · V1 DEMO</T><Dialog
    visible={!!pending} title={t('Thay thế dữ liệu demo?')}
    message={t('Các tài khoản, bản nháp và báo cáo bạn đã thay đổi trong demo sẽ được đặt lại.')}
    confirmLabel={t('Đặt lại và tiếp tục')} onClose={() => setPending('')} onConfirm={() => {
    const selected = scenarios.find(s => s.name === pending);
    scenario(pending === 'reset' ? 'ready' : pending);
    setPending('');
    if (selected) go(selected.target, selected.target === 'account-stats' ? {id: 'ssi'} : {}); else router.replace('/');
  }}/>{dialog}</Screen>;
}

export function ProfileSettings() {
  const {session, updateProfile, changePassword} = useAuth();
  const t = useT();
  const {colors: c} = useTheme();
  const {notify, dialog} = useNotice();
  const [fullName, setFullName] = useState(session?.user.fullName || '');
  const [phone, setPhone] = useState(session?.user.phone || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [error, setError] = useState('');

  function message(e: unknown) {
    if (e instanceof ApiError && e.code === 'PROFILE_VERSION_CONFLICT') return t('Hồ sơ đã được cập nhật ở phiên khác. Vui lòng tải lại.');
    if (e instanceof ApiError && e.code === 'BAD_CREDENTIALS') return t('Email hoặc mật khẩu không đúng.');
    return t('Không thể cập nhật hồ sơ.');
  }

  async function saveProfile() {
    if (!session || !fullName.trim()) {
      setError(t('Họ và tên không được để trống.'));
      return;
    }
    setSavingProfile(true);
    setError('');
    try {
      await updateProfile({fullName: fullName.trim(), phone: phone.trim() || null, version: session.user.version});
      notify(t('Đã cập nhật hồ sơ.'));
    } catch (e) {
      setError(message(e));
    } finally {
      setSavingProfile(false);
    }
  }

  async function savePassword() {
    if (newPassword.length < 8) {
      setError(t('Mật khẩu mới phải có ít nhất 8 ký tự.'));
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(t('Mật khẩu xác nhận không khớp.'));
      return;
    }
    setSavingPassword(true);
    setError('');
    try {
      await changePassword({currentPassword, newPassword});
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      notify(t('Đã đổi mật khẩu.'));
    } catch (e) {
      setError(message(e));
    } finally {
      setSavingPassword(false);
    }
  }

  if (!session) return <Screen title={t('Chỉnh sửa hồ sơ')} back><Empty
    title={t('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.')}/></Screen>;
  return <Screen title={t('Chỉnh sửa hồ sơ')} subtitle={t('Cập nhật thông tin cá nhân và mật khẩu đăng nhập')} back>
    {error ? <Info tone="error">{error}</Info> : null}
    <Card tint><Section title={t('Thông tin cá nhân')}/><Field label={t('Họ và tên *')} value={fullName}
                                                               onChangeText={setFullName} maxLength={150}/><Field
      label={t('Số điện thoại')} value={phone} onChangeText={setPhone} keyboardType="phone-pad" maxLength={30}/><Button
      label={t('Lưu hồ sơ')} icon="checkmark-circle-outline" onPress={saveProfile} loading={savingProfile}/></Card>
    <Card><Section
      title={t('Đổi mật khẩu')}/><Info>{t('Mật khẩu mới cần tối thiểu 8 ký tự. Các phiên khác vẫn giữ nguyên cho đến khi hết hạn.')}</Info><Field
      label={t('Mật khẩu hiện tại *')} value={currentPassword} onChangeText={setCurrentPassword} secureTextEntry/><Field
      label={t('Mật khẩu mới *')} value={newPassword} onChangeText={setNewPassword} secureTextEntry/><Field
      label={t('Nhập lại mật khẩu mới *')} value={confirmPassword} onChangeText={setConfirmPassword}
      secureTextEntry/><Button label={t('Đổi mật khẩu')} kind="secondary" onPress={savePassword}
                               loading={savingPassword}
                               disabled={!currentPassword || !newPassword || !confirmPassword}/></Card>
    {dialog}
  </Screen>;
}

export function Profile() {
  const {colors: c, themeName, setTheme} = useTheme();
  const [notifications, setNotifications] = useState(true);
  const [openBanking, setOpenBanking] = useState(true);
  const {notify, dialog} = useNotice();
  const t = useT();
  const {
    session,
    logout,
    biometric,
    biometricEnabled,
    setBiometricEnabled,
    lockWhenBackground,
    setLockWhenBackground
  } = useAuth();
  const initials = (session?.user.fullName || 'K').split(/\s+/).filter(Boolean).slice(-2).map(part => part[0]).join('').toUpperCase();
  const roleLabel = session?.user.roles?.includes('ADMIN') ? t('Quản trị viên') : t('Tài khoản đã xác thực');
  const biometricDetail = biometric === 'none' ? t('Thiết bị chưa có sinh trắc học khả dụng') : biometricEnabled ? (biometric === 'face' ? t('Face ID đang được bật') : t('Sinh trắc học đang được bật')) : t('Sinh trắc học đang tắt');
  useEffect(() => {
    Promise.all([AsyncStorage.getItem('kira-life-notifications'), AsyncStorage.getItem('kira-life-open-banking')]).then(([notificationValue, openBankingValue]) => {
      if (notificationValue != null) setNotifications(notificationValue === 'true');
      if (openBankingValue != null) setOpenBanking(openBankingValue === 'true');
    }).catch(() => {
    });
  }, []);
  const setBoolean = (key: string, setter: React.Dispatch<React.SetStateAction<boolean>>) => (value: boolean) => {
    setter(value);
    AsyncStorage.setItem(key, String(value)).catch(() => {
    });
  };
  const setOpenBankingPreference = (value: boolean) => {
    setOpenBanking(value);
    AsyncStorage.setItem('kira-life-open-banking', String(value)).catch(() => {
    });
  };
  const openDeviceSettings = () => {
    Linking.openSettings().catch(() => notify(t('Không thể mở cài đặt thiết bị trên môi trường này.')));
  };
  const requestPhotoAccess = async () => {
    try {
      const [camera, library] = await Promise.all([ImagePicker.requestCameraPermissionsAsync(), ImagePicker.requestMediaLibraryPermissionsAsync()]);
      notify(camera.granted && library.granted ? t('Đã cấp quyền camera và ảnh cho chức năng nhập chứng từ.') : t('Quyền camera hoặc ảnh chưa được cấp. Bạn có thể bật lại trong cài đặt thiết bị.'));
    } catch {
      notify(t('Không thể kiểm tra quyền camera và ảnh trên môi trường này.'));
    }
  };
  const setting = (icon: React.ComponentProps<typeof Icon>['name'], title: string, detail: string, accessory?: React.ReactNode, onPress: () => void = () => notify(t('{{title}}: chức năng đang được mô phỏng trên thiết bị.', {title}))) =>
    <Pressable accessibilityRole="button" accessibilityLabel={title} onPress={onPress}
               style={{flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 72}}><View style={{
      width: 42,
      height: 42,
      borderRadius: 22,
      backgroundColor: c.elevated,
      alignItems: 'center',
      justifyContent: 'center'
    }}><Icon name={icon}/></View><View style={{flex: 1}}><T size={15} bold>{title}</T><T size={11} color={c.muted}
                                                                                         style={{marginTop: 2}}>{detail}</T></View>{accessory ||
      <Icon name="chevron-forward" size={16} color={c.muted}/>}</Pressable>;
  return <Screen title={t('Cá nhân')}>
    <Card tint style={{padding: 22, gap: 22}}><Row><View style={{
      width: 66,
      height: 66,
      borderRadius: 33,
      backgroundColor: c.primary + '22',
      borderWidth: 2,
      borderColor: c.primary,
      alignItems: 'center',
      justifyContent: 'center'
    }}><T size={23} bold color={c.primary}>{initials}</T></View><View style={{flex: 1, gap: 4}}><T size={21}
                                                                                                   bold>{session?.user.fullName}</T><T
      size={12} color={c.muted}>{session?.user.email}</T><Badge>{roleLabel}</Badge><T size={10} color={c.muted}>ID
      #{session?.user.id}</T></View></Row><Card style={{padding: 12}}><Row><Icon name="shield-checkmark-outline"/><View
      style={{flex: 1}}><T size={12} bold>{t('Phiên đăng nhập an toàn')}</T><T size={10}
                                                                               color={c.muted}>{t('Phiên đăng nhập được lưu bảo mật trên thiết bị này.')}</T></View><Icon
      name="checkmark-circle-outline" size={18}/></Row></Card></Card>
    <Section
      title={t('Cấu hình bảo mật & nền tảng')}/><Card>{setting('id-card-outline', t('Xác thực sinh trắc học'), biometricDetail,
    <Switch accessibilityLabel={t('Xác thực sinh trắc học')} value={biometricEnabled && biometric !== 'none'}
            onValueChange={setBiometricEnabled} disabled={biometric === 'none'}
            trackColor={{false: c.elevated, true: c.primary}} thumbColor={c.surface}/>, () => {
    })}{setting('timer-outline', t('Khóa khi vào nền'), t('Tự động khóa sau thời gian chờ'), <Switch
    accessibilityLabel={t('Khóa khi vào nền')} value={lockWhenBackground} onValueChange={setLockWhenBackground}
    trackColor={{false: c.elevated, true: c.primary}} thumbColor={c.surface}/>, () => {
  })}{setting('phone-portrait-outline', t('Thiết bị đã cấp quyền'), t('Mở cài đặt hệ điều hành để xem và thay đổi quyền.'), undefined, openDeviceSettings)}</Card>
    <Button label={t('Chỉnh sửa hồ sơ')} kind="secondary" icon="person-circle-outline"
            onPress={() => go('profile-settings')}/>
    <Section
      title={t('Tích hợp hệ thống & đồng bộ')}/><Card>{setting('qr-code-outline', t('Liên kết Open Banking / VietQR'), t('Tùy chọn nhận diện dữ liệu liên kết; chưa tự động chuyển tiền.'),
    <Switch accessibilityLabel={t('Liên kết Open Banking / VietQR')} value={openBanking}
            onValueChange={setOpenBankingPreference} trackColor={{false: c.elevated, true: c.primary}}
            thumbColor={c.surface}/>, () => {
    })}{setting('analytics-outline', t('Danh mục đầu tư liên kết'), t('Mở danh sách tài khoản đầu tư đang quản lý.'), undefined, () => router.replace('/investment'))}{setting('camera-outline', t('Quyền thiết bị (Camera & Ảnh)'), t('Chọn hoặc chụp chứng từ giao dịch để AI nhận diện.'), undefined, requestPhotoAccess)}{setting('heart-outline', t('Sức khỏe & Apple Health'), t('Theo dõi BMI, năng lượng, nhật ký và kế hoạch tuần.'), undefined, () => go('health'))}{setting('home-outline', t('Chỗ ở & Tin trọ'), t('Theo dõi giá thuê, chi phí, khoảng cách và đánh giá tin trọ.'), undefined, () => go('lodging'))}</Card>
    {session?.user.roles?.includes('ADMIN') ? <><Section title={t('Quản trị hệ thống')}/><Button
      label={t('Quản lý hồ sơ tra soát')} kind="secondary" icon="shield-checkmark-outline"
      onPress={() => go('admin-investment-reports')}/><Button label={t('Theo dõi queue AI toàn hệ thống')}
                                                              kind="secondary" icon="pulse-outline"
                                                              onPress={() => go('admin-ai-queue')}/><Button
      label={t('Quản lý Cloudflare AI / R2')} kind="secondary" icon="cloud-outline"
      onPress={() => go('admin-cloudflare')}/></> : null}
    <Section
      title={t('Tùy chọn ứng dụng')}/><Card>{setting('globe-outline', t('Ngôn ngữ hiển thị'), t('Giao diện ngôn ngữ chính'),
    <LangSwitch/>, () => {
    })}{setting('notifications-outline', t('Thông báo & Báo động thẻ'), t('Lưu tùy chọn hiển thị cảnh báo trên thiết bị.'),
    <Switch accessibilityLabel={t('Thông báo & Báo động thẻ')} value={notifications}
            onValueChange={setBoolean('kira-life-notifications', setNotifications)}
            trackColor={{false: c.elevated, true: c.primary}} thumbColor={c.surface}/>, () => {
    })}{setting('lock-closed-outline', t('Password Vault'), t('Quản lý thông tin đăng nhập được mã hóa, chỉ mở khóa tạm thời.'), undefined, () => go('password-vault'))}{setting('calendar-outline', t('Lịch dạy gia sư'), t('Quản lý học viên, lịch lặp và học phí dự kiến.'), undefined, () => go('tutoring'))}{setting('headset-outline', t('Hướng dẫn & Trợ giúp kỹ thuật'), t('Hướng dẫn theo dõi thông báo, AI và dữ liệu đối soát.'), undefined, () => notify(t('Trợ giúp: hãy mở mục Thông báo để theo dõi trạng thái xử lý, hoặc vào Hàng đợi AI để kiểm tra chứng từ.')))}</Card>
    <Section title={t('Màu sắc giao diện')}/><Card><T size={12} bold>{t('Chọn màu nhấn cho ứng dụng')}</T><T size={11}
                                                                                                             color={c.muted}>{t('Lựa chọn được lưu trên thiết bị này và áp dụng ngay.')}</T><Chips
    value={themeName} onChange={value => setTheme(value as ThemeName)}
    values={[{value: 'ice', label: t('Băng giá')}, {value: 'violet', label: t('Tím cực quang')}, {
      value: 'emerald',
      label: t('Ngọc lục bảo')
    }, {value: 'amber', label: t('Hổ phách')}]}/></Card>
    <Button label={t('Đăng xuất tài khoản & Xóa phiên làm việc')} kind="danger" icon="log-out-outline"
            onPress={logout}/><T size={10} color={c.muted}
                                 style={{textAlign: 'center'}}>• {t('Kira Life · Phiên đăng nhập hiện tại')}</T>{dialog}
  </Screen>;
}
