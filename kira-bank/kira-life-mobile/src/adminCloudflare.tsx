import React, {useCallback, useState} from 'react';
import {ActivityIndicator, Pressable, View} from 'react-native';
import {useFocusEffect} from 'expo-router';
import {
  CloudflareAccountResponse,
  cloudflareErrorMessage,
  CloudflareProviderStatus,
  useAdminCloudflareApi,
} from './adminCloudflareApi';
import {useAuth} from './auth';
import {useT} from './i18n';
import {useTheme} from './theme';
import {Badge, Button, Card, Dialog, Empty, Field, Icon, Info, Row, Screen, Section, T, useNotice} from './ui';

const statusLabels: Record<CloudflareProviderStatus, string> = {
  PENDING_TEST: 'Chưa xác minh', VERIFIED: 'Đã xác minh', COOLDOWN: 'Đang tạm nghỉ', BLOCKED: 'Bị khóa',
};
type AccountFormState = {
  displayName: string; accountId: string; apiToken: string; aiModel: string; priority: string;
  r2AccessKeyId: string; r2SecretAccessKey: string; r2BucketName: string; r2PublicUrl: string;
};
const emptyForm: AccountFormState = {
  displayName: '',
  accountId: '',
  apiToken: '',
  aiModel: '',
  priority: '100',
  r2AccessKeyId: '',
  r2SecretAccessKey: '',
  r2BucketName: '',
  r2PublicUrl: ''
};

function CloudflareAccountCard({
                                 account,
                                 busy,
                                 onEdit,
                                 onTestAi,
                                 onToggleAi,
                                 onTestR2,
                                 onMakePrimary,
                                 onStopUploads,
                                 onAdoptLegacy,
                                 onDelete,
                               }: {
  account: CloudflareAccountResponse; busy: string; onEdit: () => void; onTestAi: () => void;
  onToggleAi: () => void; onTestR2: () => void; onMakePrimary: () => void; onStopUploads: () => void;
  onAdoptLegacy: () => void; onDelete: () => void;
}) {
  const t = useT();
  const {colors: c} = useTheme();
  const busyNow = (action: string) => busy === `${account.id}:${action}`;
  const providerBadge = (status: CloudflareProviderStatus, enabled = false) => <Badge
    tone={status === 'VERIFIED' ? 'success' : status === 'BLOCKED' ? 'error' : 'warning'}>{t(statusLabels[status])}{enabled ? ` · ${t('Đang bật')}` : ''}</Badge>;
  return <Card style={{gap: 12}}>
    <Row><Icon name="cloud-outline" color={c.primary}/><View style={{flex: 1}}><T size={14}
                                                                                  bold>{account.displayName}</T><T
      size={10} color={c.muted}>{t('Account ID')}: {account.maskedAccountId} · {t('Ưu tiên')}: {account.ai.priority}</T></View><Pressable
      accessibilityRole="button" accessibilityLabel={t('Chỉnh sửa')} onPress={onEdit} style={{padding: 8}}><Icon
      name="create-outline" size={18}/></Pressable></Row>
    <Row><View style={{flex: 1, gap: 5}}><T size={10} color={c.muted}>{t('Workers AI')}</T><Row
      style={{gap: 6}}>{providerBadge(account.ai.status, account.ai.enabled)}<T size={10}
                                                                                color={c.muted}>{account.ai.model}</T></Row><T
      size={9}
      color={c.muted}>{account.ai.tokenConfigured ? t('Token đã cấu hình') : t('Chưa có token')}</T></View><View
      style={{flex: 1, gap: 5}}><T size={10} color={c.muted}>{t('Cloudflare R2')}</T><Row
      style={{gap: 6}}>{providerBadge(account.r2.status)}{account.r2.primary ?
      <Badge tone="primary">{t('Primary')}</Badge> : null}</Row><T size={9}
                                                                   color={c.muted}>{account.r2.maskedBucketName || t('Chưa cấu hình bucket')} · {t('{{n}} file', {n: account.r2.attachmentCount})}</T></View></Row>
    {account.ai.lastErrorCode || account.r2.lastErrorCode ? <Info
      tone="error">{account.ai.lastErrorCode ? `${t('AI')}: ${account.ai.lastErrorCode}` : ''}{account.ai.lastErrorCode && account.r2.lastErrorCode ? ' · ' : ''}{account.r2.lastErrorCode ? `${t('R2')}: ${account.r2.lastErrorCode}` : ''}</Info> : null}
    <Row style={{gap: 6}}><View style={{flex: 1}}><Button label={busyNow('test-ai') ? t('Đang test…') : t('Test AI')}
                                                          kind="secondary" onPress={onTestAi}
                                                          loading={busyNow('test-ai')}
                                                          disabled={!!busy && !busyNow('test-ai')}/></View><View
      style={{flex: 1}}><Button label={account.ai.enabled ? t('Tắt AI') : t('Bật AI')} kind="secondary"
                                onPress={onToggleAi} loading={busyNow('toggle-ai')}
                                disabled={!!busy && !busyNow('toggle-ai')}/></View></Row>
    <Row style={{gap: 6}}><View style={{flex: 1}}><Button label={busyNow('test-r2') ? t('Đang test…') : t('Test R2')}
                                                          kind="secondary" onPress={onTestR2}
                                                          loading={busyNow('test-r2')}
                                                          disabled={!!busy && !busyNow('test-r2')}/></View><View
      style={{flex: 1}}>{account.r2.primary ?
      <Button label={t('Dừng upload')} kind="secondary" onPress={onStopUploads} loading={busyNow('stop-r2')}
              disabled={!!busy && !busyNow('stop-r2')}/> :
      <Button label={t('Chọn R2 primary')} kind="secondary" onPress={onMakePrimary} loading={busyNow('primary-r2')}
              disabled={!!busy && !busyNow('primary-r2')}/>}</View></Row>
    {account.legacyAttachmentCount > 0 ? <><Button
      label={t('Gán {{n}} file cũ vào R2 này', {n: account.legacyAttachmentCount})} kind="secondary"
      onPress={onAdoptLegacy} loading={busyNow('adopt-legacy')}
      disabled={!!busy || account.r2.status !== 'VERIFIED'}/>{account.r2.status !== 'VERIFIED' ?
      <T size={9} color={c.muted}>{t('Test R2 thành công trước khi gán file cũ.')}</T> : null}</> : null}
    {account.r2.attachmentCount === 0 ? <Pressable accessibilityRole="button" onPress={onDelete} disabled={!!busy}
                                                   style={{alignSelf: 'flex-end', padding: 7, opacity: busy ? 0.5 : 1}}><T
        size={10} color={c.error}>{t('Xóa Cloudflare account')}</T></Pressable> :
      <T size={9} color={c.muted} style={{textAlign: 'right'}}>{t('Không thể xóa khi R2 còn file')}</T>}
  </Card>;
}

export function AdminCloudflare() {
  const {session} = useAuth();
  const api = useAdminCloudflareApi();
  const t = useT();
  const {colors: c} = useTheme();
  const {notify, dialog} = useNotice();
  const [accounts, setAccounts] = useState<CloudflareAccountResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<AccountFormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<CloudflareAccountResponse | null>(null);
  const [pendingAdopt, setPendingAdopt] = useState<CloudflareAccountResponse | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    api.list().then(setAccounts).catch(e => setError(cloudflareErrorMessage(e))).finally(() => setLoading(false));
  }, []);
  useFocusEffect(useCallback(() => {
    load();
  }, [load]));

  function change(key: keyof AccountFormState, value: string) {
    setForm(current => ({...current, [key]: value}));
  }

  function edit(account?: CloudflareAccountResponse) {
    setFormOpen(true);
    setEditingId(account?.id ?? null);
    setForm(account ? {
      ...emptyForm,
      displayName: account.displayName,
      accountId: '',
      aiModel: account.ai.model,
      priority: String(account.ai.priority),
      r2BucketName: '',
      r2PublicUrl: ''
    } : {...emptyForm});
    setError('');
  }

  async function save() {
    const name = form.displayName.trim();
    const priority = Number(form.priority);
    if (!name) {
      setError(t('Tên hiển thị không được để trống.'));
      return;
    }
    if (!Number.isInteger(priority) || priority < 0 || priority > 100000) {
      setError(t('Priority phải là số nguyên từ 0 đến 100000.'));
      return;
    }
    if (editingId == null && !/^[0-9a-fA-F]{32}$/.test(form.accountId.trim())) {
      setError(t('Account ID phải có đúng 32 ký tự hex.'));
      return;
    }
    setSaving(true);
    setError('');
    const body = {
      displayName: name,
      accountId: form.accountId.trim() || undefined,
      apiToken: form.apiToken.trim() || undefined,
      aiModel: form.aiModel.trim() || undefined,
      priority,
      r2AccessKeyId: form.r2AccessKeyId.trim() || undefined,
      r2SecretAccessKey: form.r2SecretAccessKey.trim() || undefined,
      r2BucketName: form.r2BucketName.trim() || undefined,
      r2PublicUrl: form.r2PublicUrl.trim() || undefined
    };
    try {
      const result = editingId == null ? await api.create(body) : await api.update(editingId, {
        ...body,
        version: accounts.find(account => account.id === editingId)?.version ?? -1
      });
      setAccounts(current => editingId == null ? [result, ...current] : current.map(account => account.id === result.id ? result : account));
      setEditingId(null);
      setFormOpen(false);
      notify(t('Đã lưu Cloudflare account.'));
    } catch (e) {
      setError(cloudflareErrorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  function replace(result: CloudflareAccountResponse) {
    setAccounts(current => current.map(account => account.id === result.id ? result : account));
  }

  async function action(account: CloudflareAccountResponse, name: string, fn: () => Promise<CloudflareAccountResponse>) {
    setBusy(`${account.id}:${name}`);
    setError('');
    try {
      replace(await fn());
      notify(t('Đã cập nhật Cloudflare account.'));
    } catch (e) {
      setError(cloudflareErrorMessage(e));
    } finally {
      setBusy('');
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    const account = pendingDelete;
    setBusy(`${account.id}:delete`);
    setPendingDelete(null);
    try {
      await api.remove(account.id, account.version);
      setAccounts(current => current.filter(item => item.id !== account.id));
      notify(t('Đã xóa Cloudflare account.'));
    } catch (e) {
      setError(cloudflareErrorMessage(e));
    } finally {
      setBusy('');
    }
  }

  async function confirmAdopt() {
    if (!pendingAdopt) return;
    const account = pendingAdopt;
    setBusy(`${account.id}:adopt-legacy`);
    setPendingAdopt(null);
    try {
      replace(await api.adoptLegacy(account.id, account.version));
      notify(t('Đã gán file cũ vào R2.'));
    } catch (e) {
      setError(cloudflareErrorMessage(e));
    } finally {
      setBusy('');
    }
  }

  if (!session) return <Screen title={t('Cloudflare & R2')} back><Empty
    title={t('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.')}/></Screen>;
  if (!session.user.roles.includes('ADMIN')) return <Screen title={t('Cloudflare & R2')} back><Empty
    title={t('Màn hình này chỉ dành cho Admin.')}/></Screen>;
  return <Screen title={t('Cloudflare & R2')} subtitle={t('Quản lý Workers AI và kho ảnh R2 dùng cho Investment')} back>
    <Card tint><Row><Icon name="cloud-done-outline"/><View style={{flex: 1}}><T size={13}
                                                                                bold>{t('Hạ tầng AI / R2')}</T><T
      size={10} color={c.muted}>{t('Credential chỉ hiển thị dạng masked; ô trống khi sửa sẽ giữ secret hiện tại.')}</T></View><Pressable
      accessibilityRole="button" accessibilityLabel={t('Tải lại')} onPress={load} style={{padding: 8}}><Icon
      name="refresh-outline" size={18}/></Pressable></Row><Button label={t('Thêm Cloudflare account')}
                                                                  icon="add-circle-outline"
                                                                  onPress={() => edit()}/></Card>
    {formOpen ? <Card><Section
      title={editingId === null ? t('Thêm Cloudflare account') : t('Chỉnh sửa Cloudflare account')}/><Field
      label={t('Tên hiển thị *')} value={form.displayName} onChangeText={value => change('displayName', value)}
      maxLength={100}/><Field label={t('Account ID *')} value={form.accountId}
                              onChangeText={value => change('accountId', value)} editable={editingId === null}
                              autoCapitalize="none" maxLength={64}
                              placeholder={editingId === null ? '32 ký tự hex' : t('Để trống để giữ Account ID {{id}}', {id: accounts.find(account => account.id === editingId)?.maskedAccountId || ''})}/><Field
      label={t('AI API token')} value={form.apiToken} onChangeText={value => change('apiToken', value)} secureTextEntry
      maxLength={2048} placeholder={t('Để trống để giữ token hiện tại')}/><Field label={t('Model AI riêng')}
                                                                                 value={form.aiModel}
                                                                                 onChangeText={value => change('aiModel', value)}
                                                                                 maxLength={180}
                                                                                 placeholder={t('Nhập model Cloudflare AI')}/><Field
      label={t('AI priority')} value={form.priority}
      onChangeText={value => change('priority', value.replace(/[^0-9]/g, ''))} keyboardType="number-pad"/><Section
      title={t('Cấu hình R2')}/><Field label={t('R2 access key')} value={form.r2AccessKeyId}
                                       onChangeText={value => change('r2AccessKeyId', value)} secureTextEntry
                                       placeholder={t('Để trống để giữ key hiện tại')}/><Field
      label={t('R2 secret key')} value={form.r2SecretAccessKey}
      onChangeText={value => change('r2SecretAccessKey', value)} secureTextEntry
      placeholder={t('Để trống để giữ secret hiện tại')}/><Field label={t('R2 bucket name')} value={form.r2BucketName}
                                                                 onChangeText={value => change('r2BucketName', value)}
                                                                 maxLength={255}
                                                                 placeholder={t('Nhập khi tạo account hoặc đổi bucket trống')}/><Field
      label={t('R2 public URL')} value={form.r2PublicUrl} onChangeText={value => change('r2PublicUrl', value)}
      maxLength={500} placeholder="https://..."/>{error ? <Info tone="error">{t(error)}</Info> : null}<Row><View
      style={{flex: 1}}><Button label={t('Hủy')} kind="secondary" onPress={() => {
      setEditingId(null);
      setFormOpen(false);
      setError('');
    }}/></View><View style={{flex: 2}}><Button label={t('Lưu')} onPress={save}
                                               loading={saving}/></View></Row></Card> : null}
    {error && !formOpen ? <Info tone="error">{t(error)}</Info> : null}
    {loading ? <ActivityIndicator color={c.primary}/> : accounts.length ? accounts.map(account => <CloudflareAccountCard
        key={account.id} account={account} busy={busy} onEdit={() => edit(account)}
        onTestAi={() => action(account, 'test-ai', () => api.testAi(account.id, {version: account.version}))}
        onToggleAi={() => action(account, 'toggle-ai', () => account.ai.enabled ? api.disableAi(account.id, account.version) : api.enableAi(account.id, account.version))}
        onTestR2={() => action(account, 'test-r2', () => api.testR2(account.id, {version: account.version}))}
        onMakePrimary={() => action(account, 'primary-r2', () => api.makeR2Primary(account.id, account.version))}
        onStopUploads={() => action(account, 'stop-r2', () => api.stopR2Uploads(account.id, account.version))}
        onAdoptLegacy={() => setPendingAdopt(account)} onDelete={() => setPendingDelete(account)}/>) :
      <Empty title={t('Chưa có Cloudflare account')}
             description={t('Tạo account, Test AI và Test R2 trước khi bật hạ tầng cho Investment.')}/>}
    <Info>{t('Model AI được lưu riêng trong DB cho từng Cloudflare account.')}</Info>
    <Dialog visible={!!pendingDelete} title={t('Xóa Cloudflare account?')}
            message={t('Chỉ xóa account không còn file R2. Hành động này không thể hoàn tác.')}
            onClose={() => setPendingDelete(null)} onConfirm={confirmDelete} confirmLabel={t('Xóa')}/>
    <Dialog visible={!!pendingAdopt} title={t('Gán file legacy vào R2?')}
            message={t('Các file cũ chưa gán sẽ được chuyển sang account R2 đã xác minh này.')}
            onClose={() => setPendingAdopt(null)} onConfirm={confirmAdopt} confirmLabel={t('Gán file')}/>
    {dialog}
  </Screen>;
}
