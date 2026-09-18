import React, {useRef, useState} from 'react';
import {KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, View} from 'react-native';
import {router} from 'expo-router';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {dateLabel, emptyFilter, Filter, filteredTransactions, money, Transaction, typeNames, validDate} from './data';
import {useDemo} from './store';
import {useLanguage, useT} from './i18n';
import {Allocation, TrendChart} from './charts';
import {useTheme} from './theme';
import {
  Badge,
  Button,
  Card,
  Chips,
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

export function TransactionRow({transaction: t}: { transaction: Transaction }) {
  const {state} = useDemo();
  const account = state.accounts.find(a => a.id === t.accountId);
  const tr = useT();
  const {lang} = useLanguage();
  const {colors: c} = useTheme();
  return <Pressable accessibilityRole="button" accessibilityLabel={tr('{{type}}, {{amount}}, xem chi tiết', {
    type: tr(typeNames[t.type]),
    amount: money(t.amount, account?.currency, lang)
  })} onPress={() => go('transaction-detail', {id: t.id})}><Card style={{padding: 14, gap: 10}}><Row
    style={{gap: 8}}><View style={{
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: c.elevated,
    alignItems: 'center',
    justifyContent: 'center'
  }}><Icon
    name={t.type === 'withdraw' ? 'arrow-up-outline' : t.type === 'bonus' ? 'gift-outline' : 'arrow-down-outline'}
    color={t.type === 'bonus' ? c.lavender : c.primary} size={18}/></View><View style={{flex: 1}}><T size={12}
                                                                                                     bold>{tr(t.type === 'deposit' ? 'Nạp tiền vào tài khoản' : t.type === 'bonus' ? 'Thưởng đối tác Quỹ Alpha' : 'Rút tiền về tài khoản ngân hàng')}</T><T
    size={9} color={c.muted}>{dateLabel(t.date)} • {account?.name}</T></View><View
    style={{alignItems: 'flex-end', maxWidth: '42%'}}><T size={13} color={t.type === 'bonus' ? c.lavender : c.primary}
                                                         bold>{t.type === 'withdraw' ? '−' : '+'}{money(t.amount, account?.currency, lang)}</T><T
    size={9} color={t.status === 'done' ? c.success : c.warning}>• {tr(statusLabel(t.status))}</T></View></Row><Row
    style={{justifyContent: 'space-between'}}><T size={9}
                                                 color={c.muted}>{tr('Mã GD')}: {t.externalId || tr('— (Không có)')}</T><T
    size={9} color={c.primary}>{tr('Chi tiết')}</T></Row></Card></Pressable>;
}

const statusLabel = (status: Transaction['status']) => ({
  done: 'Hoàn thành',
  pending: 'Chờ xử lý',
  failed: 'Thất bại',
  cancelled: 'Đã hủy'
})[status];

export function FilterSheet({visible, onClose}: { visible: boolean; onClose: () => void }) {
  const {state, setFilter} = useDemo();
  const [draft, setDraft] = useState<Filter>({...state.filter, types: [...state.filter.types]});
  const [error, setError] = useState('');
  const inset = useSafeAreaInsets();
  const [preset, setPreset] = useState('custom');
  const t = useT();
  const {colors: c} = useTheme();
  const edit = (k: keyof Filter, v: string) => setDraft(f => ({...f, [k]: v}));
  const count = Number(draft.accountId !== 'all') + Number(!!draft.types.length) + Number(draft.status !== 'all') + Number(!!draft.from || !!draft.to) + Number(!!draft.min || !!draft.max);

  function apply() {
    if ([draft.from, draft.to].filter(Boolean).some(d => !validDate(d)) || (draft.from && draft.to && draft.from > draft.to)) {
      setError(t('Ngày không hợp lệ hoặc ngày bắt đầu sau ngày kết thúc.'));
      return;
    }
    if (draft.from && draft.to && (Date.parse(draft.to) - Date.parse(draft.from)) / 86400000 > 89) {
      setError(t('Mỗi lần tra cứu tối đa 90 ngày, tính cả ngày bắt đầu và kết thúc.'));
      return;
    }
    if ([draft.min, draft.max].some(v => v && (!Number.isFinite(Number(v)) || Number(v) < 0)) || (draft.min && draft.max && Number(draft.min) > Number(draft.max))) {
      setError(t('Khoảng số tiền không hợp lệ.'));
      return;
    }
    setFilter(draft);
    onClose();
  }

  function quick(value: string) {
    setPreset(value);
    if (value === 'custom') return;
    const end = new Date('2024-10-18T00:00:00Z');
    const start = new Date(end);
    start.setUTCDate(value === 'month' ? 1 : end.getUTCDate() - (value === '7' ? 6 : value === '30' ? 29 : 0));
    setDraft(f => ({...f, from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10)}));
  }

  return <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}><KeyboardAvoidingView
    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    style={{flex: 1, justifyContent: 'flex-end', backgroundColor: '#00000088'}}><Pressable accessibilityRole="button"
                                                                                           accessibilityLabel={t('Đóng bộ lọc')}
                                                                                           style={{
                                                                                             flex: 1,
                                                                                             minHeight: 24
                                                                                           }} onPress={onClose}/><View
    style={{
      maxHeight: '90%',
      backgroundColor: c.surface,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      paddingBottom: Math.max(inset.bottom, 12)
    }}><View
    style={{alignSelf: 'center', width: 44, height: 4, borderRadius: 2, backgroundColor: c.muted, marginTop: 12}}/><Row
    style={{padding: 16}}><View style={{flex: 1}}><T size={19} bold>{t('Bộ lọc lịch sử giao dịch')}</T><T size={11}
                                                                                                          color={c.muted}>{t('Tùy chỉnh khoảng thời gian và tiêu chí tìm kiếm')}</T></View><Pressable
    accessibilityRole="button" accessibilityLabel={t('Đóng')} onPress={onClose} style={{padding: 10}}><Icon
    name="close"/></Pressable></Row><ScrollView keyboardShouldPersistTaps="handled"
                                                contentContainerStyle={{padding: 20, gap: 18}}>{error ?
    <Info tone="error">{error}</Info> : null}
    <Section title={t('Khoảng thời gian giao dịch')}/><Chips value={preset} onChange={quick} values={[{
      value: 'today',
      label: t('Hôm nay')
    }, {value: '7', label: t('7 ngày qua')}, {value: '30', label: t('30 ngày qua')}, {
      value: 'month',
      label: t('Tháng này')
    }, {value: 'custom', label: t('Tùy chọn')}]}/><Row><View style={{flex: 1}}><Field label={t('Từ ngày')}
                                                                                      placeholder="YYYY-MM-DD"
                                                                                      value={draft.from}
                                                                                      onChangeText={v => edit('from', v)}/></View><View
      style={{flex: 1}}><Field label={t('Đến ngày')} placeholder="YYYY-MM-DD" value={draft.to}
                               onChangeText={v => edit('to', v)}/></View></Row><Info>{t('Hỗ trợ tra cứu tối đa 90 ngày mỗi lần lọc.')}</Info>
    <Section title={t('Tài khoản đầu tư')}/>{[{
      id: 'all',
      name: t('Tất cả tài khoản đầu tư'),
      code: ''
    }, ...state.accounts].map(a => <Pressable key={a.id} accessibilityRole="radio"
                                              aria-checked={draft.accountId === a.id}
                                              accessibilityState={{selected: draft.accountId === a.id}}
                                              onPress={() => edit('accountId', a.id)} style={{
      borderRadius: 28,
      padding: 18,
      backgroundColor: draft.accountId === a.id ? c.primary + '22' : c.surface
    }}><Row><Icon name={a.id === 'all' ? 'apps' : 'trending-up'}/><View style={{flex: 1}}><T bold>{a.name}</T>{a.code ?
      <T size={11} color={c.muted}>{a.code}</T> : null}</View><Icon
      name={draft.accountId === a.id ? 'checkmark-circle' : 'ellipse'}
      color={draft.accountId === a.id ? c.primary : c.elevated}/></Row></Pressable>)}
    <Section title={t('Loại giao dịch')}/><View style={{flexDirection: 'row', flexWrap: 'wrap', gap: 10}}>{[{
      value: 'all',
      label: t('Tất cả loại')
    }, ...Object.entries(typeNames).map(([value, label]) => ({value, label: t(label)}))].map(item => {
      const selected = item.value === 'all' ? !draft.types.length : draft.types.includes(item.value as Transaction['type']);
      return <Pressable key={item.value} accessibilityRole="checkbox" aria-checked={selected}
                        accessibilityState={{checked: selected}} onPress={() => setDraft(f => ({
        ...f,
        type: 'all',
        types: item.value === 'all' ? [] : selected ? f.types.filter(t => t !== item.value) : [...f.types, item.value as Transaction['type']]
      }))} style={{
        width: '48%',
        padding: 15,
        borderRadius: 28,
        backgroundColor: selected ? c.primary + '22' : c.surface
      }}><T color={selected ? c.primary : c.muted} bold>{item.label} {selected ? '✓' : ''}</T></Pressable>;
    })}</View>
    <Section title={t('Trạng thái ghi nhận')}/><Chips value={draft.status} onChange={v => edit('status', v)}
                                                      values={[{value: 'all', label: t('Tất cả')}, {
                                                        value: 'done',
                                                        label: t('Hoàn thành')
                                                      }, {value: 'pending', label: t('Chờ xử lý')}, {
                                                        value: 'failed',
                                                        label: t('Thất bại')
                                                      }, {value: 'cancelled', label: t('Đã hủy')}]}/>
    <Section title={t('Khoảng số tiền')}/><Row><View style={{flex: 1}}><Field label={t('Số tiền từ')}
                                                                              keyboardType="numeric" value={draft.min}
                                                                              onChangeText={v => edit('min', v)}/></View><View
      style={{flex: 1}}><Field label={t('Số tiền đến')} keyboardType="numeric" value={draft.max}
                               onChangeText={v => edit('max', v)}/></View></Row><Chips
      value={`${draft.min}:${draft.max}`} onChange={v => {
      const [min, max] = v.split(':');
      setDraft(f => ({...f, min, max}));
    }} values={[{value: ':9999999', label: t('< 10 triệu')}, {
      value: '10000000:50000000',
      label: t('10tr - 50tr')
    }, {value: '50000001:', label: t('> 50 triệu')}]}/></ScrollView><View
    style={{paddingHorizontal: 20, paddingTop: 12}}><Row><View style={{flex: 1}}><Button label={t('Đặt lại')}
                                                                                         kind="secondary"
                                                                                         onPress={() => {
                                                                                           setDraft({
                                                                                             ...emptyFilter,
                                                                                             types: []
                                                                                           });
                                                                                           setPreset('custom');
                                                                                           setError('');
                                                                                         }}/></View><View
    style={{flex: 2}}><Button label={t('Áp dụng bộ lọc ({{n}})', {n: count})}
                              onPress={apply}/></View></Row></View></View></KeyboardAvoidingView></Modal>;
}

export function History({initialFilter = false}: { initialFilter?: boolean }) {
  const {state, setFilter} = useDemo();
  const [filter, setOpen] = useState(initialFilter);
  const t = useT();
  const {lang} = useLanguage();
  const {colors: c} = useTheme();
  const rows = filteredTransactions(state, lang);
  const [search, setSearch] = useState(false);
  const active = Number(state.filter.accountId !== 'all') + Number(!!state.filter.types.length) + Number(state.filter.status !== 'all') + Number(!!state.filter.from || !!state.filter.to) + Number(!!state.filter.min || !!state.filter.max);
  const currencies = [...new Set(rows.map(tx => state.accounts.find(a => a.id === tx.accountId)?.currency || 'VND'))];
  const sum = (type: Transaction['type'], currency: string) => rows.filter(tx => tx.type === type && (state.accounts.find(a => a.id === tx.accountId)?.currency || 'VND') === currency).reduce((n, tx) => n + tx.amount, 0);
  return <Screen title={t('Lịch sử giao dịch')} back><Row><View><Badge>{t('PHÂN HỆ ĐẦU TƯ')}</Badge></View><T size={11}
                                                                                                 style={{flex: 1}}>• {t('Lịch sử giao dịch')}</T><Pressable
    accessibilityLabel={t('Tìm kiếm giao dịch')} accessibilityRole="button" onPress={() => setSearch(!search)}
    style={{padding: 8}}><Icon name="search-outline" size={18}/></Pressable><Pressable accessibilityLabel={t('Bộ lọc')}
                                                                                       accessibilityRole="button"
                                                                                       onPress={() => setOpen(true)}
                                                                                       style={{padding: 8}}><Icon
    name="options-outline" size={18}/>{active ? <T size={9} color={c.primary}>{active}</T> : null}
  </Pressable></Row>{search ?
    <Field label={t('Tìm giao dịch')} placeholder={t('Mã giao dịch, mô tả…')} value={state.filter.query}
           onChangeText={query => setFilter({...state.filter, query})}/> : null}
    <Card><Row><Icon name="wallet-outline"/><View style={{flex: 1}}><T size={9}
                                                                       color={c.muted}>{t('TÀI KHOẢN ĐỐI SOÁT')}</T><T
      size={13}
      bold>{state.accounts.find(a => a.id === state.filter.accountId)?.name || t('Tất cả tài khoản')}</T></View><Pressable
      onPress={() => setOpen(true)} accessibilityRole="button"><T size={11}
                                                                  color={c.primary}>{t('Đổi ⇄')}</T></Pressable></Row></Card><Card><Row><Icon
      name="calendar-outline" size={16}/><T size={11} style={{flex: 1}}>{t('Kỳ đối soát: Tháng 10/2024')}</T><T
      size={10}
      color={c.muted}>{t('{{n}} giao dịch', {n: rows.length})}</T></Row>{(currencies.length ? currencies : ['VND']).map(currency =>
      <Row key={currency}>{(['deposit', 'withdraw', 'bonus'] as const).map(type => <View key={type}
                                                                                         style={{flex: 1, gap: 4}}><T
        size={9}
        color={c.muted}>{type === 'deposit' ? t('Tổng nạp') : type === 'withdraw' ? t('Tổng rút') : t('Thưởng')}</T><T
        size={12} color={type === 'bonus' ? c.lavender : c.primary}
        bold>{money(sum(type, currency), currency, lang)}</T></View>)}</Row>)}</Card>
    <Chips value={state.filter.types.length === 1 ? state.filter.types[0] : 'all'} onChange={v => setFilter({
      ...state.filter,
      type: 'all',
      types: v === 'all' ? [] : [v as Transaction['type']]
    })} values={[{label: t('Tất cả'), value: 'all'}, ...Object.entries(typeNames).map(([value, label]) => ({
      value,
      label: t(label)
    }))]}/>
    {rows.length ? rows.map((tx, i) => <View key={tx.id}
                                             style={{gap: 10}}>{i === 0 || rows[i - 1].date.slice(0, 10) !== tx.date.slice(0, 10) ?
        <T size={10} color={c.muted}>{dateLabel(tx.date.slice(0, 10))}</T> : null}<TransactionRow
        transaction={tx}/></View>) :
      <Card style={{alignItems: 'center', paddingVertical: 44, gap: 20}}><Icon name="receipt-outline" size={56}/><T
        size={19} bold>{t('Chưa có dữ liệu giao dịch')}</T><T size={12} color={c.muted}
                                                              style={{textAlign: 'center'}}>{t('Không tìm thấy bản ghi giao dịch nào trong khoảng thời gian hoặc điều kiện lọc đã chọn. Hãy thử điều chỉnh bộ lọc hoặc nhập chứng từ mới để ghi nhận vào sổ đối soát.')}</T><Button
        label={t('Nhập giao dịch mới')} icon="add-circle-outline" onPress={() => go('import')}/><Button
        label={t('Đặt lại bộ lọc')} kind="secondary" onPress={() => setFilter({...emptyFilter})}/></Card>}
    <Info>{t('Dữ liệu giao dịch được đồng bộ và lưu trữ độc lập để phục vụ đối soát, không can thiệp trực tiếp vào số dư khả dụng thực tế của tài khoản đối tác.')}</Info>{filter ?
      <FilterSheet visible onClose={() => setOpen(false)}/> : null}</Screen>;
}

export function TransactionDetail({id, success = false}: { id: string; success?: boolean }) {
  const {state} = useDemo();
  const {notify, dialog} = useNotice();
  const transaction = state.transactions.find(t => t.id === id);
  const account = state.accounts.find(a => a.id === transaction?.accountId);
  const t = useT();
  const {lang} = useLanguage();
  const {colors: c} = useTheme();
  if (!transaction) return <Screen title={t('Chi tiết giao dịch')} back><Empty title={t('Giao dịch không còn tồn tại')}
                                                                               action={t('Về lịch sử')}
                                                                               onPress={() => go('history')}/></Screen>;
  const infoRow = (label: string, value: string) => <Row key={label} style={{alignItems: 'flex-start'}}><T size={10}
                                                                                                           color={c.muted}
                                                                                                           style={{flex: 1}}>{label}</T><T
    size={11} style={{flex: 1, textAlign: 'right'}}>{value}</T></Row>;
  return <Screen title={success ? t('Lịch sử đối soát') : t('CHI TIẾT GIAO DỊCH')} subtitle={t('Sổ đối soát Đầu tư')}
                 back>
    {success ? <Card tint><Row><Icon name="checkmark-circle-outline"/><T size={14} bold
                                                                         style={{flex: 1}}>{t('Đã gửi báo cáo sai lệch thành công')}</T></Row><T
      size={11}
      color={c.muted}>{t('Mã tra soát: #{{id}} • Yêu cầu đã chuyển tới hàng đợi đối soát độc lập Kira Bank để rà soát lại với SSI.', {id: state.reports.find(r => r.transactionId === id)?.id || 'REP-20241018-093'})}</T><Row><Pressable
      accessibilityRole="button" onPress={() => go('reports')} style={{padding: 8}}><T size={11}
                                                                                       color={c.primary}>{t('Theo dõi tiến độ')}</T></Pressable><T
      size={10} color={c.muted}>{t('Thời gian phản hồi dự kiến: ~15 phút')}</T></Row></Card> : null}
    <Card tint style={{alignItems: 'center', paddingVertical: 28, gap: 10}}><View style={{
      width: 56,
      height: 56,
      borderRadius: 20,
      backgroundColor: '#153246',
      justifyContent: 'center',
      alignItems: 'center'
    }}><Icon name={transaction.type === 'withdraw' ? 'arrow-up' : 'arrow-down'} size={32}/></View><T size={11}
                                                                                                     color={c.muted}>{transaction.type === 'deposit' ? t('NẠP TIỀN VÀO TÀI KHOẢN') : t(typeNames[transaction.type]).toUpperCase()}</T><T
      size={30} bold
      color={c.primary}>{transaction.type === 'withdraw' ? '−' : '+'}{money(transaction.amount, account?.currency, lang)}</T><Badge
      tone={success ? 'primary' : 'success'}>{success ? t('Đang tra soát • Khẩu nghị mở') : `• ${t(statusLabel(transaction.status))}`}</Badge><T
      size={10} color={c.muted}>◷ {dateLabel(transaction.date)}</T></Card>
    <Card><Row><Icon name="wallet-outline" size={16}/><T size={12} bold
                                                         color={c.primary}>{t('THÔNG TIN TÀI KHOẢN & ĐỐI SOÁT')}</T></Row>{[[t('Tài khoản đối soát'), `${account?.name} (${account?.currency})`], [t('Mã tài khoản'), account?.code || '—'], [t('Mã giao dịch Kira'), transaction.id], [t('Mã đối tác / Ngân hàng'), transaction.externalId || t('— (Không có)')], [t('Phương thức / Nguồn chuyển'), t('Chuyển khoản liên ngân hàng 24/7 (Napas)')]].map(([label, value]) => infoRow(label, value))}
    </Card>
    <Card><Row><Icon name="shield-checkmark-outline" color={c.lavender} size={16}/><T size={12} bold
                                                                                      color={c.lavender}>{t('CHI TIẾT ĐỐI SOÁT & NGUỒN DỮ LIỆU')}</T></Row>{[[t('Nguồn nhập bản ghi'), t('Trích xuất ảnh (AI OCR)')], [t('Thuộc lô bản ghi'), '#BATCH-202410-889'], [t('Trạng thái đối soát'), success ? t('Đã ghi nhận báo cáo (Chờ duyệt)') : t('Khớp 100% (Không trùng lặp)')]].map(([label, value]) => infoRow(label, value))}<T
      size={10} color={c.muted}>{t('Mô tả ghi chú')}</T><View
      style={{backgroundColor: '#0c1321', borderRadius: 18, padding: 12}}><T size={12}>{t(transaction.description)}</T></View></Card>
    <Info>{t('Cam kết bảo vệ sổ cái độc lập. Dữ liệu giao dịch này được ghi nhận an toàn trong sổ đối soát độc lập của Kira Bank, không can thiệp trực tiếp vào số dư khả dụng thực tế của tài khoản đối tác SSI.')}</Info><Button
    label={t('Xem ảnh chứng từ gốc')} icon="image-outline" kind={success ? 'primary' : 'secondary'}
    onPress={() => go('source', {id: transaction.source || 'job-1'})}/><Row><View style={{flex: 1}}><Button
    label={t('Xuất sao kê')} kind="secondary" icon="download-outline"
    onPress={() => notify(t('Xuất sao kê được mô phỏng trong phiên bản này.'))}/></View><View style={{flex: 1}}><Button
    label={success ? t('Đã báo cáo sai lệch') : t('Báo cáo sai lệch')} kind="secondary" disabled={success}
    onPress={() => go('report-create', {id})}/></View></Row>{dialog}</Screen>;
}

export function ReportForm({id}: { id: string }) {
  const {state, report} = useDemo();
  const tx = state.transactions.find(t => t.id === id);
  const t = useT();
  const {lang} = useLanguage();
  const {colors: c} = useTheme();
  const [reason, setReason] = useState('Lỗi trích xuất AI OCR');
  const [detail, setDetail] = useState('');
  const [attachment, setAttachment] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const submission = useRef(false);
  if (!tx) return <Screen title={t('Báo cáo sai lệch')} back><Empty title={t('Không tìm thấy giao dịch')}/></Screen>;
  return <Screen title={t('Báo cáo sai lệch giao dịch')}
                 subtitle={t('Mã GD: {{id}} • Lô #BATCH-202410-889', {id: tx.id})} back sheet
                 footer={<Row><View style={{flex: 1}}><Button label={t('Hủy bỏ')} kind="secondary"
                                                              onPress={() => router.back()}/></View><View
                   style={{flex: 2}}><Button label={t('Gửi báo cáo sai lệch')} disabled={submitted} onPress={() => {
                   if (detail.trim().length < 10) {
                     setError(t('Vui lòng mô tả ít nhất 10 ký tự.'));
                     return;
                   }
                   if (submission.current) return;
                   submission.current = true;
                   setSubmitted(true);
                   report({transactionId: id, reason, detail: detail.trim()});
                   router.replace({pathname: '/[page]', params: {page: 'report-success', id}});
                 }}/></View></Row>}>
    <Card><Row><Icon name="arrow-down-outline"/><View style={{flex: 1}}><T size={10}
                                                                           color={c.muted}>{t('Loại giao dịch')}</T><T
      size={12} bold>{t('{{type}} vào tài khoản', {type: t(typeNames[tx.type])})}</T></View><T size={13} bold
                                                                                               color={c.primary}>{money(tx.amount, undefined, lang)}</T></Row><Row><Metric
      label={t('Tài khoản đối soát')} value={state.accounts.find(a => a.id === tx.accountId)?.name || '—'}/><Metric
      label={t('Thời gian ghi nhận')}
      value={dateLabel(tx.date)}/></Row><Badge>{t('Khớp 100% (Sổ đối soát)')}</Badge></Card>
    <T size={12} bold>{t('Lý do báo cáo sai lệch *')}</T>{[{
    title: 'Sai lệch số tiền',
    detail: 'Số tiền trên sổ cái khác chứng từ gốc từ ngân hàng chuyển tiền.'
  }, {
    title: 'Trùng lặp giao dịch',
    detail: 'Đã bị ghi nhận 2 lần trong cùng sổ đối soát độc lập.'
  }, {
    title: 'Lỗi trích xuất AI OCR',
    detail: 'Nhận dạng nhầm ngày tháng, mã giao dịch tham chiếu hoặc nội dung chuyển khoản.'
  }, {
    title: 'Sai thông tin đối tác / Tài khoản đối soát',
    detail: 'Ghi nhận nhầm tài khoản đích hoặc kênh nhận uỷ thác.'
  }, {title: 'Lý do khác', detail: 'Khác biệt đối soát nghiệp vụ không thuộc danh mục trên.'}].map(item => <Pressable
    key={item.title} accessibilityRole="radio" aria-checked={reason === item.title}
    accessibilityState={{selected: reason === item.title}} onPress={() => setReason(item.title)}><Card
    style={{padding: 12, borderWidth: 1, borderColor: reason === item.title ? '#335872' : 'transparent'}}><Row><Icon
    name={reason === item.title ? 'radio-button-on' : 'radio-button-off'} size={16}/><View style={{flex: 1}}><T
    size={12} bold>{t(item.title)}</T><T size={10}
                                         color={c.muted}>{t(item.detail)}</T></View></Row></Card></Pressable>)}
    <Field label={t('Mô tả chi tiết sai lệch *')} value={detail} onChangeText={setDetail} multiline maxLength={1000}
           placeholder={t('Mô tả thông tin cần đối chiếu…')} error={error}
           hint={t('{{n}}/1000 ký tự • Tối thiểu 10 ký tự', {n: detail.length})}/><T size={12}
                                                                                     bold>{t('Đính kèm minh chứng bổ sung')}</T>{attachment ?
    <Card><Row><Icon name="document-outline"/><T size={12} style={{flex: 1}}>bien_lai_mb_bank.png • 1.2 MB</T><Pressable
      onPress={() => setAttachment(false)} accessibilityLabel={t('Xóa minh chứng')} accessibilityRole="button"><Icon
      name="trash-outline" size={18}/></Pressable></Row></Card> : null}<Button
    label={t('Thêm ảnh chụp màn hình hoặc sao kê…')} kind="secondary"
    onPress={() => setAttachment(true)}/><Info>{t('Lưu ý nghiệp vụ: Báo cáo này sẽ được chuyển trực tiếp vào hàng đợi kiểm tra đối soát độc lập của Kira Bank. Việc điều chỉnh bản ghi sẽ không can thiệp hay thay đổi số dư thực tế tại đối tác SSI.')}</Info></Screen>;
}

export function Reports() {
  const {state} = useDemo();
  const {notify, dialog} = useNotice();
  const [status, setStatus] = useState('all');
  const shown = state.reports.filter(r => status === 'all' || r.status === status);
  const t = useT();
  const {lang} = useLanguage();
  const {colors: c} = useTheme();
  return <Screen title={t('Tra soát & Khiếu nại')} subtitle={t('Theo dõi tiến độ xử lý hồ sơ đối soát độc lập')}
                 back><Row style={{gap: 6}}><Metric label={t('Tổng hồ sơ')}
                                                    value={t('{{n}} vụ việc', {n: state.reports.length})}/><Metric
    label={t('Đang xử lý')}
    value={t('{{n}} chờ kết quả', {n: state.reports.filter(r => r.status !== 'resolved').length})}/><Metric
    label={t('Đã giải quyết')}
    value={t('{{n}} hoàn tất', {n: state.reports.filter(r => r.status === 'resolved').length})}/></Row><Chips
    value={status} onChange={setStatus}
    values={[{label: t('Tất cả ({{n}})', {n: state.reports.length}), value: 'all'}, {
      label: t('Đang xử lý'),
      value: 'reviewing'
    }, {label: t('Cần phản hồi'), value: 'pending'}, {
      label: t('Đã giải quyết'),
      value: 'resolved'
    }]}/>{shown.length ? shown.map(r => {
    const tx = state.transactions.find(t => t.id === r.transactionId);
    return <Card key={r.id} style={{gap: 16}}><Row><View style={{flex: 1}}><T size={10} bold
                                                                              color={c.primary}>#{r.id}</T><T size={9}
                                                                                                              color={c.muted}>{dateLabel(r.date)}</T></View><View
      style={{maxWidth: '48%'}}><Badge
      tone={r.status === 'resolved' ? 'muted' : 'primary'}>{r.status === 'pending' ? '◷ ' + t('Chờ bạn xác nhận') : r.status === 'reviewing' ? '♧ ' + t('Đang tra soát với SSI') : '✓ ' + t('Đã điều chỉnh sổ cái')}</Badge></View></Row><View
      style={{backgroundColor: '#0c1321', borderRadius: 18, padding: 12, gap: 6}}><Row><T size={10} color={c.muted}
                                                                                          style={{flex: 1}}>{t('Giao dịch liên quan')}</T><T
      size={12} color={c.primary}>{tx ? money(tx.amount, undefined, lang) : '—'}</T></Row><T size={12}
                                                                                             bold>{t(r.reason)}</T><T
      size={9} color={c.muted}>{t('Đối soát độc lập từ mã đối tác (AI OCR)')}</T></View>{r.status === 'reviewing' ? <>
      <Row><T size={10} style={{flex: 1}}>{t('Tiến độ xác thực')}</T><T size={10}
                                                                        color={c.muted}>{t('Bước 2/4')}</T></Row><Progress
      value={50}/><T size={9}
                     color={c.muted}>{t('Tiếp nhận • Kiểm tra chéo • Duyệt • Sổ cái')}</T></> : null}<Info>{t(r.detail)}</Info><Button
      label={r.status === 'pending' ? t('Bổ sung thông tin ngay') : r.status === 'resolved' ? t('Xem kết luận chi tiết') : t('Xem giao dịch gốc')}
      kind={r.status === 'pending' ? 'primary' : 'secondary'}
      onPress={() => r.status === 'pending' ? notify(t('Đã mở yêu cầu bổ sung minh chứng mẫu. Giao dịch gốc được giữ nguyên.')) : go('transaction-detail', {id: r.transactionId})}/></Card>;
  }) : <Empty title={t('Chưa có báo cáo phù hợp')}
              description={t('Bạn có thể gửi báo cáo từ màn chi tiết giao dịch.')}/>}<Info>{t('Bảo đảm an toàn sổ đối soát độc lập. Các yêu cầu tra soát chỉ phục vụ việc chuẩn hóa và đối chiếu sổ cái độc lập của Kira Bank, không can thiệp trực tiếp đến số dư tại đối tác tài chính liên kết.')}</Info><Button
    label={t('Tạo yêu cầu tra soát mới')} icon="add-circle-outline" onPress={() => go('history')}/><T size={10}
                                                                                                      color={c.muted}
                                                                                                      style={{textAlign: 'center'}}>♧ {t('Hotline kiểm toán: 1900 8899 • Chat trực tiếp với tư vấn viên')}</T>{dialog}
  </Screen>;
}

export function AccountStats({id}: { id: string }) {
  const {state, setFilter} = useDemo();
  const {notify, dialog} = useNotice();
  const [accountId, setAccountId] = useState(id);
  const a = state.accounts.find(a => a.id === accountId);
  const transactions = state.transactions.filter(t => t.accountId === accountId);
  const t = useT();
  const {lang} = useLanguage();
  const {colors: c} = useTheme();
  if (!a) return <Screen title={t('Thống kê theo tài khoản')} back><Empty
    title={t('Không tìm thấy tài khoản')}/></Screen>;
  const total = (type: Transaction['type']) => transactions.filter(t => t.type === type && t.status === 'done').reduce((n, t) => n + t.amount, 0);
  const reference = state.scenario === 'reference-account';
  const deposit = reference ? 150000000 : total('deposit');
  const bonus = reference ? 50000000 : total('bonus');
  const withdrawal = reference ? 20000000 : total('withdraw');
  return <Screen title={t('Thống kê theo tài khoản')} subtitle={t('Chi tiết dòng tiền đối soát từng đối tác độc lập')}
                 back><Chips value={accountId} onChange={setAccountId}
                             values={state.accounts.map(a => ({value: a.id, label: a.name}))}/><Card tint><Row><Icon
    name="analytics-outline"/><View style={{flex: 1}}><T bold>{a.name}</T><T size={10}
                                                                             color={c.muted}>{t('HSC / Napas • TK đích: 001C-928472 • Napas MB')}</T></View><Badge>{t('Khớp 100% sổ cái')}</Badge></Row><T
    size={10} color={c.muted}>{t('TỔNG GIÁ TRỊ TÍCH LŨY ĐỐI SOÁT')}</T><T size={27} bold
                                                                          color={c.primary}>{money(deposit + bonus - withdrawal, a.currency, lang)}</T><T
    size={10} color={c.primary}>{t('↗ +12.8% (+20.500.000 VND) • kỳ 30 ngày')}</T><Row><Metric
    label={t('Tỷ trọng trong danh mục')} value={t('51.6% tổng dòng tiền')}/><Metric label={t('Chứng từ đã lập')}
                                                                                    value={t('{{n}} biên lai đối soát', {n: reference ? 27 : transactions.length})}/></Row></Card>
    <Row style={{gap: 6}}><Metric label={t('Nạp vào ↓')} value={money(deposit, a.currency, lang)}/><Metric
      label={t('Đã rút ra ↑')} value={money(withdrawal, a.currency, lang)}/><Metric label={t('Lãi & Thưởng')}
                                                                                    value={money(bonus, a.currency, lang)}/></Row>
    <Card><T size={12} bold>{t('BIẾN ĐỘNG DÒNG TIỀN 6 THÁNG')}</T><T size={10}
                                                                     color={c.muted}>{t('Sổ cái tích lũy ròng {{name}}', {name: a.name})}</T><T
      size={11} color={c.primary}>{t('Đỉnh T10: +35.0M')}</T><TrendChart investment/></Card><Card><T size={12}
                                                                                                     bold>{t('CƠ CẤU DÒNG TIỀN ĐỐI SOÁT')}</T><Allocation
      items={[{label: t('Vốn nạp gốc'), percent: 70}, {
        label: t('Tái nạp tích lũy'),
        percent: 20
      }, {label: t('Cổ tức tiền mặt'), percent: 10}]}/></Card><Row><View style={{flex: 1}}><Card><Icon
      name="shield-checkmark-outline"/><T size={11} bold>{t('Đối soát Napas MB')}</T><T size={9}
                                                                                        color={c.muted}>{t('Tự động đồng bộ biên lai')}</T></Card></View><View
      style={{flex: 1}}><Card><Icon name="lock-closed-outline" color={c.lavender}/><T size={11}
                                                                                      bold>{t('Sổ cái Kira Bank')}</T><T
      size={9} color={c.muted}>{t('Độc lập & bảo mật số dư')}</T></Card></View></Row>
    <Card><T size={12} bold>{t('LỊCH SỬ SỔ CÁI TÀI KHOẢN')}</T><T size={10}
                                                                  color={c.muted}>{t('3 giao dịch biên lai mới nhất • {{name}}', {name: a.name})}</T>{transactions.slice(0, 3).map(tx =>
      <TransactionRow key={tx.id} transaction={tx}/>)}<Button
      label={t('Xem toàn bộ {{n}} giao dịch của tài khoản này', {n: reference ? 27 : transactions.length})}
      kind="secondary" onPress={() => {
      setFilter({...emptyFilter, accountId});
      go('history');
    }}/></Card><Info>{t('Quy tắc độc lập Sổ cái Kira Bank. Dữ liệu thống kê dựa trên các chứng từ/sao kê đã nạp vào Kira Bank để đối soát độc lập. Kira Bank không truy cập số dư chứng khoán thực tế của bạn trên sàn đối tác.')}</Info><Button
      label={t('Xuất sao kê đối soát tài khoản này (PDF/Excel)')} icon="download-outline"
      onPress={() => notify(t('Xuất sao kê được mô phỏng.'))}/><Button label={t('Tra soát sai lệch tài khoản')}
                                                                       kind="secondary"
                                                                       onPress={() => go('reports')}/>{dialog}</Screen>;
}
