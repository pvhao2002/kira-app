import React, {useCallback, useEffect, useState} from 'react';
import {ActivityIndicator, Pressable, View} from 'react-native';
import {
  bankErrorMessage,
  CardBenefitResponse,
  CardMerchantRule,
  CardTransaction,
  CardTransactionFilter,
  CardTransactionType,
  CreditCardResponse,
  useBankApi
} from './bankApi';
import {dateLabel, money, validDate} from './data';
import {useLanguage, useT} from './i18n';
import {useTheme} from './theme';
import {Badge, Button, Card, Chips, Dialog, Empty, Field, Info, Row, Screen, Section, T, useNotice} from './ui';

const TYPES: CardTransactionType[] = ['SPENDING', 'REFUND', 'FEE', 'INTEREST', 'CASHBACK'];
const TYPE_LABELS: Record<CardTransactionType, string> = {
  SPENDING: 'Chi tiêu', REFUND: 'Hoàn tiền', FEE: 'Phí', INTEREST: 'Lãi', CASHBACK: 'Cashback'
};
const PAGE_SIZE = 20;
const today = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};
const newKey = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

type TxForm = {
  cardId: string; transactionDate: string; description: string; amount: string; transactionType: CardTransactionType;
  mccCode: string; cashbackRuleId: string;
};
type RuleForm = { id: number | null; version: number | null; pattern: string; mccCode: string; label: string; applyToExisting: boolean };

export function CardTransactions() {
  const api = useBankApi();
  const t = useT();
  const {lang} = useLanguage();
  const {colors: c} = useTheme();
  const {notify, dialog} = useNotice();
  const [tab, setTab] = useState<'transactions' | 'rules'>('transactions');
  const [cards, setCards] = useState<CreditCardResponse[]>([]);
  const [benefits, setBenefits] = useState<CardBenefitResponse[]>([]);
  const [filter, setFilter] = useState<CardTransactionFilter>({});
  const [items, setItems] = useState<CardTransaction[]>([]);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState<TxForm | null>(null);
  const [editing, setEditing] = useState<CardTransaction | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState(newKey);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<CardTransaction | null>(null);
  const [rules, setRules] = useState<CardMerchantRule[]>([]);
  const [ruleForm, setRuleForm] = useState<RuleForm | null>(null);
  const [deletingRule, setDeletingRule] = useState<CardMerchantRule | null>(null);

  useEffect(() => {
    api.listAllCards().then(setCards).catch(() => undefined);
    api.listBenefits().then(setBenefits).catch(() => undefined);
    loadRules();
  }, []);

  const load = useCallback((nextPage: number, append: boolean) => {
    if (filter.fromDate && filter.toDate && filter.toDate < filter.fromDate) {
      setError(t('Khoảng ngày không hợp lệ.'));
      return;
    }
    setLoading(true);
    api.searchCardTransactions({...filter, q: filter.q?.trim() || undefined}, nextPage, PAGE_SIZE).then(result => {
      setItems(current => append ? [...current, ...result.data] : result.data);
      setPage(nextPage);
      setTotalPages(result.meta.totalPages);
      setError('');
    }).catch(e => setError(t(bankErrorMessage(e)))).finally(() => setLoading(false));
  }, [filter, t]);
  useEffect(() => load(0, false), [filter.cardId, filter.type]);

  function loadRules() {
    api.listMerchantRules().then(setRules).catch(e => setError(t(bankErrorMessage(e))));
  }

  function openCreate() {
    setEditing(null);
    setIdempotencyKey(newKey());
    setError('');
    setForm({
      cardId: filter.cardId ? String(filter.cardId) : cards[0] ? String(cards[0].id) : '', transactionDate: today(),
      description: '', amount: '', transactionType: 'SPENDING', mccCode: '', cashbackRuleId: ''
    });
  }

  function openEdit(tx: CardTransaction) {
    setEditing(tx);
    setError('');
    setForm({
      cardId: String(tx.cardId), transactionDate: tx.transactionDate, description: tx.description,
      amount: String(tx.amount), transactionType: tx.transactionType, mccCode: tx.mccCode || '',
      cashbackRuleId: tx.cashbackRuleId ? String(tx.cashbackRuleId) : ''
    });
  }

  async function save() {
    if (!form) return;
    const amount = Number(form.amount);
    const mcc = form.mccCode.trim();
    if (!form.cardId) return setError(t('Chọn thẻ.'));
    if (!validDate(form.transactionDate)) return setError(t('Ngày giao dịch phải có dạng YYYY-MM-DD.'));
    if (!form.description.trim()) return setError(t('Nhập mô tả giao dịch.'));
    if (!Number.isFinite(amount) || amount <= 0) return setError(t('Số tiền phải lớn hơn 0.'));
    if (mcc && !/^\d{4}$/.test(mcc)) return setError(t('MCC phải gồm 4 chữ số.'));
    const body = {
      transactionDate: form.transactionDate, description: form.description.trim(), amount,
      transactionType: form.transactionType, mccCode: mcc || null,
      cashbackRuleId: form.cashbackRuleId ? Number(form.cashbackRuleId) : null
    };
    setSaving(true);
    setError('');
    try {
      if (editing) await api.updateCardTransaction(editing.id, {...body, version: editing.version});
      else await api.createCardTransaction(Number(form.cardId), body, idempotencyKey);
      setForm(null);
      notify(t(editing ? 'Đã cập nhật giao dịch.' : 'Đã thêm giao dịch.'));
      load(0, false);
    } catch (e) {
      setError(t(bankErrorMessage(e)));
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    const tx = deleting;
    setDeleting(null);
    if (!tx) return;
    try {
      await api.deleteCardTransaction(tx.id, tx.version);
      load(0, false);
    } catch (e) {
      setError(t(bankErrorMessage(e)));
    }
  }

  async function saveRule() {
    if (!ruleForm) return;
    const pattern = ruleForm.pattern.trim();
    if (pattern.length < 2 || pattern.length > 100 || !/^\d{4}$/.test(ruleForm.mccCode.trim())) {
      return setError(t('Mẫu merchant cần 2–100 ký tự và MCC gồm 4 chữ số.'));
    }
    const body = {
      pattern, mccCode: ruleForm.mccCode.trim(), label: ruleForm.label.trim() || null,
      applyToExisting: ruleForm.applyToExisting, version: ruleForm.version
    };
    setSaving(true);
    setError('');
    try {
      if (ruleForm.id === null) {
        const result = await api.createMerchantRule(body);
        notify(t('Đã tạo quy tắc, cập nhật {{n}} giao dịch.', {n: result.updatedTransactions}));
        if (result.updatedTransactions) load(0, false);
      } else {
        await api.updateMerchantRule(ruleForm.id, body);
        notify(t('Đã cập nhật quy tắc.'));
      }
      setRuleForm(null);
      loadRules();
    } catch (e) {
      setError(t(bankErrorMessage(e)));
    } finally {
      setSaving(false);
    }
  }

  async function removeRule() {
    const rule = deletingRule;
    setDeletingRule(null);
    if (!rule) return;
    try {
      await api.deleteMerchantRule(rule.id, rule.version);
      loadRules();
    } catch (e) {
      setError(t(bankErrorMessage(e)));
    }
  }

  const cardChips = cards.map(card => ({value: String(card.id), label: `${card.nickname} •${card.lastFour}`}));
  const typeChips = TYPES.map(type => ({value: type, label: t(TYPE_LABELS[type])}));

  if (form) {
    const groups = benefits.find(item => String(item.cardId) === form.cardId)?.programs.flatMap(program => program.groups) || [];
    const set = (patch: Partial<TxForm>) => setForm(current => current && {...current, ...patch});
    return <Screen title={t(editing ? 'Sửa giao dịch thẻ' : 'Thêm giao dịch thẻ')} back
                   footer={<Row><View style={{flex: 1}}><Button label={t('Hủy')} kind="secondary"
                                                                onPress={() => setForm(null)} disabled={saving}/></View><View
                     style={{flex: 2}}><Button label={t('Lưu giao dịch')} icon="checkmark-circle-outline"
                                               onPress={() => void save()} loading={saving}/></View></Row>}>
      {error ? <Info tone="error">{error}</Info> : null}
      <Card tint>
        {editing ? <T size={12} color={c.muted}>{editing.cardNickname} •{editing.cardLastFour}</T> : <>
          <T size={12} color={c.muted}>{t('Thẻ *')}</T><Chips values={cardChips} value={form.cardId}
                                                             onChange={value => set({cardId: value, cashbackRuleId: ''})}/></>}
        <Field label={t('Ngày giao dịch (YYYY-MM-DD) *')} value={form.transactionDate}
               onChangeText={value => set({transactionDate: value})} autoCapitalize="none"/>
        <Field label={t('Mô tả *')} value={form.description} onChangeText={value => set({description: value})}/>
        <Field label={t('Số tiền *')} value={form.amount} keyboardType="decimal-pad"
               onChangeText={value => set({amount: value.replace(/[^0-9.]/g, '')})}/>
        <T size={12} color={c.muted}>{t('Loại giao dịch')}</T>
        <Chips values={typeChips} value={form.transactionType}
               onChange={value => set({transactionType: value as CardTransactionType})}/>
        <Field label={t('MCC (4 chữ số)')} value={form.mccCode} keyboardType="number-pad" maxLength={4}
               onChangeText={value => set({mccCode: value.replace(/\D/g, '')})}/>
        {groups.length ? <><T size={12} color={c.muted}>{t('Nhóm cashback')}</T><Chips
          values={[{value: '', label: t('Tự động')}, ...groups.map(group => ({value: String(group.id), label: group.categoryName}))]}
          value={form.cashbackRuleId} onChange={value => set({cashbackRuleId: value})}/></> : null}
      </Card>
    </Screen>;
  }

  if (ruleForm) {
    const set = (patch: Partial<RuleForm>) => setRuleForm(current => current && {...current, ...patch});
    return <Screen title={t(ruleForm.id === null ? 'Thêm quy tắc merchant' : 'Sửa quy tắc merchant')} back
                   footer={<Row><View style={{flex: 1}}><Button label={t('Hủy')} kind="secondary"
                                                                onPress={() => setRuleForm(null)} disabled={saving}/></View><View
                     style={{flex: 2}}><Button label={t('Lưu quy tắc')} icon="checkmark-circle-outline"
                                               onPress={() => void saveRule()} loading={saving}/></View></Row>}>
      {error ? <Info tone="error">{error}</Info> : null}
      <Card tint>
        <Field label={t('Mẫu mô tả merchant *')} value={ruleForm.pattern} onChangeText={value => set({pattern: value})}
               autoCapitalize="none" placeholder={t('Ví dụ: grab')}/>
        <Field label={t('MCC *')} value={ruleForm.mccCode} keyboardType="number-pad" maxLength={4}
               onChangeText={value => set({mccCode: value.replace(/\D/g, '')})}/>
        <Field label={t('Nhãn')} value={ruleForm.label} onChangeText={value => set({label: value})}/>
        {ruleForm.id === null ? <Chips values={[{value: 'yes', label: t('Áp dụng cho giao dịch cũ')}, {
          value: 'no',
          label: t('Chỉ giao dịch mới')
        }]} value={ruleForm.applyToExisting ? 'yes' : 'no'} onChange={value => set({applyToExisting: value === 'yes'})}/> : null}
        <Info>{t('Giao dịch có mô tả chứa mẫu này sẽ được gán MCC tương ứng.')}</Info>
      </Card>
    </Screen>;
  }

  return <Screen title={t('Giao dịch thẻ tín dụng')} subtitle={t('Lọc, thêm, sửa giao dịch và quy tắc merchant')} back>
    <Chips values={[{value: 'transactions', label: t('Giao dịch')}, {value: 'rules', label: t('Quy tắc merchant')}]}
           value={tab} onChange={value => setTab(value as typeof tab)}/>
    {error ? <Info tone="error">{error}</Info> : null}
    {tab === 'transactions' ? <>
      <Button label={t('Thêm giao dịch')} icon="add" onPress={openCreate} disabled={!cards.length}/>
      <Chips values={[{value: '', label: t('Tất cả thẻ')}, ...cardChips]} value={filter.cardId ? String(filter.cardId) : ''}
             onChange={value => setFilter(current => ({...current, cardId: value ? Number(value) : undefined}))}/>
      <Chips values={[{value: '', label: t('Mọi loại')}, ...typeChips]} value={filter.type || ''}
             onChange={value => setFilter(current => ({...current, type: (value || undefined) as CardTransactionType | undefined}))}/>
      <Field label={t('Tìm mô tả / MCC')} value={filter.q || ''} returnKeyType="search"
             onChangeText={value => setFilter(current => ({...current, q: value}))} onSubmitEditing={() => load(0, false)}/>
      <Row><View style={{flex: 1}}><Field label={t('Từ ngày')} value={filter.fromDate || ''} placeholder="YYYY-MM-DD"
                                          autoCapitalize="none"
                                          onChangeText={value => setFilter(current => ({...current, fromDate: value || undefined}))}/></View><View
        style={{flex: 1}}><Field label={t('Đến ngày')} value={filter.toDate || ''} placeholder="YYYY-MM-DD"
                                 autoCapitalize="none"
                                 onChangeText={value => setFilter(current => ({...current, toDate: value || undefined}))}/></View></Row>
      <Button label={t('Áp dụng bộ lọc')} kind="secondary" icon="funnel-outline" onPress={() => load(0, false)}/>
      {loading && !items.length ? <ActivityIndicator color={c.primary}/> : items.length ? items.map(tx => <Card key={tx.id}>
        <Row><View style={{flex: 1}}><T size={14} bold>{tx.description}</T><T size={10} color={c.muted}>
          {dateLabel(tx.transactionDate)} · {tx.cardNickname} •{tx.cardLastFour}{tx.mccCode ? ` · MCC ${tx.mccCode}` : ''}
        </T>{tx.categoryName ? <T size={10} color={c.muted}>{tx.categoryName}</T> : null}</View><View
          style={{alignItems: 'flex-end', gap: 4}}><T size={13} bold
                                                     color={tx.transactionType === 'SPENDING' || tx.transactionType === 'FEE' || tx.transactionType === 'INTEREST' ? c.text : c.success}>{money(tx.amount, tx.currency, lang)}</T><Badge
          tone={tx.source === 'AI_IMPORT' ? 'primary' : 'muted'}>{t(TYPE_LABELS[tx.transactionType])}</Badge></View></Row>
        <Row><View style={{flex: 1}}><Button label={t('Sửa')} kind="secondary" icon="create-outline"
                                             onPress={() => openEdit(tx)}/></View><View style={{flex: 1}}><Button
          label={t('Nhớ merchant')} kind="secondary" icon="bookmark-outline" onPress={() => {
          setTab('rules');
          setRuleForm({
            id: null, version: null, label: '', applyToExisting: true, mccCode: tx.mccCode || '',
            pattern: tx.description.toLowerCase().replace(/\s+/g, ' ').trim().split(/[0-9*#]/)[0].trim().slice(0, 40)
          });
        }}/></View><Pressable accessibilityRole="button" accessibilityLabel={t('Xóa')} onPress={() => setDeleting(tx)}
                              style={{padding: 10}}><T color={c.error}>{t('Xóa')}</T></Pressable></Row>
      </Card>) : <Empty title={t('Chưa có giao dịch thẻ')} description={t('Thử đổi bộ lọc hoặc thêm giao dịch mới.')}/>}
      {page + 1 < totalPages ? <Button label={t('Tải thêm')} kind="secondary" loading={loading}
                                       onPress={() => load(page + 1, true)}/> : null}
    </> : <>
      <Button label={t('Thêm quy tắc')} icon="add" onPress={() => setRuleForm({
        id: null, version: null, pattern: '', mccCode: '', label: '', applyToExisting: true
      })}/>
      <Section title={t('Quy tắc merchant → MCC')}/>
      {rules.length ? rules.map(rule => <Card key={rule.id}><Row><View style={{flex: 1}}><T size={14}
                                                                                            bold>{rule.pattern}</T><T
        size={10} color={c.muted}>{rule.label || t('Không có nhãn')} · {dateLabel(rule.updatedAt)}</T></View><Badge>MCC {rule.mccCode}</Badge></Row><Row><View
        style={{flex: 1}}><Button label={t('Sửa')} kind="secondary" icon="create-outline" onPress={() => setRuleForm({
        id: rule.id, version: rule.version, pattern: rule.pattern, mccCode: rule.mccCode, label: rule.label || '',
        applyToExisting: false
      })}/></View><View style={{flex: 1}}><Button label={t('Xóa')} kind="danger" icon="trash-outline"
                                                   onPress={() => setDeletingRule(rule)}/></View></Row></Card>) :
        <Empty title={t('Chưa có quy tắc')} description={t('Quy tắc giúp tự gán MCC cho giao dịch có cùng merchant.')}/>}
    </>}
    <Dialog visible={!!deleting} title={t('Xóa giao dịch?')} message={deleting?.description || ''}
            onClose={() => setDeleting(null)} onConfirm={() => void remove()} confirmLabel={t('Xóa')}/>
    <Dialog visible={!!deletingRule} title={t('Xóa quy tắc?')} message={deletingRule?.pattern || ''}
            onClose={() => setDeletingRule(null)} onConfirm={() => void removeRule()} confirmLabel={t('Xóa')}/>
    {dialog}
  </Screen>;
}
