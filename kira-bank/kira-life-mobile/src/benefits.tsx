import React, {useCallback, useEffect, useState} from 'react';
import {ActivityIndicator, Alert, Pressable, View} from 'react-native';
import {useFocusEffect} from 'expo-router';
import {bankErrorMessage, CardBenefitResponse, CashbackProgramResponse, useBankApi} from './bankApi';
import {money} from './data';
import {useLanguage, useT} from './i18n';
import {useTheme} from './theme';
import {Badge, Button, Card, Chips, Empty, Field, go, Icon, Info, Row, Screen, Section, T} from './ui';

type GroupDraft = {
  id?: number;
  version?: number;
  categoryName: string;
  cashbackRate: string;
  maxCashbackAmount: string;
  mccCodes: string
};
type ProgramDraft = {
  id?: number;
  version?: number;
  name: string;
  notes: string;
  termsUrl: string;
  active: boolean;
  groups: GroupDraft[]
};

const newGroup = (): GroupDraft => ({categoryName: '', cashbackRate: '', maxCashbackAmount: '', mccCodes: ''});
const newProgram = (): ProgramDraft => ({name: '', notes: '', termsUrl: '', active: true, groups: [newGroup()]});
const groupsFromProgram = (program: CashbackProgramResponse): GroupDraft[] => program.groups.map(group => ({
  id: group.id,
  version: group.version,
  categoryName: group.categoryName,
  cashbackRate: String(group.cashbackRate),
  maxCashbackAmount: String(group.maxCashbackAmount),
  mccCodes: group.mccCodes.join(', ')
}));

function ProgramCard({program, onEdit, onDelete}: {
  program: CashbackProgramResponse;
  onEdit: () => void;
  onDelete: () => void
}) {
  const t = useT();
  const {colors: c} = useTheme();
  return <Card><Row><View style={{flex: 1}}><T size={14} bold>{program.name}</T><T size={10}
                                                                                   color={c.muted}>{program.notes || t('Chưa có mô tả')} {program.termsUrl ? ` · ${program.termsUrl}` : ''}</T></View><Badge
    tone={program.active ? 'success' : 'muted'}>{program.active ? t('Đang bật') : t('Đã tắt')}</Badge></Row>{program.groups.map(group =>
    <View key={group.id} style={{marginTop: 12, padding: 11, borderRadius: 16, backgroundColor: c.surface}}><Row><T
      size={12} bold style={{flex: 1}}>{group.categoryName}</T><T size={12} color={c.primary}>{group.cashbackRate}%</T></Row><T
      size={10}
      color={c.muted}>{t('Trần {{amount}}/tháng', {amount: money(group.maxCashbackAmount, undefined, 'vi')})}</T><Row
      style={{flexWrap: 'wrap', gap: 6}}>{group.mccCodes.map(code => <Badge
      key={code}>{code}</Badge>)}</Row></View>)}<Row style={{marginTop: 12}}><View style={{flex: 1}}><Button
    label={t('Chỉnh sửa')} kind="secondary" icon="pencil-outline" onPress={onEdit}/></View><View
    style={{flex: 1}}><Button label={t('Xóa')} kind="danger" icon="trash-outline"
                              onPress={onDelete}/></View></Row></Card>;
}

function ProgramEditor({draft, setDraft, onCancel, onSave, saving}: {
  draft: ProgramDraft;
  setDraft: React.Dispatch<React.SetStateAction<ProgramDraft | null>>;
  onCancel: () => void;
  onSave: () => void;
  saving: boolean
}) {
  const t = useT();
  const {colors: c} = useTheme();
  const update = (key: keyof ProgramDraft, value: string | boolean) => setDraft(current => current ? {
    ...current,
    [key]: value
  } : current);
  const updateGroup = (index: number, key: keyof GroupDraft, value: string) => setDraft(current => current ? {
    ...current,
    groups: current.groups.map((group, i) => i === index ? {...group, [key]: value} : group)
  } : current);
  return <Card tint><Row><T size={16} bold
                            style={{flex: 1}}>{draft.id ? t('Chỉnh sửa chương trình') : t('Thêm chương trình')}</T><Pressable
    accessibilityRole="button" accessibilityLabel={t('Đóng')} onPress={onCancel} style={{padding: 8}}><Icon name="close"
                                                                                                            color={c.muted}
                                                                                                            size={20}/></Pressable></Row><Field
    label={t('Tên chương trình *')} value={draft.name} onChangeText={value => update('name', value)}
    placeholder={t('Ví dụ: Hoàn tiền chi tiêu hằng ngày')}/><Field label={t('Mô tả')} value={draft.notes}
                                                                   onChangeText={value => update('notes', value)}
                                                                   multiline/><Field label={t('Link điều khoản')}
                                                                                     value={draft.termsUrl}
                                                                                     onChangeText={value => update('termsUrl', value)}
                                                                                     autoCapitalize="none"
                                                                                     keyboardType="url"/><T size={12}
                                                                                                            color={c.muted}>{t('Trạng thái')}</T><Chips
    value={draft.active ? 'active' : 'inactive'} onChange={value => update('active', value === 'active')}
    values={[{value: 'active', label: t('Đang bật')}, {value: 'inactive', label: t('Đã tắt')}]}/><Section
    title={t('Nhóm danh mục & MCC')}/>{draft.groups.map((group, index) => <View key={`${group.id || 'new'}-${index}`}
                                                                                style={{
                                                                                  gap: 9,
                                                                                  padding: 12,
                                                                                  borderRadius: 18,
                                                                                  backgroundColor: c.surface
                                                                                }}><Row><T size={12} bold
                                                                                           style={{flex: 1}}>{t('Nhóm {{n}}', {n: index + 1})}</T>{draft.groups.length > 1 ?
    <Pressable accessibilityRole="button" onPress={() => setDraft(current => current ? {
      ...current,
      groups: current.groups.filter((_, i) => i !== index)
    } : current)} style={{padding: 6}}><Icon name="trash-outline" color={c.error} size={17}/></Pressable> : null}
  </Row><Field label={t('Tên danh mục *')} value={group.categoryName}
               onChangeText={value => updateGroup(index, 'categoryName', value)}
               placeholder={t('Ăn uống, mua sắm...')}/><Row><View style={{flex: 1}}><Field label={t('Tỷ lệ % *')}
                                                                                           value={group.cashbackRate}
                                                                                           onChangeText={value => updateGroup(index, 'cashbackRate', value.replace(/[^0-9.]/g, ''))}
                                                                                           keyboardType="decimal-pad"/></View><View
    style={{flex: 1}}><Field label={t('Trần/tháng *')} value={group.maxCashbackAmount}
                             onChangeText={value => updateGroup(index, 'maxCashbackAmount', value.replace(/[^0-9.]/g, ''))}
                             keyboardType="decimal-pad"/></View></Row><Field label={t('Mã MCC *')}
                                                                             value={group.mccCodes}
                                                                             onChangeText={value => updateGroup(index, 'mccCodes', value)}
                                                                             placeholder="5812, 5814, 5462"/></View>)}<Button
    label={t('Thêm nhóm MCC')} kind="secondary" icon="add" onPress={() => setDraft(current => current ? {
    ...current,
    groups: [...current.groups, newGroup()]
  } : current)}/><Row><View style={{flex: 1}}><Button label={t('Hủy')} kind="secondary" onPress={onCancel}/></View><View
    style={{flex: 2}}><Button label={t('Lưu chương trình')} icon="checkmark-circle-outline" onPress={onSave}
                              loading={saving}/></View></Row></Card>;
}

export function BenefitsManagement() {
  const api = useBankApi();
  const t = useT();
  const {lang} = useLanguage();
  const {colors: c} = useTheme();
  const [cards, setCards] = useState<CardBenefitResponse[]>([]);
  const [selectedCardId, setSelectedCardId] = useState('');
  const [cap, setCap] = useState('');
  const [draft, setDraft] = useState<ProgramDraft | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const selected = cards.find(card => String(card.cardId) === selectedCardId) || cards[0];
  const load = useCallback(() => {
    setLoading(true);
    api.listBenefits().then(result => {
      setCards(result);
      setSelectedCardId(current => current || (result[0] ? String(result[0].cardId) : ''));
      setError('');
    }).catch(e => setError(t(bankErrorMessage(e)))).finally(() => setLoading(false));
  }, [t]);
  useFocusEffect(useCallback(() => {
    load();
  }, [load]));
  useEffect(() => {
    setCap(selected?.monthlyCashbackCap == null ? '' : String(selected.monthlyCashbackCap));
    setDraft(null);
  }, [selected?.cardId]);

  function startCreate() {
    setNotice('');
    setDraft(newProgram());
  }

  function startEdit(program: CashbackProgramResponse) {
    setNotice('');
    setDraft({
      id: program.id,
      version: program.version,
      name: program.name,
      notes: program.notes || '',
      termsUrl: program.termsUrl || '',
      active: program.active,
      groups: groupsFromProgram(program)
    });
  }

  async function saveCap() {
    const value = Number(cap);
    if (!selected || !Number.isFinite(value) || value <= 0) {
      setError(t('Nhập trần hoàn tiền lớn hơn 0.'));
      return;
    }
    setSaving(true);
    setError('');
    try {
      await api.updateMonthlyCashbackCap(selected.cardId, value, selected.configVersion);
      setNotice(t('Đã lưu trần hoàn tiền cho thẻ.'));
      await load();
    } catch (e) {
      setError(t(bankErrorMessage(e)));
    } finally {
      setSaving(false);
    }
  }

  async function saveProgram() {
    if (!selected || !draft || !draft.name.trim() || !draft.groups.length) {
      setError(t('Nhập tên chương trình và ít nhất một nhóm MCC.'));
      return;
    }
    const seen = new Set<string>();
    const groups = draft.groups.map(group => ({
      ...group,
      codes: group.mccCodes.split(',').map(code => code.trim()).filter(Boolean)
    }));
    const duplicateOrInvalidMcc = groups.some(group => group.codes.some(code => {
      const invalid = !/^\d{4}$/.test(code) || seen.has(code);
      seen.add(code);
      return invalid;
    }));
    if (duplicateOrInvalidMcc || groups.some(group => !group.categoryName.trim() || !Number.isFinite(Number(group.cashbackRate)) || Number(group.cashbackRate) <= 0 || Number(group.cashbackRate) > 100 || !Number.isFinite(Number(group.maxCashbackAmount)) || Number(group.maxCashbackAmount) <= 0 || !group.codes.length)) {
      setError(t('Kiểm tra tên nhóm, tỷ lệ, trần và MCC 4 chữ số; MCC không được trùng.'));
      return;
    }
    setSaving(true);
    setError('');
    try {
      const body = {
        name: draft.name.trim(),
        notes: draft.notes.trim() || null,
        termsUrl: draft.termsUrl.trim() || null,
        active: draft.active,
        groups: groups.map(group => ({
          ...(draft.id && group.id ? {id: group.id, version: group.version} : {}),
          categoryName: group.categoryName.trim(),
          cashbackRate: Number(group.cashbackRate),
          maxCashbackAmount: Number(group.maxCashbackAmount),
          mccCodes: [...new Set(group.codes)]
        }))
      };
      if (draft.id) await api.updateCashbackProgram(selected.cardId, draft.id, {
        ...body,
        version: draft.version!
      }); else await api.createCashbackProgram(selected.cardId, body);
      setDraft(null);
      setNotice(t('Đã lưu chương trình ưu đãi.'));
      await load();
    } catch (e) {
      setError(t(bankErrorMessage(e)));
    } finally {
      setSaving(false);
    }
  }

  function deleteProgram(program: CashbackProgramResponse) {
    if (!selected) return;
    Alert.alert(t('Xóa chương trình?'), t('Các nhóm MCC của chương trình sẽ được ẩn khỏi cấu hình hiện tại.'), [{
      text: t('Hủy'),
      style: 'cancel'
    }, {
      text: t('Xóa'), style: 'destructive', onPress: async () => {
        setSaving(true);
        setError('');
        try {
          await api.deleteCashbackProgram(selected.cardId, program.id, program.version);
          setNotice(t('Đã xóa chương trình ưu đãi.'));
          await load();
        } catch (e) {
          setError(t(bankErrorMessage(e)));
        } finally {
          setSaving(false);
        }
      }
    }]);
  }

  if (loading) return <Screen title={t('Ưu đãi & hoàn tiền')} back><ActivityIndicator color={c.primary}/></Screen>;
  if (!cards.length) return <Screen title={t('Ưu đãi & hoàn tiền')} subtitle={t('Cấu hình ưu đãi riêng cho từng thẻ')}
                                    back><Empty title={t('Chưa có thẻ')}
                                                description={t('Thêm thẻ trước khi cấu hình ưu đãi.')}
                                                action={t('Quản lý thẻ')} onPress={() => go('cards')}/></Screen>;
  return <Screen title={t('Ưu đãi & hoàn tiền')} subtitle={t('Cấu hình ưu đãi riêng cho từng thẻ')} back><Row><View
    style={{flex: 1}}><T size={21} bold>{t('Quản lý ưu đãi')}</T><T size={11}
                                                                    color={c.muted}>{t('{{n}} thẻ có thể cấu hình', {n: cards.length})}</T></View><Button
    label={t('Thêm chương trình')} icon="add" onPress={startCreate} disabled={!selected}/></Row><Chips
    value={String(selected?.cardId || '')} onChange={setSelectedCardId} values={cards.map(card => ({
    value: String(card.cardId),
    label: `${card.nickname} •••• ${card.lastFour}`
  }))}/>{error ? <Info tone="error">{error}</Info> : null}{notice ?
    <Info tone="success">{notice}</Info> : null}{selected ? <><Card tint><Row><Icon name="card-outline"/><View
    style={{flex: 1}}><T size={11} color={c.muted}>{selected.bankName} · {selected.cardType}</T><T size={14}
                                                                                                   bold>{selected.nickname} ·•••• {selected.lastFour}</T></View><Badge
    tone={selected.status === 'ACTIVE' ? 'success' : 'muted'}>{t(selected.status === 'ACTIVE' ? 'Hoạt động' : 'Không hoạt động')}</Badge></Row><Field
    label={t('Trần hoàn tiền tháng ({{currency}})')} value={cap}
    onChangeText={value => setCap(value.replace(/[^0-9.]/g, ''))} keyboardType="decimal-pad"/><Button
    label={t('Lưu trần hoàn tiền')} kind="secondary" onPress={saveCap} loading={saving}/><T size={10}
                                                                                            color={c.muted}>{t('Phiên bản cấu hình: {{n}}', {n: selected.configVersion ?? 0})} · {money(Number(cap) || 0, selected.currency, lang)}</T></Card><Section
    title={t('Chương trình của thẻ')}/>{selected.programs.length ? selected.programs.map(program => <ProgramCard
      key={program.id} program={program} onEdit={() => startEdit(program)} onDelete={() => deleteProgram(program)}/>) :
    <Empty title={t('Chưa có chương trình')}
           description={t('Tạo chương trình đầu tiên và gán nhiều MCC cho từng nhóm.')} action={t('Thêm chương trình')}
           onPress={startCreate}/>}{draft ?
    <ProgramEditor draft={draft} setDraft={setDraft} onCancel={() => setDraft(null)} onSave={saveProgram}
                   saving={saving}/> : null}<Info>{t('Mỗi nhóm có thể chứa nhiều MCC; dữ liệu được lưu theo từng thẻ và bảo vệ bằng version conflict.')}</Info></> : null}
  </Screen>;
}
