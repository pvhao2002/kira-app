import React, {useCallback, useEffect, useRef, useState} from 'react';
import {ActivityIndicator, Pressable, View} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import {useFocusEffect} from 'expo-router';
import {ApiError} from './auth';
import {useT} from './i18n';
import {useTheme} from './theme';
import {
  useVaultApi,
  VaultAccount,
  VaultAccountInput,
  vaultErrorMessage,
  VaultModule,
  VaultModuleInput,
  VaultSecret
} from './vaultApi';
import {Button, Card, Dialog, Empty, Field, Icon, Info, Row, Screen, Section, T, useNotice} from './ui';

const emptyModule: VaultModuleInput = {name: '', websiteUrl: '', description: ''};
const emptyAccount: VaultAccountInput = {displayName: '', username: '', password: '', loginUrl: '', note: ''};

function formatExpiry(value: string | null) {
  return value ? new Date(value).toLocaleTimeString() : '';
}

function SecretLine({label, value, onCopy}: { label: string; value: string | null; onCopy: () => void }) {
  const {colors: c} = useTheme();
  const t = useT();
  return <Row style={{alignItems: 'flex-start'}}><T size={11} color={c.muted}
                                                    style={{flex: 1}}>{label}: {value || '—'}</T>{value ?
    <Pressable accessibilityRole="button" accessibilityLabel={`${t('Copy')} ${label}`} onPress={onCopy}
               style={{padding: 5}}><Icon name="copy-outline" color={c.primary} size={16}/></Pressable> : null}</Row>;
}

export function PasswordVault() {
  const api = useVaultApi();
  const t = useT();
  const {colors: c} = useTheme();
  const {notify, dialog} = useNotice();
  const tokenRef = useRef('');
  const [token, setToken] = useState('');
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [unlockPassword, setUnlockPassword] = useState('');
  const [unlocking, setUnlocking] = useState(false);
  const [modules, setModules] = useState<VaultModule[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [accounts, setAccounts] = useState<VaultAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [accountsLoading, setAccountsLoading] = useState(false);
  const [error, setError] = useState('');
  const [moduleSearch, setModuleSearch] = useState('');
  const [accountSearch, setAccountSearch] = useState('');
  const [moduleForm, setModuleForm] = useState<VaultModuleInput>(emptyModule);
  const [moduleEditor, setModuleEditor] = useState(false);
  const [accountForm, setAccountForm] = useState<VaultAccountInput>(emptyAccount);
  const [accountEditor, setAccountEditor] = useState(false);
  const [editingModule, setEditingModule] = useState<VaultModule | null>(null);
  const [editingAccount, setEditingAccount] = useState<VaultAccount | null>(null);
  const [busy, setBusy] = useState('');
  const [revealed, setRevealed] = useState<{ account: VaultAccount; secret: VaultSecret } | null>(null);
  const [deleteModule, setDeleteModule] = useState<VaultModule | null>(null);
  const [deleteAccount, setDeleteAccount] = useState<VaultAccount | null>(null);

  const clearToken = useCallback(() => {
    tokenRef.current = '';
    setToken('');
    setExpiresAt(null);
    setRevealed(null);
    setEditingAccount(null);
    setAccountEditor(false);
  }, []);
  const handleError = useCallback((e: unknown) => {
    if (e instanceof ApiError && e.code === 'VAULT_LOCKED') clearToken();
    const message = t(vaultErrorMessage(e));
    setError(message);
    notify(message);
  }, [clearToken, notify, t]);
  const loadModules = useCallback(() => {
    setLoading(true);
    api.listModules(moduleSearch).then(values => {
      setModules(values);
      setSelectedId(current => current && values.some(value => value.id === current) ? current : values[0]?.id ?? null);
      setError('');
    }).catch(handleError).finally(() => setLoading(false));
  }, [handleError, moduleSearch]);
  useFocusEffect(useCallback(() => {
    loadModules();
  }, [loadModules]));
  useEffect(() => {
    if (!selectedId) {
      setAccounts([]);
      return;
    }
    setAccountsLoading(true);
    api.listAccounts(selectedId, accountSearch).then(setAccounts).catch(handleError).finally(() => setAccountsLoading(false));
  }, [selectedId, accountSearch, handleError]);
  useEffect(() => () => {
    const current = tokenRef.current;
    if (current) api.lock(current).catch(() => {
    });
  }, []);
  useEffect(() => {
    if (!expiresAt) return;
    const delay = Math.max(0, new Date(expiresAt).getTime() - Date.now());
    const timer = setTimeout(() => {
      clearToken();
      notify(t('Phiên mở khóa Password Vault đã hết hạn.'));
    }, delay);
    return () => clearTimeout(timer);
  }, [clearToken, expiresAt, notify, t]);

  async function unlock() {
    if (!unlockPassword) return;
    setUnlocking(true);
    setError('');
    try {
      const result = await api.unlock(unlockPassword);
      tokenRef.current = result.unlockToken;
      setToken(result.unlockToken);
      setExpiresAt(result.expiresAt);
      setUnlockPassword('');
      notify(t('Password Vault đã được mở khóa tạm thời.'));
    } catch (e) {
      handleError(e);
    } finally {
      setUnlocking(false);
    }
  }

  async function lock() {
    const current = tokenRef.current;
    if (current) await api.lock(current).catch(() => {
    });
    clearToken();
    notify(t('Password Vault đã được khóa.'));
  }

  function selectModule(value: VaultModule) {
    setSelectedId(value.id);
    setAccountSearch('');
    setRevealed(null);
    setAccountEditor(false);
  }

  function openNewModule() {
    setEditingModule(null);
    setModuleForm({...emptyModule});
    setModuleEditor(true);
  }

  function openEditModule(value: VaultModule) {
    setEditingModule(value);
    setModuleForm({name: value.name, websiteUrl: value.websiteUrl || '', description: value.description || ''});
    setModuleEditor(true);
  }

  async function saveModule() {
    if (!moduleForm.name?.trim()) {
      notify(t('Tên nhóm không được để trống.'));
      return;
    }
    setBusy('module');
    try {
      const saved = editingModule ? await api.updateModule(editingModule.id, moduleForm, editingModule.version) : await api.createModule(moduleForm);
      setModules(previous => editingModule ? previous.map(value => value.id === saved.id ? saved : value) : [...previous, saved].sort((a, b) => a.name.localeCompare(b.name)));
      setSelectedId(saved.id);
      setModuleEditor(false);
      notify(t(editingModule ? 'Đã cập nhật nhóm Password Vault.' : 'Đã tạo nhóm Password Vault.'));
    } catch (e) {
      handleError(e);
    } finally {
      setBusy('');
    }
  }

  async function removeModule() {
    if (!deleteModule) return;
    setBusy('delete-module');
    try {
      await api.deleteModule(deleteModule.id, deleteModule.version);
      setDeleteModule(null);
      loadModules();
      notify(t('Đã xóa nhóm Password Vault.'));
    } catch (e) {
      handleError(e);
    } finally {
      setBusy('');
    }
  }

  function openNewAccount() {
    if (!token) {
      notify(t('Hãy mở khóa Password Vault trước khi quản lý tài khoản.'));
      return;
    }
    setEditingAccount(null);
    setAccountForm({...emptyAccount});
    setAccountEditor(true);
    setRevealed(null);
  }

  async function openEditAccount(value: VaultAccount) {
    if (!token) {
      notify(t('Hãy mở khóa Password Vault trước khi xem dữ liệu bí mật.'));
      return;
    }
    setBusy(`edit-${value.id}`);
    setError('');
    try {
      const secret = await api.reveal(value.id, token);
      setEditingAccount(value);
      setAccountForm({
        displayName: value.displayName,
        username: secret.username || '',
        password: secret.password || '',
        loginUrl: secret.loginUrl || '',
        note: secret.note || '',
        version: value.version
      });
      setAccountEditor(true);
      setRevealed(null);
    } catch (e) {
      handleError(e);
    } finally {
      setBusy('');
    }
  }

  async function saveAccount() {
    if (!selectedId || !accountForm.displayName?.trim() || !accountForm.password || !token) {
      notify(t('Tên hiển thị, mật khẩu và nhóm là bắt buộc.'));
      return;
    }
    setBusy('account');
    try {
      const saved = editingAccount ? await api.updateAccount(editingAccount.id, accountForm, editingAccount.version, token) : await api.createAccount(selectedId, accountForm);
      setAccounts(previous => editingAccount ? previous.map(value => value.id === saved.id ? saved : value) : [...previous, saved].sort((a, b) => a.displayName.localeCompare(b.displayName)));
      setModules(previous => previous.map(value => value.id === selectedId ? {
        ...value,
        accountCount: editingAccount ? value.accountCount : value.accountCount + 1
      } : value));
      setAccountEditor(false);
      setEditingAccount(null);
      setAccountForm({...emptyAccount});
      notify(t(editingAccount ? 'Đã cập nhật tài khoản Password Vault.' : 'Đã tạo tài khoản Password Vault.'));
    } catch (e) {
      handleError(e);
    } finally {
      setBusy('');
    }
  }

  async function reveal(value: VaultAccount) {
    if (!token) {
      notify(t('Hãy mở khóa Password Vault trước khi xem dữ liệu bí mật.'));
      return;
    }
    setBusy(`reveal-${value.id}`);
    try {
      setRevealed({account: value, secret: await api.reveal(value.id, token)});
    } catch (e) {
      handleError(e);
    } finally {
      setBusy('');
    }
  }

  async function copySecret(account: VaultAccount, field: 'USERNAME' | 'PASSWORD' | 'LOGIN_URL' | 'NOTE') {
    if (!token) {
      notify(t('Hãy mở khóa Password Vault trước khi copy dữ liệu bí mật.'));
      return;
    }
    setBusy(`copy-${account.id}-${field}`);
    try {
      const response = await api.copy(account.id, token, field);
      if (response.value != null) {
        await Clipboard.setStringAsync(response.value);
        notify(t('Đã copy secret vào clipboard.'));
      }
    } catch (e) {
      handleError(e);
    } finally {
      setBusy('');
    }
  }

  async function removeAccount() {
    if (!deleteAccount) return;
    setBusy(`delete-${deleteAccount.id}`);
    try {
      await api.deleteAccount(deleteAccount.id, deleteAccount.version);
      setAccounts(previous => previous.filter(value => value.id !== deleteAccount.id));
      setModules(previous => previous.map(value => value.id === selectedId ? {
        ...value,
        accountCount: Math.max(0, value.accountCount - 1)
      } : value));
      setDeleteAccount(null);
      if (revealed?.account.id === deleteAccount.id) setRevealed(null);
      notify(t('Đã xóa tài khoản Password Vault.'));
    } catch (e) {
      handleError(e);
    } finally {
      setBusy('');
    }
  }

  const selectedModule = modules.find(value => value.id === selectedId) || null;
  return <Screen title={t('Password Vault')} subtitle={t('Lưu thông tin đăng nhập bằng mã hóa và mở khóa tạm thời')}>
    <Row><View style={{flex: 1}}><T size={22} bold>{t('Kho mật khẩu cá nhân')}</T><T size={11}
                                                                                     color={c.muted}>{t('Secret không xuất hiện trong danh sách; mọi lần xem và copy được ghi audit ở backend.')}</T></View><Button
      label={token ? t('Khóa') : t('Mở khóa Vault')} kind={token ? 'danger' : 'primary'}
      icon={token ? 'lock-closed-outline' : 'lock-open-outline'} onPress={token ? lock : unlock}
      disabled={!token && !unlockPassword}/></Row>
    {token ? <Info
        tone="success">{t('Đã mở khóa đến')} {formatExpiry(expiresAt)}. {t('Token chỉ giữ trong bộ nhớ phiên hiện tại và tự hủy khi rời màn hình.')}</Info> :
      <Card tint><Section
        title={t('Mở khóa tạm thời')}/><Info>{t('Dùng mật khẩu đăng nhập hiện tại. Password Vault tự khóa sau 5 phút hoặc khi bạn rời màn hình.')}</Info><Field
        label={t('Mật khẩu đăng nhập *')} value={unlockPassword} onChangeText={setUnlockPassword}
        secureTextEntry/><Button label={t('Mở khóa Password Vault')} icon="lock-open-outline" onPress={unlock}
                                 loading={unlocking} disabled={!unlockPassword}/></Card>}
    {error ? <Info tone="error">{error}</Info> : null}
    <Section title={t('Nhóm lưu trữ')} action={t('Thêm nhóm')} onPress={openNewModule}/><Card><Row><Field
    label={t('Tìm nhóm')} value={moduleSearch} onChangeText={setModuleSearch} placeholder={t('Tên hoặc website')}
    style={{flex: 1}}/><Button label={t('Tải lại')} kind="secondary" icon="refresh-outline"
                               onPress={loadModules}/></Row>{loading ?
    <ActivityIndicator color={c.primary}/> : modules.length ? modules.map(value => <Pressable key={value.id}
                                                                                              accessibilityRole="button"
                                                                                              accessibilityState={{selected: value.id === selectedId}}
                                                                                              onPress={() => selectModule(value)}><Row
        style={{minHeight: 56, paddingVertical: 5, borderBottomWidth: 1, borderColor: c.border}}><View style={{
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: value.id === selectedId ? c.primary + '22' : c.elevated,
        alignItems: 'center',
        justifyContent: 'center'
      }}><Icon name="folder-open-outline" color={value.id === selectedId ? c.primary : c.muted} size={18}/></View><View
        style={{flex: 1}}><T size={13} bold={value.id === selectedId}>{value.name}</T><T size={10}
                                                                                         color={c.muted}>{value.accountCount} {t('tài khoản')}{value.websiteUrl ? ` · ${value.websiteUrl}` : ''}</T></View><Pressable
        accessibilityRole="button" accessibilityLabel={t('Sửa')} onPress={() => openEditModule(value)}
        style={{padding: 8}}><Icon name="create-outline" color={c.primary} size={17}/></Pressable><Pressable
        accessibilityRole="button" accessibilityLabel={t('Xóa')} onPress={() => setDeleteModule(value)}
        style={{padding: 8}}><Icon name="trash-outline" color={c.error} size={17}/></Pressable></Row></Pressable>) :
      <Empty title={t('Chưa có nhóm Password Vault')}
             description={t('Tạo nhóm đầu tiên để phân loại tài khoản đăng nhập.')} action={t('Thêm nhóm')}
             onPress={openNewModule}/>}</Card>
    {moduleEditor ?
      <Card tint><Section title={t(editingModule ? 'Chỉnh sửa nhóm' : 'Thêm nhóm')}/><Field label={t('Tên nhóm *')}
                                                                                            value={moduleForm.name}
                                                                                            onChangeText={value => setModuleForm(previous => ({
                                                                                              ...previous,
                                                                                              name: value
                                                                                            }))}/><Field
        label={t('Website')} value={moduleForm.websiteUrl || ''}
        onChangeText={value => setModuleForm(previous => ({...previous, websiteUrl: value}))} keyboardType="url"
        autoCapitalize="none" placeholder="https://example.com"/><Field label={t('Mô tả')}
                                                                        value={moduleForm.description || ''}
                                                                        onChangeText={value => setModuleForm(previous => ({
                                                                          ...previous,
                                                                          description: value
                                                                        }))} multiline/><Row><Button label={t('Lưu')}
                                                                                                     onPress={saveModule}
                                                                                                     loading={busy === 'module'}/><Button
        label={t('Hủy')} kind="secondary" onPress={() => setModuleEditor(false)}/></Row></Card> : null}
    {selectedModule ? <><Section title={`${t('Tài khoản')} · ${selectedModule.name}`} action={t('Thêm tài khoản')}
                                 onPress={openNewAccount}/><Card><Row><Field label={t('Tìm tài khoản')}
                                                                             value={accountSearch}
                                                                             onChangeText={setAccountSearch}
                                                                             placeholder={t('Tên hiển thị')}
                                                                             style={{flex: 1}}/><Button
        label={t('Tải lại')} kind="secondary" icon="refresh-outline" onPress={() => {
        setAccountsLoading(true);
        api.listAccounts(selectedModule.id, accountSearch).then(setAccounts).catch(handleError).finally(() => setAccountsLoading(false));
      }}/></Row>{accountsLoading ? <ActivityIndicator color={c.primary}/> : accounts.length ? accounts.map(value => <View
        key={value.id} style={{gap: 8, paddingVertical: 10, borderBottomWidth: 1, borderColor: c.border}}><Row><View
        style={{
          width: 36,
          height: 36,
          borderRadius: 18,
          backgroundColor: c.elevated,
          alignItems: 'center',
          justifyContent: 'center'
        }}><Icon name="key-outline" color={c.primary} size={17}/></View><View style={{flex: 1}}><T size={13}
                                                                                                   bold>{value.displayName}</T><T
        size={10} color={c.muted}>{value.passwordMasked} · v{value.version}</T></View><Pressable
        accessibilityRole="button" accessibilityLabel={t('Xem bí mật')} onPress={() => reveal(value)}
        style={{padding: 7}}>{busy === `reveal-${value.id}` ? <ActivityIndicator color={c.primary}/> :
        <Icon name="eye-outline" color={c.primary} size={18}/>}</Pressable><Pressable accessibilityRole="button"
                                                                                      accessibilityLabel={t('Sửa')}
                                                                                      onPress={() => openEditAccount(value)}
                                                                                      style={{padding: 7}}>{busy === `edit-${value.id}` ?
        <ActivityIndicator color={c.primary}/> :
        <Icon name="create-outline" color={c.primary} size={18}/>}</Pressable><Pressable accessibilityRole="button"
                                                                                         accessibilityLabel={t('Xóa')}
                                                                                         onPress={() => setDeleteAccount(value)}
                                                                                         style={{padding: 7}}><Icon
        name="trash-outline" color={c.error} size={18}/></Pressable></Row>{revealed?.account.id === value.id ?
        <Card style={{padding: 12, gap: 8}}><Row><T size={12} bold
                                                    style={{flex: 1}}>{t('Dữ liệu đã giải mã')}</T><Pressable
          accessibilityRole="button" accessibilityLabel={t('Ẩn bí mật')} onPress={() => setRevealed(null)}><Icon
          name="eye-off-outline" color={c.muted} size={17}/></Pressable></Row><SecretLine label={t('Tên đăng nhập')}
                                                                                          value={revealed.secret.username}
                                                                                          onCopy={() => copySecret(value, 'USERNAME')}/><SecretLine
          label={t('Mật khẩu')} value={revealed.secret.password} onCopy={() => copySecret(value, 'PASSWORD')}/><SecretLine
          label={t('Đường dẫn đăng nhập')} value={revealed.secret.loginUrl}
          onCopy={() => copySecret(value, 'LOGIN_URL')}/>{revealed.secret.note ?
          <SecretLine label={t('Ghi chú')} value={revealed.secret.note} onCopy={() => copySecret(value, 'NOTE')}/> : null}<Info
          tone="warning">{t('Đây là dữ liệu nhạy cảm. Hãy ẩn màn hình sau khi kiểm tra và không chụp ảnh màn hình.')}</Info></Card> : null}
      </View>) : <Empty title={t('Chưa có tài khoản trong nhóm này')}
                        description={t('Thêm tài khoản sau khi mở khóa Password Vault.')} action={t('Thêm tài khoản')}
                        onPress={openNewAccount}/>}</Card></> :
      <Info>{t('Chọn hoặc tạo một nhóm để quản lý tài khoản.')}</Info>}
    {accountEditor && selectedModule ? <Card tint><Section
      title={t(editingAccount ? 'Chỉnh sửa tài khoản' : 'Thêm tài khoản')}/><Info>{t('Secret chỉ được gửi qua API bảo vệ và không được lưu trên thiết bị sau khi rời màn hình.')}</Info><Field
      label={t('Tên hiển thị *')} value={accountForm.displayName}
      onChangeText={value => setAccountForm(previous => ({...previous, displayName: value}))}/><Field
      label={t('Tên đăng nhập')} value={accountForm.username || ''}
      onChangeText={value => setAccountForm(previous => ({...previous, username: value}))} autoCapitalize="none"/><Field
      label={t('Mật khẩu *')} value={accountForm.password}
      onChangeText={value => setAccountForm(previous => ({...previous, password: value}))} secureTextEntry
      autoCapitalize="none"/><Field label={t('Đường dẫn đăng nhập')} value={accountForm.loginUrl || ''}
                                    onChangeText={value => setAccountForm(previous => ({...previous, loginUrl: value}))}
                                    keyboardType="url" autoCapitalize="none"/><Field label={t('Ghi chú')}
                                                                                     value={accountForm.note || ''}
                                                                                     onChangeText={value => setAccountForm(previous => ({
                                                                                       ...previous,
                                                                                       note: value
                                                                                     }))} multiline/><Row><Button
      label={t('Lưu')} onPress={saveAccount} loading={busy === 'account'}/><Button label={t('Hủy')} kind="secondary"
                                                                                   onPress={() => {
                                                                                     setAccountEditor(false);
                                                                                     setEditingAccount(null);
                                                                                   }}/></Row></Card> : null}
    <Dialog visible={!!deleteModule} title={t('Xóa nhóm Password Vault?')}
            message={t('Các tài khoản trong nhóm sẽ bị ẩn cùng nhóm. Hành động này không thể hoàn tác trong giao diện.')}
            confirmLabel={t('Xóa')} onClose={() => setDeleteModule(null)} onConfirm={removeModule}/><Dialog
    visible={!!deleteAccount} title={t('Xóa tài khoản Password Vault?')}
    message={t('Tài khoản sẽ bị ẩn khỏi danh sách. Secret đã mã hóa không được hiển thị lại sau khi xóa.')}
    confirmLabel={t('Xóa')} onClose={() => setDeleteAccount(null)} onConfirm={removeAccount}/>{dialog}
  </Screen>;
}
