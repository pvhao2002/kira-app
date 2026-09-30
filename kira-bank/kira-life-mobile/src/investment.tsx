import React, {useCallback, useEffect, useState} from 'react';
import {ActivityIndicator, Image, Modal, Pressable, View} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import {router, useFocusEffect} from 'expo-router';
import {ApiError, useAuth} from './auth';
import {dateLabel, money, validDate} from './data';
import {EffectiveItem, useImportReview} from './importReview';
import {
  AccountResponse,
  AccountStatus,
  adminAiJobContentUri,
  aiJobContentUri,
  AiTransactionDraftResponse,
  AttachmentAiStatus,
  errorMessage,
  errorMessageForCode,
  InvestmentAiJobResponse,
  InvestmentImportBatchStatus,
  InvestmentImportFileStatus,
  InvestmentImportResolution,
  InvestmentOverview,
  InvestmentTransactionStatus,
  InvestmentTransactionType,
  useInvestmentApi,
} from './investmentApi';
import {useLanguage, useT} from './i18n';
import {useTheme} from './theme';
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
  Metric,
  Progress,
  Row,
  Screen,
  Section,
  T,
  useNotice
} from './ui';

const typeLabels: Record<InvestmentTransactionType, string> = {
  DEPOSIT: 'Nạp tiền',
  WITHDRAWAL: 'Rút tiền',
  BONUS: 'Thưởng'
};
const statusLabels: Record<InvestmentTransactionStatus, string> = {
  PENDING: 'Chờ xử lý',
  COMPLETED: 'Hoàn thành',
  FAILED: 'Thất bại',
  CANCELLED: 'Đã hủy'
};
const resolutionLabels: Record<InvestmentImportResolution, string> = {
  ACCEPT: 'Chấp nhận',
  MERGE_EXISTING: 'Gộp với bản ghi có sẵn',
  SAVE_AS_NEW: 'Lưu như giao dịch mới',
  SKIP: 'Bỏ qua'
};
const jobStatusLabels: Record<AttachmentAiStatus, string> = {
  NOT_REQUESTED: 'Chưa yêu cầu',
  PENDING: 'Đang chờ',
  PROCESSING: 'Đang xử lý',
  READY: 'Sẵn sàng',
  FAILED: 'Thất bại',
  CANCELLED: 'Đã hủy',
  CONFIRMED: 'Đã xác nhận'
};
const fileStatusLabels: Record<InvestmentImportFileStatus, string> = jobStatusLabels as Record<InvestmentImportFileStatus, string>;
const batchStatusLabels: Record<InvestmentImportBatchStatus, string> = {
  QUEUED: 'Đang chờ xử lý', PROCESSING: 'Đang xử lý', READY: 'Sẵn sàng duyệt', READY_WITH_ERRORS: 'Sẵn sàng (có lỗi)',
  PARTIALLY_CONFIRMED: 'Đã xác nhận một phần', CONFIRMED: 'Đã xác nhận', FAILED: 'Thất bại', CANCELLED: 'Đã hủy',
};

export function InvestmentNav({active}: { active: string }) {
  const t = useT();
  const {colors: c} = useTheme();
  return <View style={{borderBottomWidth: 1, borderColor: c.border, paddingBottom: 8}}><Chips value={active} values={[{
    label: t('Tài khoản'),
    value: 'accounts'
  }, {label: t('Nhập giao dịch'), value: 'import'}, {label: t('Hàng đợi AI'), value: 'queue'}, {
    label: t('Tra soát'),
    value: 'investment-reports'
  }]} onChange={v => v === 'accounts' ? router.replace('/investment') : router.replace({
    pathname: '/[page]',
    params: {page: v}
  })}/></View>;
}

function InvestmentOverviewCard() {
  const api = useInvestmentApi();
  const t = useT();
  const {lang} = useLanguage();
  const {colors: c} = useTheme();
  const [days, setDays] = useState<7 | 30 | 90>(30);
  const [overview, setOverview] = useState<InvestmentOverview | null>(null);
  const [expandedCurrency, setExpandedCurrency] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback(() => {
    setLoading(true);
    api.getOverview(days).then(value => {
      setOverview(value);
      setError('');
    }).catch(e => setError(t(errorMessage(e)))).finally(() => setLoading(false));
  }, [days, t]);
  useFocusEffect(useCallback(() => {
    load();
  }, [load]));
  if (loading && !overview) return <Card><ActivityIndicator color={c.primary}/></Card>;
  if (error && !overview) return <Card><Info tone="error">{error}</Info><Button label={t('Thử lại')} kind="secondary"
                                                                                onPress={load}/></Card>;
  if (!overview) return null;
  return <Card tint><Row><View style={{flex: 1}}><T size={11} color={c.primary}>{t('TỔNG QUAN INVESTMENT')}</T><T
    size={10} color={c.muted}>{t('{{n}} tài khoản đang hoạt động · {{from}} đến {{to}}', {
    n: overview.activeAccounts,
    from: overview.fromDate,
    to: overview.toDate
  })}</T></View><Badge>{t('{{n}} ngày', {n: overview.days})}</Badge></Row><Chips value={String(days)}
                                                                                 onChange={value => {
                                                                                   setDays(Number(value) as 7 | 30 | 90);
                                                                                   setExpandedCurrency(null);
                                                                                 }} values={[{
    value: '7',
    label: t('7 ngày')
  }, {value: '30', label: t('30 ngày')}, {
    value: '90',
    label: t('90 ngày')
  }]}/>{overview.currencies.length ? overview.currencies.map(flow => <View key={flow.currency} style={{
    gap: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderColor: c.border
  }}><Row><T size={13} bold style={{flex: 1}}>{flow.currency}</T><T size={12}
                                                                    color={flow.netDeposits < 0 ? c.error : c.success}
                                                                    bold>{money(flow.netDeposits, flow.currency, lang)}</T></Row><Row><Metric
    label={t('Deposit')} value={money(flow.deposits, flow.currency, lang)}/><Metric label={t('Withdrawal')}
                                                                                    value={money(flow.withdrawals, flow.currency, lang)}/><Metric
    label={t('Bonus')} value={money(flow.bonuses, flow.currency, lang)} color={c.lavender}/></Row><Pressable
    accessibilityRole="button"
    onPress={() => setExpandedCurrency(current => current === flow.currency ? null : flow.currency)}
    style={{paddingVertical: 4}}><T size={10}
                                    color={c.primary}>{expandedCurrency === flow.currency ? t('Ẩn chi tiết ngày') : t('Xem theo ngày')} ›</T></Pressable>{expandedCurrency === flow.currency ?
    <View style={{gap: 6, paddingTop: 4}}>{flow.daily.slice(-7).map(day => <Row key={day.date}
                                                                                style={{alignItems: 'flex-start'}}><T
      size={9} color={c.muted} style={{width: 70}}>{dateLabel(day.date)}</T><Metric label={t('Deposit')}
                                                                                    value={money(day.deposits, flow.currency, lang)}/><Metric
      label={t('Withdrawal')} value={money(day.withdrawals, flow.currency, lang)}/><Metric label={t('Bonus')}
                                                                                           value={money(day.bonuses, flow.currency, lang)}
                                                                                           color={c.lavender}/></Row>)}</View> : null}
  </View>) : <T size={11} color={c.muted}>{t('Chưa có giao dịch hoàn tất trong khoảng thời gian này.')}</T>}<Row><T
    size={10} color={c.muted} style={{flex: 1}}>{t('{{n}} lô cần duyệt · {{m}} lô lỗi', {
    n: overview.review.total,
    m: overview.failed.total
  })}</T><Pressable accessibilityRole="button" onPress={() => go('history')}><T size={11}
                                                                                color={c.primary}>{t('Mở lịch sử')} ›</T></Pressable></Row></Card>;
}

export function Accounts() {
  const api = useInvestmentApi();
  const t = useT();
  const {colors: c} = useTheme();
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | AccountStatus>('all');
  const [accounts, setAccounts] = useState<AccountResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async (q: string) => {
    setLoading(true);
    try {
      const all: AccountResponse[] = [];
      let page = 0;
      let totalPages = 1;
      do {
        const result = await api.listAccounts(q, page, 100);
        all.push(...result.data);
        totalPages = result.meta.totalPages;
        page += 1;
      } while (page < totalPages);
      setAccounts(all);
      setError('');
    } catch (e) {
      setError(t(errorMessage(e)));
    } finally {
      setLoading(false);
    }
  }, []);
  useFocusEffect(useCallback(() => {
    load(query);
  }, [load]));
  useEffect(() => {
    const timer = setTimeout(() => load(query), 350);
    return () => clearTimeout(timer);
  }, [query]);

  const shown = accounts.filter(a => statusFilter === 'all' || a.status === statusFilter);
  const activeCount = accounts.filter(a => a.status === 'ACTIVE').length;
  const inactiveCount = accounts.filter(a => a.status === 'INACTIVE').length;
  const closedCount = accounts.filter(a => a.status === 'CLOSED').length;

  return <Screen title={t('Đầu tư')}><InvestmentNav active="accounts"/><InvestmentOverviewCard/><Row><View
    style={{flex: 1}}><T size={19} bold>{t('Danh sách tài khoản đầu tư')}</T><T size={11}
                                                                                color={c.muted}>{t('Quản lý định danh và thông tin xác thực dữ liệu')}</T></View><Badge>{t('{{n}} tài khoản', {n: accounts.length})}</Badge></Row><Row
    style={{alignItems: 'flex-end'}}><View style={{flex: 1}}><Field label={t('Tìm tài khoản')} value={query}
                                                                    onChangeText={setQuery}
                                                                    placeholder={t('Tìm theo tên, mã tài khoản…')}/></View><Button
    label={t('Thêm')} icon="add" onPress={() => go('account-add')}/></Row><Chips value={statusFilter}
                                                                                 onChange={v => setStatusFilter(v as 'all' | AccountStatus)}
                                                                                 values={[{
                                                                                   label: t('Tất cả ({{n}})', {n: accounts.length}),
                                                                                   value: 'all'
                                                                                 }, {
                                                                                   label: t('Hoạt động ({{n}})', {n: activeCount}),
                                                                                   value: 'ACTIVE'
                                                                                 }, {
                                                                                   label: t('Không hoạt động ({{n}})', {n: inactiveCount}),
                                                                                   value: 'INACTIVE'
                                                                                 }, {
                                                                                   label: t('Đã đóng ({{n}})', {n: closedCount}),
                                                                                   value: 'CLOSED'
                                                                                 }]}/>
    {error ? <Info tone="error">{error}</Info> : null}
    {loading ? <ActivityIndicator color={c.primary}/> : !shown.length ?
      <Empty title={t('Không tìm thấy tài khoản')}/> : shown.map(a => <Card key={a.id}
                                                                            style={{padding: 18, gap: 16}}><Row><T
        size={15} bold style={{flex: 1}}>{a.accountName}</T><Badge
        tone={a.status === 'ACTIVE' ? 'success' : a.status === 'CLOSED' ? 'error' : 'muted'}>{a.status === 'ACTIVE' ? t('• Hoạt động') : a.status === 'CLOSED' ? t('• Đã đóng') : t('• Không hoạt động')}</Badge></Row><View><Badge>{a.currency}</Badge><T
        size={10} color={c.muted}>{t('MÃ')}: {a.accountCode}</T></View><Row><View style={{flex: 1, gap: 4}}><T size={9}
                                                                                                               color={c.muted}>♙ {t('TÊN ĐĂNG NHẬP')}</T><T
        size={11}>{a.accountUsername}</T><T size={9} color={c.muted}>✉ {t('EMAIL ĐĂNG KÝ')}</T><T
        size={10}>{a.accountEmail}</T></View><View style={{flex: 1, gap: 4}}><T size={9}
                                                                                color={c.muted}>♧ {t('SỐ ĐIỆN THOẠI')}</T><T
        size={11}>{a.phoneNumber}</T><T size={9} color={c.muted}>▣ {t('NGÀY ĐĂNG KÝ')}</T><T
        size={11}>{dateLabel(a.registerDate)}</T></View></Row><Row style={{justifyContent: 'flex-end'}}><Pressable
        accessibilityRole="button" onPress={() => go('account-stats', {id: String(a.id)})} style={{padding: 8}}><T
        size={11} color={c.primary}>{t('Thống kê')}</T></Pressable><Pressable accessibilityRole="button"
                                                                              onPress={() => go('account-edit', {id: String(a.id)})}
                                                                              style={{padding: 8}}><T size={11}
                                                                                                      color={c.primary}>✎ {t('Chỉnh sửa')}</T></Pressable></Row></Card>)}<Info>{t('Mỗi tài khoản lưu trữ độc lập thông tin đồng bộ dữ liệu. Không can thiệp số dư trực tiếp.')}</Info>
  </Screen>;
}

export function AccountForm({id}: { id?: string }) {
  const api = useInvestmentApi();
  const t = useT();
  const {colors: c} = useTheme();
  const {notify, dialog} = useNotice();
  const editing = !!id;
  const accountId = id ? Number(id) : undefined;
  const [original, setOriginal] = useState<AccountResponse | null>(null);
  const [loading, setLoading] = useState(editing);
  const [notFound, setNotFound] = useState(false);
  const [form, setForm] = useState({
    accountCode: '',
    accountName: '',
    accountUsername: '',
    accountEmail: '',
    phoneNumber: '',
    registerDate: new Date().toISOString().slice(0, 10),
    accountPassword: '',
    currency: 'VND',
    status: 'ACTIVE' as AccountStatus,
    note: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!editing || !accountId) return;
    api.getAccount(accountId).then(a => {
      setOriginal(a);
      setForm({
        accountCode: a.accountCode,
        accountName: a.accountName,
        accountUsername: a.accountUsername,
        accountEmail: a.accountEmail,
        phoneNumber: a.phoneNumber,
        registerDate: a.registerDate,
        accountPassword: '',
        currency: a.currency,
        status: a.status,
        note: a.note || ''
      });
    }).catch(() => setNotFound(true)).finally(() => setLoading(false));
  }, [accountId]);
  const field = (key: keyof typeof form, value: string) => setForm(f => ({...f, [key]: value}));

  if (editing && loading) return <Screen title={t('Tài khoản')} back><ActivityIndicator color={c.primary}/></Screen>;
  if (editing && notFound) return <Screen title={t('Tài khoản')} back><Empty title={t('Tài khoản không còn tồn tại')}/></Screen>;

  async function save() {
    if (!form.accountName.trim() || (!editing && (!form.accountCode.trim() || !form.accountUsername.trim() || !form.accountEmail.trim() || !form.phoneNumber.trim() || !form.accountPassword.trim()))) {
      setError(t('Điền đầy đủ mã, tên tài khoản, tên đăng nhập, email và số điện thoại.'));
      return;
    }
    if (form.accountEmail && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.accountEmail)) {
      setError(t('Email không hợp lệ.'));
      return;
    }
    if (!validDate(form.registerDate)) {
      setError(t('Ngày đăng ký phải có dạng YYYY-MM-DD.'));
      return;
    }
    setSaving(true);
    setError('');
    try {
      if (editing && original) {
        await api.updateAccount(original.id, {
          accountCode: form.accountCode.trim(),
          accountName: form.accountName.trim(),
          accountUsername: form.accountUsername,
          accountEmail: form.accountEmail,
          phoneNumber: form.phoneNumber,
          registerDate: form.registerDate,
          accountPassword: form.accountPassword.trim() || null,
          note: form.note || null,
          status: form.status,
          version: original.version
        });
      } else {
        await api.createAccount({
          accountCode: form.accountCode.trim(),
          accountName: form.accountName.trim(),
          accountUsername: form.accountUsername,
          accountEmail: form.accountEmail,
          phoneNumber: form.phoneNumber,
          registerDate: form.registerDate,
          accountPassword: form.accountPassword,
          currency: form.currency
        });
        notify(t('Tài khoản đầu tư mới đã được tạo.'));
      }
      router.back();
    } catch (e) {
      setError(t(errorMessage(e)));
    } finally {
      setSaving(false);
    }
  }

  return <Screen title={editing ? t('Chỉnh sửa tài khoản') : t('Thêm tài khoản')}
                 subtitle={editing ? t('TÀI KHOẢN LIÊN KẾT') : t('Tài khoản đầu tư mới')} back
                 footer={<Row><View style={{flex: 1}}><Button label={t('Hủy bỏ')} kind="secondary"
                                                              onPress={() => router.back()}/></View><View
                   style={{flex: 2}}><Button label={editing ? t('Lưu thay đổi') : t('Tạo tài khoản')}
                                             icon={editing ? 'checkmark-circle-outline' : 'add-circle-outline'}
                                             onPress={save} loading={saving}/></View></Row>}>
    {editing ? <Card tint><Badge>◈ {t('CHỨNG KHOÁN SSI')}</Badge><T size={20} bold>{form.accountName}</T><T size={11}
                                                                                                            color={c.muted}>{t('Tài khoản chuyên nghiệp tích hợp dòng giao dịch tốc độ cao Kira')}</T><Info>{t('Đồng bộ dữ liệu thời gian thực. Nếu có thay đổi tại phiên khác, vui lòng tải lại thông tin mới nhất.')}</Info></Card> :
      <Info>{t('Liên kết an toàn đa nền tảng. Thông tin tài khoản giao dịch chứng khoán sẽ được mã hóa chuẩn băng giá Glacier Vault 256-bit.')}</Info>}{error ?
    <Info tone="error">{error}</Info> : null}
    <Card><Section title={t('Thông tin tài khoản')}/><Field label={t('Mã tài khoản *')} value={form.accountCode}
                                                            editable={!editing} maxLength={100}
                                                            onChangeText={v => field('accountCode', v)}
                                                            autoCapitalize="characters"
                                                            placeholder={t('Ví dụ: SSI-001C-VN')}/><Field
      label={t('Tên tài khoản *')} value={form.accountName} maxLength={150} onChangeText={v => field('accountName', v)}
      placeholder={t('Ví dụ: Tài khoản SSI Pro Trader')}/><T size={12}
                                                             color={c.muted}>{t('Tiền tệ giao dịch *')}</T><Chips
      value={form.currency} values={[{label: t('VND (Đồng)'), value: 'VND'}, {label: t('USD (Đô la)'), value: 'USD'}]}
      onChange={v => editing ? undefined : field('currency', v)}/>{editing ? <><T size={10}
                                                                                  color={c.muted}>{t('Không thể thay đổi tiền tệ sau khi tạo tài khoản.')}</T><T
      size={12} color={c.muted}>{t('Trạng thái vận hành')}</T><Chips value={form.status} values={[{
      label: t('• Hoạt động'),
      value: 'ACTIVE'
    }, {label: t('• Tạm dừng'), value: 'INACTIVE'}, {label: t('• Đã đóng'), value: 'CLOSED'}]}
                                                                     onChange={v => field('status', v)}/></> : null}
    </Card>
    <Card><Section
      title={t('Thông tin đăng ký & Xác thực')}/><Info>{t('Lưu ý: Thông tin dưới đây dùng để định danh tài khoản đầu tư, không phải tài khoản ứng dụng Kira Bank.')}</Info><Field
      label={t('Tên đăng nhập *')} value={form.accountUsername} onChangeText={v => field('accountUsername', v)}
      autoCapitalize="none" placeholder={t('Nhập định danh sàn giao dịch')}/><Field label={t('Email đăng ký *')}
                                                                                    value={form.accountEmail}
                                                                                    onChangeText={v => field('accountEmail', v)}
                                                                                    keyboardType="email-address"
                                                                                    autoCapitalize="none"
                                                                                    placeholder="name@example.com"/><Field
      label={t('Số điện thoại *')} value={form.phoneNumber} onChangeText={v => field('phoneNumber', v)}
      keyboardType="phone-pad" placeholder="09xx xxx xxx"/><Field label={t('Ngày đăng ký (YYYY-MM-DD) *')}
                                                                  value={form.registerDate}
                                                                  onChangeText={v => field('registerDate', v)}/><Field
      label={t('Mật khẩu tài khoản')} value={form.accountPassword} onChangeText={v => field('accountPassword', v)}
      secureTextEntry={!showPassword}
      placeholder={editing ? t('Để trống để giữ mật khẩu hiện tại') : t('Nhập mật khẩu tài khoản')}
      accessory={<Pressable accessibilityRole="button" hitSlop={8} onPress={() => setShowPassword(v => !v)}
                            style={{padding: 10}}><Icon name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                                                        size={18} color={c.muted}/></Pressable>}/></Card>{dialog}
  </Screen>;
}

export function ManualTransactionForm({accountId: initialAccountId}: { accountId?: string }) {
  const api = useInvestmentApi();
  const t = useT();
  const {colors: c} = useTheme();
  const requestedAccountId = initialAccountId ? Number(initialAccountId) : null;
  const [accounts, setAccounts] = useState<AccountResponse[]>([]);
  const [accountId, setAccountId] = useState<number | null>(() => requestedAccountId && Number.isFinite(requestedAccountId) ? requestedAccountId : null);
  const [type, setType] = useState<InvestmentTransactionType>('DEPOSIT');
  const [status, setStatus] = useState<InvestmentTransactionStatus>('COMPLETED');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(() => {
    const now = new Date();
    return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  });
  const [externalId, setExternalId] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const account = accounts.find(value => value.id === accountId);

  useEffect(() => {
    let active = true;
    (async () => {
      return api.listAllAccounts('');
    })().then(result => {
      if (!active) return;
      const activeAccounts = result.filter(value => value.status === 'ACTIVE');
      setAccounts(activeAccounts);
      setAccountId(previous => activeAccounts.some(value => value.id === previous) ? previous : activeAccounts[0]?.id ?? null);
    }).catch(() => {
      if (active) setError(t('Không tải được danh sách tài khoản đầu tư.'));
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [initialAccountId]);

  async function save() {
    const numericAmount = Number(amount.replace(/,/g, '').trim());
    if (!account) {
      setError(t('Chọn tài khoản đang hoạt động.'));
      return;
    }
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setError(t('Số tiền phải lớn hơn 0.'));
      return;
    }
    if (!validDate(date, true)) {
      setError(t('Thời gian phải có dạng YYYY-MM-DDTHH:mm.'));
      return;
    }
    const transactionAt = new Date(`${date}:00`);
    if (Number.isNaN(transactionAt.getTime())) {
      setError(t('Thời gian giao dịch không hợp lệ.'));
      return;
    }
    setSaving(true);
    setError('');
    try {
      const transaction = await api.createManualTransaction(account.id, {
        transactionType: type, transactionStatus: status, amount: numericAmount, currency: account.currency,
        transactionAt: transactionAt.toISOString(), externalTransactionId: externalId.trim() || null,
        description: description.trim() || null,
      });
      router.replace({
        pathname: '/[page]',
        params: {page: 'transaction-detail', id: String(transaction.id), accountId: String(account.id)}
      });
    } catch (e) {
      setError(t(errorMessage(e)));
    } finally {
      setSaving(false);
    }
  }

  return <Screen title={t('Nhập giao dịch thủ công')}
                 subtitle={t('Ghi nhận khi ảnh không nhận diện được hoặc không có chứng từ')} back
                 footer={<Row><View style={{flex: 1}}><Button label={t('Hủy bỏ')} kind="secondary"
                                                              onPress={() => router.back()}/></View><View
                   style={{flex: 2}}><Button label={t('Ghi nhận giao dịch')} icon="checkmark-circle-outline"
                                             onPress={save} loading={saving} disabled={loading}/></View></Row>}>
    <Badge>{t('SỔ ĐỐI SOÁT INVESTMENT')}</Badge>
    {error ? <Info tone="error">{error}</Info> : null}
    {loading ? <ActivityIndicator color={c.primary}/> : <>
      <Card><Section title={t('Tài khoản nguồn *')}/><Chips value={accountId == null ? '' : String(accountId)}
                                                            onChange={value => setAccountId(Number(value))}
                                                            values={accounts.map(value => ({
                                                              value: String(value.id),
                                                              label: `${value.accountName} • ${value.currency}`
                                                            }))}/>{!accounts.length ?
        <Info tone="warning">{t('Chưa có tài khoản đầu tư đang hoạt động.')}</Info> : account ?
          <T size={10} color={c.success}>{t('Tiền tệ giao dịch')}: {account.currency}</T> : null}</Card>
      <Card><Section title={t('Thông tin giao dịch')}/><T size={11}
                                                          color={c.muted}>{t('Chỉ hỗ trợ ba loại dòng tiền: Deposit, Withdrawal và Bonus.')}</T><T
        size={12} color={c.muted}>{t('Loại giao dịch *')}</T><Chips value={type}
                                                                    values={(['DEPOSIT', 'WITHDRAWAL', 'BONUS'] as InvestmentTransactionType[]).map(value => ({
                                                                      value,
                                                                      label: t(typeLabels[value])
                                                                    }))}
                                                                    onChange={value => setType(value as InvestmentTransactionType)}/><T
        size={12} color={c.muted}>{t('Trạng thái *')}</T><Chips value={status}
                                                                values={(['PENDING', 'COMPLETED', 'FAILED', 'CANCELLED'] as InvestmentTransactionStatus[]).map(value => ({
                                                                  value,
                                                                  label: t(statusLabels[value])
                                                                }))}
                                                                onChange={value => setStatus(value as InvestmentTransactionStatus)}/><Field
        label={t('Số tiền *')} keyboardType="numeric" value={amount} onChangeText={setAmount}
        placeholder={t('Nhập số tiền dương')}/><Field label={t('Ngày giờ giao dịch *')} value={date}
                                                      onChangeText={setDate} hint="YYYY-MM-DDTHH:mm"/><Field
        label={t('Mã giao dịch bên ngoài')} value={externalId} onChangeText={setExternalId} maxLength={150}
        placeholder={t('Nếu có mã trên sao kê')}/><Field label={t('Mô tả')} value={description}
                                                         onChangeText={setDescription} multiline maxLength={1000}
                                                         placeholder={t('Ghi chú để đối soát sau này')}/></Card>
      <Info>{t('Giao dịch được ghi nhận trực tiếp sau khi bạn bấm xác nhận, dùng chung với dữ liệu AI trong thống kê và lịch sử. Hệ thống vẫn chống ghi trùng theo mã giao dịch hoặc dấu vân tay giao dịch.')}</Info>
    </>}
  </Screen>;
}

function ImportItemCard({item}: { item: EffectiveItem }) {
  const t = useT();
  const {lang} = useLanguage();
  const {colors: c} = useTheme();
  const {toggleSelected} = useImportReview();
  const accent = item.transactionType === 'BONUS' ? c.lavender : c.primary;
  const badge = item.processingAction === 'REVIEW' ? {tone: 'error' as const, text: t('Cần duyệt (Trùng lặp tiềm ẩn)')}
    : item.processingAction === 'DUPLICATE' ? {tone: 'muted' as const, text: t('Trùng lặp (Sẽ bỏ qua)')}
      : item.processingAction === 'UPDATE' ? {tone: 'primary' as const, text: t('Đề xuất: Cập nhật')}
        : item.processingAction === 'IGNORE' ? {tone: 'muted' as const, text: t('Bỏ qua')}
          : {tone: 'primary' as const, text: t('Đề xuất: Thêm mới')};
  return <Card style={{
    borderWidth: item.processingAction === 'REVIEW' ? 1 : 0,
    borderColor: item.processingAction === 'REVIEW' ? c.warning : c.border,
    gap: 18
  }}>
    <Row style={{gap: 6}}>
      <Pressable accessibilityRole="checkbox" aria-checked={item.selected} accessibilityState={{checked: item.selected}}
                 onPress={() => toggleSelected(item.itemId)}
                 style={{minWidth: 28, minHeight: 36, justifyContent: 'center'}}><Icon
        name={item.selected ? 'checkbox' : 'square-outline'} size={18}/></Pressable>
      <T size={13} bold
         style={{flex: 1}}>{item.transactionType ? t(typeLabels[item.transactionType]) : t('Chưa xác định loại')}</T>
      <View style={{maxWidth: '45%'}}><Badge tone={badge.tone}>{badge.text}</Badge></View>
    </Row>
    {item.processingAction === 'REVIEW' ?
      <Info tone="warning">{t('Cần duyệt (Trùng lặp tiềm ẩn). Có 1 giao dịch cùng số tiền trong ngày.')}</Info> : null}
    {item.warnings.length ? <Info tone="warning">{item.warnings.join(', ')}</Info> : null}
    <Row><View style={{flex: 1}}><T size={10} color={c.muted}>{t('SỐ TIỀN')}</T><T size={21} color={accent}
                                                                                   bold>{item.transactionType === 'WITHDRAWAL' ? '−' : '+'}{item.amount != null ? money(item.amount, item.currency || undefined, lang) : '—'}</T></View>{item.transactionAt ?
      <View><T size={9} color={c.muted}>{t('NGÀY GIỜ')}</T><T
        size={10}>{dateLabel(item.transactionAt)}</T></View> : null}</Row>
    <Row><T size={10} color={c.muted} style={{flex: 1}}>{t('Mã GD bên ngoài')}</T><T size={10}
                                                                                     color={c.primary}>{item.externalTransactionId || t('— (Không có)')}</T></Row>
    <Row><T size={10} color={c.muted} style={{flex: 1}}>{t('Đề xuất:')} <T size={10}
                                                                           color={accent}>{item.resolution ? t(resolutionLabels[item.resolution]) : t('Cần duyệt')}</T></T><Pressable
      accessibilityRole="button" onPress={() => go('draft-edit', {id: item.itemId})} style={{padding: 8}}><T size={11}
                                                                                                             color={c.primary}>✎ {t('Chỉnh sửa')}</T></Pressable></Row>
  </Card>;
}

export function ImportScreen() {
  const t = useT();
  const api = useInvestmentApi();
  const review = useImportReview();
  const {colors: c} = useTheme();
  const {notify, dialog} = useNotice();
  const [accounts, setAccounts] = useState<AccountResponse[]>([]);
  const [accountId, setAccountId] = useState<number | null>(null);
  const [picked, setPicked] = useState<{ uri: string; name: string; type: string }[]>([]);
  const [preview, setPreview] = useState<{ uri: string; name: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    api.listAllAccounts('').then(result => {
      const active = result.filter(a => a.status === 'ACTIVE');
      setAccounts(active);
      setAccountId(prev => prev ?? (active[0]?.id ?? null));
    }).catch(() => {
    });
  }, []);

  useEffect(() => {
    const batch = review.batch;
    if (!batch) return;
    const active = batch.status === 'QUEUED' || batch.status === 'PROCESSING' || batch.files.some(f => f.status === 'PENDING' || f.status === 'PROCESSING');
    if (!active) return;
    const timer = setInterval(() => {
      review.refresh().catch(() => {
      });
    }, 4000);
    return () => clearInterval(timer);
  }, [review.batch?.batchId, review.batch?.status]);

  async function pickImages() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      notify(t('Cần quyền truy cập ảnh để chọn chứng từ.'));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: 10,
      quality: 0.85
    });
    if (result.canceled) return;
    setPicked(prev => [...prev, ...result.assets.map(a => ({
      uri: a.uri,
      name: a.fileName || `receipt-${Date.now()}.jpg`,
      type: a.mimeType || 'image/jpeg'
    }))].slice(0, 10));
  }

  async function captureImage() {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      notify(t('Cần quyền camera để chụp chứng từ.'));
      return;
    }
    const result = await ImagePicker.launchCameraAsync({mediaTypes: ['images'], quality: 0.85});
    if (result.canceled || !result.assets.length) return;
    setPicked(prev => [...prev, ...result.assets.map(a => ({
      uri: a.uri,
      name: a.fileName || `receipt-camera-${Date.now()}.jpg`,
      type: a.mimeType || 'image/jpeg'
    }))].slice(0, 10));
  }

  async function upload() {
    if (!accountId) {
      notify(t('Chọn tài khoản đang hoạt động.'));
      return;
    }
    if (!picked.length) {
      notify(t('Chọn ít nhất 1 ảnh chứng từ.'));
      return;
    }
    setUploading(true);
    try {
      await review.startUpload(accountId, picked);
      setPicked([]);
      setPreview(null);
    } catch (e) {
      if (__DEV__) console.error('[Investment import] upload failed', {
        accountId,
        fileCount: picked.length,
        status: e instanceof ApiError ? e.status : undefined,
        code: e instanceof ApiError ? e.code : undefined,
        traceId: e instanceof ApiError ? e.traceId : undefined,
        error: e instanceof Error ? `${e.name}: ${e.message}` : String(e)
      });
      notify(t(errorMessage(e)));
    } finally {
      setUploading(false);
    }
  }

  async function doConfirm() {
    setConfirming(true);
    try {
      const result = await review.confirm();
      setConfirmOpen(false);
      go(result.failed ? 'result-partial' : 'result-success');
    } catch (e) {
      notify(t(errorMessage(e)));
      setConfirmOpen(false);
    } finally {
      setConfirming(false);
    }
  }

  const batch = review.batch;
  const items = batch?.transactions ?? [];
  const selectedCount = items.filter(it => review.effective(it.itemId)?.selected).length;
  const reviewable = !!batch && ['READY', 'READY_WITH_ERRORS', 'PARTIALLY_CONFIRMED'].includes(batch.status);

  return <Screen title={t('Nhập giao dịch')} back footer={batch ?
    <Row><View style={{flex: 1}}><T size={11} bold>{t('Đã chọn: {{n}} bản ghi', {n: selectedCount})}</T><T size={9}
                                                                                                           color={c.muted}>{t('Sẵn sàng lưu vào sổ GD')}</T></View><View
      style={{flex: 2}}><Button label={t('Xác nhận các mục đã chọn')} disabled={!reviewable || !selectedCount}
                                onPress={() => setConfirmOpen(true)}/></View></Row> : undefined}>
    <InvestmentNav active="import"/><Row style={{justifyContent: 'space-between'}}><View><Badge>{t('Nhập ảnh')}</Badge></View><Pressable
      onPress={() => go('history')} accessibilityRole="button" style={{padding: 10, alignItems: 'center', justifyContent: 'center'}}><T
      size={11} color={c.muted}>◷ {t('Lịch sử')}</T></Pressable></Row>
    {!batch ? <>
      <Card><T size={9} color={c.primary}>{t('TÀI KHOẢN NGUỒN *')}</T><Chips
        value={accountId != null ? String(accountId) : ''} onChange={v => setAccountId(Number(v))}
        values={accounts.map(a => ({
          label: `${a.accountName} • ${a.currency}`,
          value: String(a.id)
        }))}/>{!accounts.length ? <T size={10} color={c.muted}>{t('Chưa có tài khoản đang hoạt động.')}</T> :
        <T size={10} color={c.success}>{t('Hoạt động')}</T>}</Card>
      <Section
        title={t('1. Chọn ảnh giao dịch')}/><Info>{t('JPEG, PNG hoặc WebP • Tối đa 10 ảnh mỗi lô • Tổng tối đa 50 MB')}</Info>
      <Card>{picked.length ? <View style={{flexDirection: 'row', flexWrap: 'wrap', gap: 10}}>{picked.map((f, i) => <View
        key={f.uri} style={{width: 96, gap: 4}}><Pressable accessibilityRole="button" accessibilityLabel={t('Xem ảnh')}
        onPress={() => setPreview(f)} style={{height: 96, borderRadius: 14, overflow: 'hidden', backgroundColor: c.elevated,
          borderWidth: 1, borderColor: c.border}}><Image source={{uri: f.uri}} style={{width: '100%', height: '100%'}}
          resizeMode="cover"/></Pressable><Row style={{gap: 2}}><T size={9} color={c.muted} style={{flex: 1}}>{f.name}</T><Pressable
          accessibilityRole="button" accessibilityLabel={t('Xoá')} onPress={() => { setPicked(p => p.filter((_, idx) => idx !== i));
            if (preview?.uri === f.uri) setPreview(null); }} style={{padding: 3}}><Icon name="close" size={14} color={c.muted}/></Pressable></Row></View>)}</View> : null}
        <Row><View style={{flex: 1}}><Button label={t('Chụp ảnh')} kind="secondary" icon="camera-outline"
                                             onPress={captureImage}/></View><View style={{flex: 1}}><Button
          label={t('Thư viện ảnh')} kind="secondary" icon="images-outline" onPress={pickImages}/></View></Row><Button
          label={t('Tạo lô nhập')} icon="cloud-upload-outline" onPress={upload} loading={uploading}
          disabled={!picked.length}/><Button label={t('Nhập giao dịch thủ công')} kind="secondary" icon="create-outline"
                                             onPress={() => go('manual-transaction')}/></Card>
    </> : <>
      <Section title={t('2. Trạng thái lô nhập')}/><Card><Row><T size={11}
                                                                 style={{flex: 1}}>{t('Trạng thái lô:')}</T><Badge>{t(batchStatusLabels[batch.status])}</Badge></Row><Info>{t('Ảnh đã được AI trích xuất xong. Bạn có thể kiểm tra và xác nhận bên dưới.')}</Info>
      <Row style={{gap: 5}}>{[{label: t('Phát hiện'), value: batch.summary.detected}, {
        label: t('Cần duyệt'),
        value: batch.summary.review
      }, {label: t('Thêm mới'), value: batch.summary.inserted}, {
        label: t('Cập nhật'),
        value: batch.summary.updated
      }, {label: t('Lỗi'), value: batch.summary.failed}].map(item => <View key={item.label} style={{
        flex: 1,
        padding: 7,
        backgroundColor: c.elevated,
        borderRadius: 20,
        alignItems: 'center'
      }}><T size={8} color={c.muted}>{item.label}</T><T size={15} bold color={c.primary}>{item.value}</T></View>)}</Row>
      {batch.files.map(f => <Row key={f.attachmentId}><Icon name="image-outline"/><T size={12}
                                                                                     style={{flex: 1}}>{f.originalName}</T><Badge
        tone={f.status === 'FAILED' ? 'error' : f.status === 'READY' || f.status === 'CONFIRMED' ? 'success' : 'primary'}>{t(fileStatusLabels[f.status])}</Badge>{f.status === 'FAILED' ? <>
        <Pressable accessibilityRole="button" onPress={() => review.retryFile(f.attachmentId)} style={{padding: 8}}><T
          size={11} color={c.primary}>{t('Thử lại')}</T></Pressable><Pressable accessibilityRole="button"
                                                                               onPress={() => go('manual-transaction', {accountId: String(batch.accountId)})}
                                                                               style={{padding: 8}}><T size={11}
                                                                                                       color={c.primary}>{t('Nhập thủ công')}</T></Pressable></> : null}
      </Row>)}
      <Button label={t('Mở hàng đợi AI')} kind="secondary" icon="hourglass-outline" onPress={() => go('queue')}/>
    </Card>
      <Section title={t('3. Duyệt và chỉnh sửa')}/><T size={11}
                                                      color={c.muted}>{t('Kiểm tra thông tin trước khi xác nhận. Hệ thống sẽ kiểm tra trùng lặp lần nữa khi lưu.')}</T>
      {items.length ? items.map(it => <ImportItemCard key={it.itemId} item={review.effective(it.itemId)!}/>) :
        <Empty title={t('Đã xử lý hết bản ghi')} description={t('Tạo lô mẫu mới hoặc mở lịch sử để xem kết quả.')}
               action={t('Xem lịch sử')} onPress={() => go('history')}/>}
      <Button label={t('Bắt đầu lô nhập mới')} kind="secondary" onPress={() => review.clear()}/>
      <Dialog visible={confirmOpen} title={t('Ghi nhận giao dịch mẫu?')}
              message={t('Các mục hợp lệ sẽ được lưu vào lịch sử. Mục xung đột tiếp tục được giữ để xử lý.')}
              onClose={() => setConfirmOpen(false)} onConfirm={doConfirm}/>
    </>}{preview ? <Modal visible transparent animationType="fade" onRequestClose={() => setPreview(null)}><View style={{flex: 1,
      backgroundColor: 'rgba(0,0,0,0.9)', padding: 20, justifyContent: 'center', alignItems: 'center'}}><Pressable
      accessibilityRole="button" accessibilityLabel={t('Đóng')} onPress={() => setPreview(null)} style={{position: 'absolute',
        top: 45, right: 18, padding: 10, zIndex: 1}}><Icon name="close" size={28} color={c.text}/></Pressable><Image
      source={{uri: preview.uri}} style={{width: '100%', height: '75%'}} resizeMode="contain"/><T size={12} color={c.text}
      style={{marginTop: 12, textAlign: 'center'}}>{preview.name}</T></View></Modal> : null}{dialog}
  </Screen>;
}

export function Queue({attachmentId}: { attachmentId?: string }) {
  const api = useInvestmentApi();
  const t = useT();
  const {colors: c} = useTheme();
  const review = useImportReview();
  const {notify, dialog} = useNotice();
  const [filter, setFilter] = useState<'all' | AttachmentAiStatus>('all');
  const [accountFilter, setAccountFilter] = useState('all');
  const [jobs, setJobs] = useState<InvestmentAiJobResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancelId, setCancelId] = useState<number | null>(null);
  const [runningIds, setRunningIds] = useState<number[]>([]);

  const jobStatuses: AttachmentAiStatus[] = ['PENDING', 'PROCESSING', 'READY', 'FAILED', 'CANCELLED', 'CONFIRMED'];
  const load = useCallback(() => {
    api.listAllAiJobs(filter === 'all' ? jobStatuses : [filter]).then(setJobs).catch(e => notify(t(errorMessage(e)))).finally(() => setLoading(false));
  }, [filter]);
  useFocusEffect(useCallback(() => {
    load();
  }, [load]));
  useEffect(() => {
    if (!jobs.some(j => j.status === 'PENDING' || j.status === 'PROCESSING')) return;
    const timer = setInterval(load, 4000);
    return () => clearInterval(timer);
  }, [jobs, load]);

  const focusedAttachmentId = Number(attachmentId);
  const accountOptions = [...new Map(jobs.flatMap(job => job.reviewTargets.map(target => [String(target.accountId), target.accountName] as const))).entries()];
  const shownJobs = jobs
    .filter(job => accountFilter === 'all' || job.reviewTargets.some(target => String(target.accountId) === accountFilter))
    .sort((left, right) => (left.attachmentId === focusedAttachmentId ? -1 : right.attachmentId === focusedAttachmentId ? 1 : 0));

  async function run(id: number) {
    setRunningIds(r => [...r, id]);
    try {
      await api.runAiJob(id);
      await new Promise(r => setTimeout(r, 500));
      load();
    } catch (e) {
      notify(t(errorMessage(e)));
    } finally {
      setRunningIds(r => r.filter(x => x !== id));
    }
  }

  async function cancel() {
    if (cancelId == null) return;
    try {
      await api.cancelAiJob(cancelId);
      load();
    } catch (e) {
      notify(t(errorMessage(e)));
    } finally {
      setCancelId(null);
    }
  }

  async function openReview(job: InvestmentAiJobResponse) {
    const target = job.reviewTargets[0];
    if (!target) {
      notify(t('Chưa có lô nhập để duyệt.'));
      return;
    }
    try {
      await review.loadBatch(target.accountId, target.batchId);
      go('import');
    } catch (e) {
      notify(t(errorMessage(e)));
    }
  }

  const action = (label: string, onPress: () => void, primary = false, disabled = false) => <Pressable key={label}
                                                                                                       accessibilityRole="button"
                                                                                                       accessibilityState={{disabled}}
                                                                                                       disabled={disabled}
                                                                                                       onPress={onPress}
                                                                                                       style={{
                                                                                                         flex: 1,
                                                                                                         minWidth: 86,
                                                                                                         minHeight: 36,
                                                                                                         paddingHorizontal: 8,
                                                                                                         paddingVertical: 9,
                                                                                                         backgroundColor: primary ? c.primary : c.elevated,
                                                                                                         borderRadius: 24,
                                                                                                         opacity: disabled ? 0.5 : 1,
                                                                                                         justifyContent: 'center',
                                                                                                         alignItems: 'center'
                                                                                                       }}><T size={10}
                                                                                                             bold
                                                                                                             color={primary ? c.ink : c.muted}
                                                                                                             style={{textAlign: 'center'}}>{label}</T></Pressable>;

  return <Screen title={t('Hàng đợi AI')} back><InvestmentNav active="queue"/><Row
    style={{justifyContent: 'space-between'}}><T size={21}
                                                 bold>{t('Hàng đợi AI')}</T><Badge>• {t('Tự cập nhật')}</Badge></Row>
    <Chips value={filter} onChange={v => setFilter(v as 'all' | AttachmentAiStatus)}
           values={[{label: t('Tất cả trạng thái'), value: 'all'}, ...jobStatuses.map(value => ({
             value,
             label: t('{{label}} ({{n}})', {
               label: t(jobStatusLabels[value]),
               n: shownJobs.filter(j => j.status === value).length
             })
           }))]}/>
    {accountOptions.length > 1 ? <><T size={10} color={c.muted}>{t('Lọc theo tài khoản')}</T><Chips
      value={accountFilter} onChange={setAccountFilter}
      values={[{value: 'all', label: t('Tất cả tài khoản')}, ...accountOptions.map(([value, label]) => ({
        value,
        label
      }))]}/></> : null}
    {loading ? <ActivityIndicator color={c.primary}/> : shownJobs.length ? shownJobs.map(j => <Card key={j.attachmentId}
                                                                                                    style={{
                                                                                                      borderWidth: 1,
                                                                                                      borderColor: j.attachmentId === focusedAttachmentId ? c.primary : j.status === 'READY' ? '#214b46' : j.status === 'FAILED' ? '#63343e' : c.border,
                                                                                                      gap: 16
                                                                                                    }}>
      <Row><Icon name={j.status === 'PENDING' ? 'hourglass-outline' : 'document-text-outline'}
                 color={j.status === 'READY' ? c.success : c.primary}/><View style={{flex: 1}}><T size={12}
                                                                                                  bold>{j.originalName}</T><T
        size={10} color={c.muted}>#{j.attachmentId} • {(j.size / 1024).toFixed(0)} KB</T>{j.reviewTargets.length ?
        <T size={9}
           color={c.muted}>{t('Account')}: {j.reviewTargets.map(target => target.accountName).filter((name, index, names) => names.indexOf(name) === index).join(', ')}</T> : null}
      </View><View style={{maxWidth: '36%'}}><Badge
        tone={j.status === 'FAILED' ? 'error' : j.status === 'READY' || j.status === 'CONFIRMED' ? 'success' : 'primary'}>{t(jobStatusLabels[j.status]).toUpperCase()}</Badge></View></Row>
      <Row><View style={{flex: 1}}><T size={10} color={c.muted}>{t('Số lần chạy')}</T><T
        size={12}>{j.attemptCount} / {j.maxAttempts}</T></View><View style={{alignItems: 'flex-end'}}><T size={10}
                                                                                                         color={c.muted}>{t('Thời gian tạo')}</T><T
        size={11}>{dateLabel(j.createdAt)}</T></View></Row>{j.reviewTargets.length ?
      <Row><T size={10} color={c.muted} style={{flex: 1}}>{t('Bản ghi cần duyệt')}</T><T size={11} color={c.primary}
                                                                                         bold>{j.reviewTargets.reduce((sum, target) => sum + target.pendingItemCount, 0)}</T></Row> : null}{j.model ?
      <T size={9} color={c.muted}>{t('Model AI')}: {j.model}</T> : null}
      {j.status === 'PROCESSING' ? <><Progress value={60}/><T size={11}
                                                              color={c.primary}>⟳ {t('Đang trích xuất dữ liệu và chuẩn hóa…')}</T></> : null}{j.status === 'READY' && j.completedAt ?
      <Row><T size={10} color={c.muted} style={{flex: 1}}>{t('Thời gian hoàn tất')}</T><T size={10}
                                                                                          color={c.success}>{dateLabel(j.completedAt)}</T></Row> : null}{j.status === 'FAILED' ?
      <Info
        tone="error">{j.error ? t(errorMessageForCode(j.error)) : t('Ảnh bị mờ hoặc không nhận diện được hóa đơn hợp lệ.')}</Info> : null}
      <Row style={{
        gap: 6,
        flexWrap: 'wrap'
      }}>{action(t('Chi tiết'), () => go('ai-job-detail', {id: String(j.attachmentId)}))}{action(t('Xem ảnh'), () => go('source', {id: String(j.attachmentId)}))}{j.status === 'READY' ? <>{action(t('Kết quả AI'), () => go('ai-result', {id: String(j.attachmentId)}))}{action(t('Duyệt & Xác nhận →'), () => openReview(j), true)}</> : j.status === 'CONFIRMED' ? action(t('Xem lịch sử'), () => go('history')) : j.status === 'CANCELLED' ? null : j.status === 'FAILED' ? <>{action(t('Thử lại'), () => run(j.attachmentId), false, runningIds.includes(j.attachmentId) || !j.canRun)}{action(t('Nhập thủ công'), () => go('manual-transaction', j.reviewTargets[0]?.accountId ? {accountId: String(j.reviewTargets[0].accountId)} : {}), true)}</> : action(j.status === 'PROCESSING' ? t('Đang xử lý…') : t('Chạy công việc'), () => run(j.attachmentId), false, runningIds.includes(j.attachmentId) || j.status === 'PROCESSING' || !j.canRun)}</Row>
      {j.canCancel ? <Pressable accessibilityRole="button" accessibilityLabel={t('Hủy công việc')}
                                onPress={() => setCancelId(j.attachmentId)} style={{alignSelf: 'flex-end', padding: 8}}><T
        size={11} color={c.error}>⊗ {t('Hủy công việc')}</T></Pressable> : null}
    </Card>) : <Empty title={t('Không có công việc phù hợp')}/>}
    <Info>{t('Cơ chế xử lý ảnh độc lập. AI xử lý bất đồng bộ theo từng ảnh độc lập. Bạn có thể rời màn hình và quay lại sau mà không làm gián đoạn tiến trình.')}</Info>
    <Dialog visible={!!cancelId} title={t('Hủy công việc đang chờ?')}
            message={t('Chứng từ mẫu sẽ giữ trạng thái đã hủy.')} onClose={() => setCancelId(null)}
            onConfirm={cancel}/>{dialog}
  </Screen>;
}

export function SourceImage({id, admin = false}: { id: string; admin?: boolean }) {
  const attachmentId = Number(id);
  const api = useInvestmentApi();
  const {authHeader} = useAuth();
  const t = useT();
  const {colors: c} = useTheme();
  const [zoom, setZoom] = useState(1);
  const [job, setJob] = useState<InvestmentAiJobResponse | null>(null);
  useEffect(() => {
    (admin ? api.getAdminAiJob(attachmentId) : api.getAiJob(attachmentId)).then(setJob).catch(() => setJob(null));
  }, [attachmentId, admin]);
  if (job && !job.contentAvailable) return <Screen title={job.originalName} back><Empty
    title={t('Ảnh gốc đã bị xóa khỏi hệ thống lưu trữ.')}
    description={t('Ảnh không còn khả dụng để xem lại, nhưng lịch sử AI và transaction đã ghi nhận vẫn được giữ riêng.')}/></Screen>;
  return <Screen title={job?.originalName || t('Ảnh nguồn chứng từ')} back><Badge>• {t('4K HIGH-RES SOURCE')}</Badge>
    <View style={{minHeight: 300, justifyContent: 'center', overflow: 'hidden'}}><Image
      source={{uri: admin ? adminAiJobContentUri(attachmentId) : aiJobContentUri(attachmentId), headers: authHeader()}}
      resizeMode="contain" style={{width: '100%', height: 280 * zoom, borderRadius: 16}}/></View>
    <Row><T size={11} color={c.muted} style={{flex: 1}}>⌕ {Math.round(zoom * 100)}%</T><Pressable
      accessibilityRole="button" accessibilityLabel={t('Thu nhỏ')} onPress={() => setZoom(v => Math.max(0.5, v - 0.25))}
      style={{padding: 12}}><Icon name="remove" size={18}/></Pressable><Pressable accessibilityRole="button"
                                                                                  accessibilityLabel={t('Vừa khung')}
                                                                                  onPress={() => setZoom(1)}
                                                                                  style={{padding: 12}}><T
      size={11}>{t('Fit')}</T></Pressable><Pressable accessibilityRole="button" accessibilityLabel={t('Phóng to')}
                                                     onPress={() => setZoom(v => Math.min(3, v + 0.25))}
                                                     style={{padding: 12}}><Icon name="add"
                                                                                 size={18}/></Pressable></Row>
    <Card><Row><Icon name="document-lock-outline"/><View style={{flex: 1}}><T bold>{t('Thông số chứng từ')}</T><T
      size={10}
      color={c.muted}>{t('Khối dữ liệu tự động đồng bộ')}</T></View><Badge>{t('Khả dụng')}</Badge></Row><Row><Metric
      label={t('ĐỊNH DẠNG & KÍCH THƯỚC')}
      value={`${job?.mimeType?.split('/')[1]?.toUpperCase() || 'IMG'} • ${job ? (job.size / 1024).toFixed(0) + ' KB' : '—'}`}/><Metric
      label={t('THỜI GIAN TẢI LÊN')}
      value={job ? dateLabel(job.createdAt) : '—'}/></Row><Info>{t('Glacier Vault Encrypted Storage • SHA-256 • Mã hóa tệp')}</Info><Row><View
      style={{flex: 1}}><Button label={t('Đóng')} kind="secondary" onPress={() => router.back()}/></View><View
      style={{flex: 2}}><Button label={t('Kết quả AI chuẩn hóa')}
                                disabled={!job || !['READY', 'CONFIRMED'].includes(job.status)}
                                onPress={() => go(admin ? 'admin-ai-result' : 'ai-result', {id})}/></View></Row></Card></Screen>;
}

export function AiResult({id, admin = false}: { id: string; admin?: boolean }) {
  const attachmentId = Number(id);
  const api = useInvestmentApi();
  const t = useT();
  const {lang} = useLanguage();
  const {colors: c} = useTheme();
  const review = useImportReview();
  const {notify, dialog} = useNotice();
  const [job, setJob] = useState<InvestmentAiJobResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState('visual');
  useEffect(() => {
    (admin ? api.getAdminAiJob(attachmentId) : api.getAiJob(attachmentId)).then(setJob).catch(() => setJob(null)).finally(() => setLoading(false));
  }, [attachmentId, admin]);
  if (loading) return <Screen title={t('Kết quả AI chuẩn hóa')} back><ActivityIndicator color={c.primary}/></Screen>;
  const drafts: AiTransactionDraftResponse[] = job?.detectedJson?.transactions || [];
  const ready = job && (job.status === 'READY' || job.status === 'CONFIRMED');

  async function toReview() {
    const target = job?.reviewTargets[0];
    if (!target) {
      notify(t('Chưa có lô nhập để duyệt.'));
      return;
    }
    try {
      await review.loadBatch(target.accountId, target.batchId);
      go('import');
    } catch (e) {
      notify(t(errorMessage(e)));
    }
  }

  return <Screen title={t('Kết quả AI chuẩn hóa')} back><T size={12}
                                                           color={c.muted}>{job?.originalName || t('Không tìm thấy công việc')}</T>{ready ? <>
    <Chips value={mode} onChange={setMode} values={[{label: t('Bản trực quan dễ đọc'), value: 'visual'}, {
      label: t('Mã JSON chuẩn hóa'),
      value: 'json'
    }]}/>
    <Card><Row><Icon name="scan-outline" size={30}/><View style={{flex: 1}}><T size={13} color={c.primary}
                                                                               bold>{t('TÓM TẮT TIẾN TRÌNH')}</T><T
      size={15} bold>{t('Trích xuất thành công {{n}} giao dịch độc lập từ 1 ảnh chứng từ.', {n: drafts.length})}</T><T
      size={11}
      color={c.muted}>{t('{{n}} bản ghi riêng biệt • Cấu trúc hoàn chỉnh', {n: drafts.length})}</T>{job.model ?
      <T size={9} color={c.muted}>{t('Model AI')}: {job.model}</T> : null}
    </View><Badge>{t('Sẵn sàng')}</Badge></Row></Card>
    {mode === 'visual' ? drafts.map((d, i) => <Card key={i} style={{gap: 10}}><Row><T size={13} bold
                                                                                      style={{flex: 1}}>{d.transactionType ? t(typeLabels[d.transactionType]) : t('Chưa xác định')}</T><T
        size={13} bold
        color={d.transactionType === 'BONUS' ? c.lavender : c.primary}>{d.amount == null ? '—' : `${d.transactionType === 'WITHDRAWAL' ? '−' : '+'}${money(d.amount, d.currency || undefined, lang)}`}</T></Row><Row><Badge
        tone={d.transactionStatus === 'COMPLETED' ? 'success' : d.transactionStatus ? 'warning' : 'error'}>{d.transactionStatus ? t(statusLabels[d.transactionStatus]) : t('Cần kiểm tra')}</Badge>{d.transactionAt ?
        <T size={10} color={c.muted}>{dateLabel(d.transactionAt)}</T> :
        <T size={10} color={c.error}>{t('Thiếu thời gian giao dịch')}</T>}</Row><T size={11}
                                                                                   color={c.muted}>{d.description || '—'}</T>{d.confidence != null ?
        <T size={10}
           color={c.muted}>{t('Độ tin cậy')}: {(d.confidence * 100).toFixed(0)}%</T> : null}{d.uncertainFields?.length ?
        <Info
          tone="warning">{t('Trường cần kiểm tra')}: {d.uncertainFields.join(', ')}</Info> : null}{d.validationWarnings?.length ?
        <Info tone="warning">{t('Cảnh báo chuẩn hóa')}: {d.validationWarnings.join(', ')}</Info> : null}</Card>) :
      <Card><T size={12}>{JSON.stringify(drafts, null, 2)}</T></Card>}
    <Button label={t('Xem ảnh gốc')} kind="secondary"
            onPress={() => go(admin ? 'admin-source' : 'source', {id})}/>{!admin ?
    <Button label={t('Chuyển đến duyệt & xác nhận')} onPress={toReview}/> : null}
  </> : <Empty title={t('Kết quả chưa sẵn sàng')} action={t('Mở hàng đợi')} onPress={() => go('queue')}/>}{dialog}
  </Screen>;
}

export function DraftEdit({id}: { id: string }) {
  const {effective, setOverride} = useImportReview();
  const t = useT();
  const {colors: c} = useTheme();
  const item = effective(id);
  const [amount, setAmount] = useState(String(item?.amount ?? ''));
  const [date, setDate] = useState(item?.transactionAt ? item.transactionAt.slice(0, 16) : '');
  const [externalId, setExternalId] = useState(item?.externalTransactionId || '');
  const [description, setDescription] = useState(item?.description || '');
  const [error, setError] = useState('');
  if (!item) return <Screen title={t('Chỉnh sửa bản ghi')} back><Empty
    title={t('Bản ghi đã xử lý hoặc không tồn tại')}/></Screen>;

  function save() {
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0) {
      setError(t('Số tiền phải lớn hơn 0.'));
      return;
    }
    if (!validDate(date, true)) {
      setError(t('Thời gian phải có dạng YYYY-MM-DDTHH:mm.'));
      return;
    }
    setOverride(id, {
      amount: n,
      transactionAt: new Date(date + ':00Z').toISOString(),
      externalTransactionId: externalId,
      description
    });
    router.back();
  }

  return <Screen title={t('Chỉnh sửa bản ghi giao dịch')} back sheet
                 footer={<Button label={t('Áp dụng chỉnh sửa')} onPress={save}/>}>
    <Badge>{t('BẢN NHÁP · CHƯA GHI SỔ')}</Badge>{item.processingAction === 'REVIEW' ? <Info
    tone="warning">{t('Giao dịch có khả năng trùng. Chọn cách xử lý phù hợp trước khi xác nhận.')}</Info> : null}{error ?
    <Info tone="error">{error}</Info> : null}
    <Field label={t('Ngày giờ giao dịch')} value={date} onChangeText={setDate} hint="YYYY-MM-DDTHH:mm"/>
    <Chips value={item.transactionType || ''}
           values={(['DEPOSIT', 'WITHDRAWAL', 'BONUS'] as InvestmentTransactionType[]).map(v => ({
             value: v,
             label: t(typeLabels[v])
           }))} onChange={v => setOverride(id, {transactionType: v as InvestmentTransactionType})}/>
    <Field label={t('Số tiền')} keyboardType="numeric" value={amount} onChangeText={setAmount}/>
    <Chips value={item.transactionStatus || ''}
           values={(['COMPLETED', 'PENDING'] as InvestmentTransactionStatus[]).map(v => ({
             value: v,
             label: t(statusLabels[v])
           }))} onChange={v => setOverride(id, {transactionStatus: v as InvestmentTransactionStatus})}/>
    <Field label={t('Mã giao dịch bên ngoài')} value={externalId} onChangeText={setExternalId}/>
    <Field label={t('Mô tả')} value={description} multiline maxLength={1000} onChangeText={setDescription}/>
    <Card><T bold>{t('Cách xử lý đang chọn')}</T><T
      color={c.primary}>{item.resolution ? t(resolutionLabels[item.resolution]) : t('Cần duyệt')}</T><Button
      label={t('Thay đổi cách xử lý')} kind="secondary" onPress={() => go('decision', {id})}/></Card>
    <Info>{t('Áp dụng chỉ cập nhật bản nháp, chưa ghi giao dịch vào lịch sử.')}</Info>
  </Screen>;
}

export function DecisionScreen({id}: { id: string }) {
  const {effective, setOverride} = useImportReview();
  const t = useT();
  const {lang} = useLanguage();
  const {colors: c} = useTheme();
  const item = effective(id);
  const [decision, setDecision] = useState<InvestmentImportResolution>(item?.resolution || 'ACCEPT');
  const notes: Record<InvestmentImportResolution, string> = {
    ACCEPT: 'Lưu bản ghi nếu không còn phát hiện xung đột.',
    MERGE_EXISTING: 'Giữ giao dịch hiện có, bổ sung mô tả và trạng thái. Không cộng tiền lần nữa.',
    SAVE_AS_NEW: 'Chọn khi đây thực sự là một giao dịch khác. Mã giao dịch bên ngoài vẫn phải không trùng.',
    SKIP: 'Không ghi bản ghi này vào lịch sử.'
  };
  if (!item) return <Screen title={t('Cách xử lý giao dịch')} back><Empty
    title={t('Bản ghi đã xử lý hoặc không tồn tại')}/></Screen>;
  return <Screen title={t('Cách xử lý giao dịch')} back sheet
                 footer={<Button label={t('Áp dụng cách xử lý')} onPress={() => {
                   setOverride(id, {resolution: decision, selected: decision !== 'SKIP'});
                   router.back();
                 }}/>}>
    <T size={12} color={c.muted}>{t('Chọn phương án xử lý cho bản ghi giao dịch')}</T><T
    color={c.muted}>{item.amount != null ? money(item.amount, item.currency || undefined, lang) : t('Không tìm thấy bản ghi')}</T>
    {(Object.keys(resolutionLabels) as InvestmentImportResolution[]).map(key => <Pressable key={key}
                                                                                           accessibilityRole="radio"
                                                                                           aria-checked={key === decision}
                                                                                           accessibilityState={{selected: key === decision}}
                                                                                           onPress={() => setDecision(key)}><Card
      style={{
        borderWidth: key === decision ? 1 : 0,
        borderColor: key === decision ? '#335872' : c.border,
        backgroundColor: key === decision ? '#0e3044' : c.surface
      }}><Row><Icon name={key === decision ? 'radio-button-on' : 'radio-button-off'}/><T bold
                                                                                         style={{flex: 1}}>{t(resolutionLabels[key])}</T></Row><T
      size={13} color={c.muted}>{t(notes[key])}</T></Card></Pressable>)}
    <Info>{t('Quyết định có hiệu lực khi bạn xác nhận tại màn duyệt.')}</Info>
  </Screen>;
}

export function ConfirmationResult({partial}: { partial: boolean }) {
  const {batch, lastResult, clear} = useImportReview();
  const t = useT();
  const {lang} = useLanguage();
  const {colors: c} = useTheme();
  const r = lastResult ?? {inserted: 0, updated: 0, skipped: 0, failed: 0, results: []};

  function itemFor(itemId: string) {
    return batch?.transactions.find(tx => tx.itemId === itemId);
  }

  return <Screen title={t('Kết quả xác nhận')}
                 subtitle={batch ? `#${batch.batchId.slice(0, 8).toUpperCase()}` : undefined} back>
    <Card tint style={{alignItems: partial ? 'flex-start' : 'center', paddingVertical: 24}}><Icon
      name={partial ? 'warning-outline' : 'checkmark-circle'} size={partial ? 32 : 58}
      color={partial ? c.error : c.primary}/><Badge
      tone={partial ? 'error' : 'primary'}>{partial ? t('YÊU CẦU CAN THIỆP') : t('Mục 5.4 • Hoàn tất 100%')}</Badge><T
      size={20} bold
      style={{textAlign: partial ? 'left' : 'center'}}>{partial ? t('Xác nhận thành công một phần') : t('Xác nhận thành công toàn bộ')}</T><T
      size={12} color={c.muted}
      style={{textAlign: partial ? 'left' : 'center'}}>{partial ? t('Một số bản ghi đã được ghi nhận, tuy nhiên vẫn còn bản ghi phát sinh xung đột hoặc cần xử lý thêm trước khi hoàn tất.') : t('Tất cả các bản ghi đã được ghi nhận vào sổ giao dịch độc lập của tài khoản đầu tư.')}</T></Card>
    <Section title={t('Chỉ số đối soát sau xác nhận')}/><Row><Metric label={t('Thêm mới')}
                                                                     value={String(r.inserted).padStart(2, '0')}/><Metric
    label={t('Cập nhật')} value={String(r.updated).padStart(2, '0')}/></Row><Row><Metric label={t('Bỏ qua')}
                                                                                         value={String(r.skipped).padStart(2, '0')}/><Metric
    label={partial ? t('Cần xử lý / Lỗi') : t('Lỗi ghi nhận')} value={String(r.failed).padStart(2, '0')}
    color={r.failed ? c.error : c.primary}/></Row>
    {partial ?
      <Info>{t('Bản ghi lỗi vẫn được giữ lại trong lô để bạn tiếp tục điều chỉnh cách xử lý. Các bản ghi hợp lệ đã được chuyển vào lịch sử giao dịch.')}</Info> : null}<Section
    title={partial ? t('Chi tiết kết quả theo bản ghi') : t('Danh sách bản ghi tóm tắt')}/>
    {r.results.map((res, i) => {
      const item = itemFor(res.itemId);
      return <Card key={res.itemId} style={{gap: 10}}><Row><Badge>#{String(i + 1).padStart(2, '0')}</Badge><T size={13}
                                                                                                              bold
                                                                                                              style={{flex: 1}}>{item?.transactionType ? t(typeLabels[item.transactionType]) : '—'}</T><Badge
        tone={res.result === 'FAILED' ? 'error' : res.result === 'SKIPPED' ? 'muted' : 'primary'}>{res.result === 'FAILED' ? t('Lỗi xác nhận') : res.result === 'SKIPPED' ? t('Đã bỏ qua') : res.result === 'UPDATED' ? t('Đã cập nhật') : t('Đã ghi nhận mới')}</Badge></Row>{item ?
        <Row><T size={10} color={c.muted}
                style={{flex: 1}}>{item.transactionAt ? dateLabel(item.transactionAt) : ''}</T>{item.amount != null ?
          <T size={15} bold
             color={item.transactionType === 'BONUS' ? c.lavender : c.primary}>{item.transactionType === 'WITHDRAWAL' ? '−' : '+'}{money(item.amount, item.currency || undefined, lang)}</T> : null}
        </Row> : null}{res.result === 'FAILED' ? <><Info
        tone="error">{t(errorMessageForCode(res.errorCode))}</Info><Pressable accessibilityRole="button"
                                                                              onPress={() => go('draft-edit', {id: res.itemId})}
                                                                              style={{padding: 8}}><T size={11}
                                                                                                      color={c.primary}>{t('Khắc phục xung đột ›')}</T></Pressable></> : null}
      </Card>;
    })}
    {!partial ?
      <Info>{t('Dữ liệu giao dịch đầu tư được lưu độc lập để theo dõi và đối soát, không làm thay đổi số dư thực tế hoặc số dư tại tài khoản.')}</Info> : null}
    <Button label={t('Xem lịch sử giao dịch')} kind={partial ? 'secondary' : 'primary'} icon="time-outline"
            onPress={() => {
              clear();
              go('history');
            }}/>
    <Row><View style={{flex: 1}}><Button label={t('Tạo lô nhập mới')} kind="secondary" onPress={() => {
      clear();
      go('import');
    }}/></View><View style={{flex: 1}}><Button label={t('Về Đầu tư')} kind="secondary" onPress={() => {
      clear();
      router.replace('/investment');
    }}/></View></Row>
  </Screen>;
}
