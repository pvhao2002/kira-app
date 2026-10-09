import React, {useEffect, useState} from 'react';
import {ActivityIndicator, Pressable, View} from 'react-native';
import {ApiError, useAuth} from './auth';
import type {PageResponse} from './investmentApi';
import {dateLabel} from './data';
import {useT} from './i18n';
import {useTheme} from './theme';
import {Badge, Button, Card, Empty, Field, Info, Metric, Row, Screen, Section, T, useNotice} from './ui';

type AdminUser = { id: number; fullName: string; email: string; phone: string | null; roles: string[]; status: string };
type VisitPage<T> = { items: T[]; total: number; page: number; size: number };
type IpRow = { ip: string; views: number; reloads: number; visitors: number; sessions: number; firstSeen: string; lastSeen: string };
type VisitReport = { totals: { views: number; reloads: number; ips: number; visitors: number }; ips: VisitPage<IpRow>; retentionDays: number };
type Visit = {
  id: string; visitedAt: string; ip: string; ipSource: string; visitorId: string; sessionId: string; navigation: string;
  userAgent: string; language: string; timezone: string; screenWidth: number; screenHeight: number; referrer: string;
};

const qs = (params: Record<string, string | number>) => new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])).toString();
const isAdmin = (roles?: string[]) => !!roles?.includes('ADMIN');

function AdminOnly() {
  const t = useT();
  return <Screen title={t('Quản trị')} back><Info tone="error">{t('Chỉ quản trị viên được truy cập màn này.')}</Info></Screen>;
}

export function AdminUsers() {
  const {requestJson, session} = useAuth();
  const t = useT();
  const {colors: c} = useTheme();
  const {notify, dialog} = useNotice();
  const [search, setSearch] = useState('');
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState<{ fullName: string; email: string; phone: string; password: string; confirm: string } | null>(null);
  const [saving, setSaving] = useState(false);

  function load(nextPage: number) {
    setLoading(true);
    requestJson<PageResponse<AdminUser>>(`/api/v1/admin/users?${qs({page: nextPage, size: 20, search: search.trim()})}`).then(result => {
      setUsers(current => nextPage ? [...current, ...result.data] : result.data);
      setPage(nextPage);
      setTotalPages(result.meta.totalPages);
      setError('');
    }).catch(() => setError(t('Không tải được danh sách người dùng.'))).finally(() => setLoading(false));
  }

  useEffect(() => {
    if (isAdmin(session?.user.roles)) load(0);
  }, []);
  if (!isAdmin(session?.user.roles)) return <AdminOnly/>;

  async function save() {
    if (!form) return;
    const email = form.email.trim();
    if (!form.fullName.trim() || form.fullName.length > 150) return setError(t('Nhập họ tên (tối đa 150 ký tự).'));
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setError(t('Email không hợp lệ.'));
    if (form.phone.length > 30) return setError(t('Số điện thoại tối đa 30 ký tự.'));
    if (!form.password.trim() || form.password.length < 8 || form.password.length > 72) return setError(t('Mật khẩu cần 8–72 ký tự.'));
    if (form.password !== form.confirm) return setError(t('Mật khẩu xác nhận không khớp.'));
    setSaving(true);
    setError('');
    try {
      await requestJson('/api/v1/admin/users', {
        method: 'POST',
        body: JSON.stringify({fullName: form.fullName.trim(), email, phone: form.phone.trim() || null, password: form.password})
      });
      setForm(null);
      setSearch('');
      notify(t('Đã tạo người dùng.'));
      load(0);
    } catch (e) {
      setError(t(e instanceof ApiError && e.code === 'EMAIL_EXISTS' ? 'Email đã tồn tại.'
        : e instanceof ApiError && e.status === 403 ? 'Bạn không có quyền thực hiện thao tác này.' : 'Không tạo được người dùng.'));
    } finally {
      setSaving(false);
    }
  }

  if (form) {
    const set = (patch: Partial<typeof form>) => setForm(current => current && {...current, ...patch});
    return <Screen title={t('Tạo người dùng')} back
                   footer={<Row><View style={{flex: 1}}><Button label={t('Hủy')} kind="secondary"
                                                                onPress={() => setForm(null)} disabled={saving}/></View><View
                     style={{flex: 2}}><Button label={t('Tạo tài khoản')} icon="person-add-outline"
                                               onPress={() => void save()} loading={saving}/></View></Row>}>
      {error ? <Info tone="error">{error}</Info> : null}
      <Card tint>
        <Field label={t('Họ tên *')} value={form.fullName} onChangeText={value => set({fullName: value})}/>
        <Field label={t('Email *')} value={form.email} onChangeText={value => set({email: value})} autoCapitalize="none"
               keyboardType="email-address"/>
        <Field label={t('Số điện thoại')} value={form.phone} onChangeText={value => set({phone: value})}
               keyboardType="phone-pad"/>
        <Field label={t('Mật khẩu *')} value={form.password} onChangeText={value => set({password: value})}
               secureTextEntry autoCapitalize="none"/>
        <Field label={t('Xác nhận mật khẩu *')} value={form.confirm} onChangeText={value => set({confirm: value})}
               secureTextEntry autoCapitalize="none"/>
      </Card>
    </Screen>;
  }

  return <Screen title={t('Quản lý người dùng')} subtitle={t('Tìm kiếm và tạo tài khoản')} back>
    <Button label={t('Tạo người dùng')} icon="person-add-outline" onPress={() => {
      setError('');
      setForm({fullName: '', email: '', phone: '', password: '', confirm: ''});
    }}/>
    <Field label={t('Tìm người dùng')} value={search} onChangeText={setSearch} returnKeyType="search"
           onSubmitEditing={() => load(0)} autoCapitalize="none" placeholder={t('Tên, email hoặc số điện thoại')}/>
    {error ? <Info tone="error">{error}</Info> : null}
    {loading && !users.length ? <ActivityIndicator color={c.primary}/> : users.length ? users.map(user => <Card
      key={user.id}><Row><View style={{flex: 1}}><T size={14} bold>{user.fullName}</T><T size={11}
                                                                                         color={c.muted}>{user.email}{user.phone ? ` · ${user.phone}` : ''}</T></View><Badge
      tone={user.status === 'ACTIVE' ? 'success' : 'muted'}>{user.status}</Badge></Row><T size={10}
                                                                                          color={c.muted}>{user.roles.join(', ')}</T></Card>) :
      <Empty title={t('Không có người dùng')}/>}
    {page + 1 < totalPages ? <Button label={t('Tải thêm')} kind="secondary" loading={loading} onPress={() => load(page + 1)}/> : null}
    {dialog}
  </Screen>;
}

const day = (offset: number) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const MAX_VISIT_RANGE_MS = 91 * 86400000;

function deviceOf(ua: string) {
  if (/Android/i.test(ua)) return 'Android';
  if (/iPhone|iPad/i.test(ua)) return 'iOS / iPadOS';
  if (/Windows/i.test(ua)) return 'Windows';
  if (/Macintosh/i.test(ua)) return 'macOS';
  if (/Linux/i.test(ua)) return 'Linux';
  return '—';
}

export function AdminLoginVisits() {
  const {requestJson, session} = useAuth();
  const t = useT();
  const {colors: c} = useTheme();
  const [from, setFrom] = useState(day(-6));
  const [to, setTo] = useState(day(0));
  const [ip, setIp] = useState('');
  const [filters, setFilters] = useState<{ from: string; to: string; ip: string } | null>(null);
  const [report, setReport] = useState<VisitReport | null>(null);
  const [selectedIp, setSelectedIp] = useState<string | null>(null);
  const [events, setEvents] = useState<VisitPage<Visit> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function apply() {
    const start = new Date(`${from}T00:00:00`);
    const end = new Date(`${to}T00:00:00`);
    end.setDate(end.getDate() + 1);
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || start >= end || end.getTime() - start.getTime() > MAX_VISIT_RANGE_MS) {
      setError(t('Khoảng ngày không hợp lệ (tối đa 91 ngày).'));
      return;
    }
    const next = {from: start.toISOString(), to: end.toISOString(), ip: ip.trim()};
    setFilters(next);
    loadReport(next, 0);
  }

  function loadReport(current: { from: string; to: string; ip: string }, page: number) {
    setLoading(true);
    setError('');
    setSelectedIp(null);
    setEvents(null);
    requestJson<VisitReport>(`/api/v1/admin/login-visits?${qs({...current, page, size: 25})}`).then(setReport)
      .catch(e => setError(t(e instanceof ApiError && e.status === 400 ? 'Bộ lọc không hợp lệ.' : 'Không tải được báo cáo truy cập.')))
      .finally(() => setLoading(false));
  }

  function detail(target: string, page = 0) {
    if (!filters) return;
    setSelectedIp(target);
    setEvents(null);
    requestJson<VisitPage<Visit>>(`/api/v1/admin/login-visits/events?${qs({...filters, ip: target, page, size: 25})}`)
      .then(setEvents).catch(() => setError(t('Không tải được chi tiết truy cập.')));
  }

  useEffect(() => {
    if (isAdmin(session?.user.roles)) apply();
  }, []);
  if (!isAdmin(session?.user.roles)) return <AdminOnly/>;

  const ipPage = report?.ips;
  const ipPages = ipPage ? Math.ceil(ipPage.total / ipPage.size) : 0;
  return <Screen title={t('Lượt truy cập đăng nhập')} subtitle={t('Thống kê IP truy cập trang đăng nhập')} back>
    <Row><View style={{flex: 1}}><Field label={t('Từ ngày')} value={from} onChangeText={setFrom}
                                        autoCapitalize="none"/></View><View style={{flex: 1}}><Field
      label={t('Đến ngày')} value={to} onChangeText={setTo} autoCapitalize="none"/></View></Row>
    <Field label={t('Lọc IP')} value={ip} onChangeText={setIp} autoCapitalize="none" keyboardType="numbers-and-punctuation"/>
    <Button label={t('Áp dụng')} kind="secondary" icon="funnel-outline" onPress={apply} loading={loading}/>
    {error ? <Info tone="error">{error}</Info> : null}
    {report ? <>
      <Card tint><Row><Metric label={t('LƯỢT XEM')} value={String(report.totals.views)}/><Metric label={t('TẢI LẠI')}
                                                                                               value={String(report.totals.reloads)}/></Row><Row><Metric
        label={t('IP')} value={String(report.totals.ips)}/><Metric label={t('KHÁCH')}
                                                                   value={String(report.totals.visitors)}/></Row><T
        size={10} color={c.muted}>{t('Dữ liệu được lưu {{n}} ngày.', {n: report.retentionDays})}</T></Card>
      {report.ips.items.length ? report.ips.items.map(row => <Pressable key={row.ip} accessibilityRole="button"
                                                                       onPress={() => detail(row.ip)}><Card><Row><View
        style={{flex: 1}}><T size={14} bold>{row.ip}</T><T size={10}
                                                          color={c.muted}>{dateLabel(row.firstSeen)} → {dateLabel(row.lastSeen)}</T></View><Badge>{row.views}</Badge></Row><T
        size={10}
        color={c.muted}>{t('{{v}} khách · {{s}} phiên · {{r}} tải lại', {v: row.visitors, s: row.sessions, r: row.reloads})}</T>
        {selectedIp === row.ip ? events ? <View style={{gap: 8}}>{events.items.map(visit => <View key={visit.id} style={{
          borderTopWidth: 1,
          borderColor: c.border,
          paddingTop: 6
        }}><T size={11} bold>{dateLabel(visit.visitedAt)} · {visit.navigation}</T><T size={10}
                                                                                    color={c.muted}>{deviceOf(visit.userAgent)} · {visit.language} · {visit.timezone} · {visit.screenWidth}×{visit.screenHeight}</T>{visit.referrer ?
          <T size={10} color={c.muted}>{visit.referrer}</T> : null}</View>)}{(events.page + 1) * events.size < events.total ?
          <Button label={t('Trang sau')} kind="secondary" onPress={() => detail(row.ip, events.page + 1)}/> : null}</View> :
          <ActivityIndicator color={c.primary}/> : null}
      </Card></Pressable>) : <Empty title={t('Không có lượt truy cập')}/>}
      {ipPages > 1 && filters ? <><Section title={t('Trang {{p}}/{{n}}', {p: ipPage!.page + 1, n: ipPages})}/><Row><View
        style={{flex: 1}}><Button label={t('Trước')} kind="secondary" disabled={ipPage!.page === 0}
                                  onPress={() => loadReport(filters, ipPage!.page - 1)}/></View><View
        style={{flex: 1}}><Button label={t('Sau')} kind="secondary" disabled={ipPage!.page + 1 >= ipPages}
                                  onPress={() => loadReport(filters, ipPage!.page + 1)}/></View></Row></> : null}
    </> : loading ? <ActivityIndicator color={c.primary}/> : null}
  </Screen>;
}
