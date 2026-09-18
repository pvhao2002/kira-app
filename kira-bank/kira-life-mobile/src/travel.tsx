import * as DocumentPicker from 'expo-document-picker';
import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {ActivityIndicator, Image, Pressable, View} from 'react-native';
import {router, useFocusEffect} from 'expo-router';
import {dateLabel, money, validDate} from './data';
import {useAuth} from './auth';
import {
  emptyTravelData,
  TravelData,
  travelErrorMessage,
  TravelFile,
  travelFileUri,
  TravelSummary,
  TravelTrip,
  useTravelApi,
} from './travelApi';
import {useT} from './i18n';
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
  Row,
  Screen,
  Section,
  T,
  useNotice
} from './ui';

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

function progressFor(data: TravelData) {
  const total = data.shopping.length + data.preparations.length + data.checklist.length;
  const completed = data.shopping.filter(item => item.purchased).length
    + data.preparations.filter(item => item.completed).length
    + data.checklist.filter(item => item.completed).length;
  return {total, completed, percent: total ? Math.round(completed / total * 100) : 0};
}

function summaryFor(data: TravelData): TravelSummary {
  const paid: Record<string, number> = {};
  const owed: Record<string, number> = {};
  data.members.forEach(member => {
    paid[member.id] = 0;
    owed[member.id] = 0;
  });
  let total = 0;
  data.expenses.forEach(expense => {
    total += expense.amount;
    paid[expense.paidBy] = (paid[expense.paidBy] || 0) + expense.amount;
    const share = expense.amount / Math.max(1, expense.participants.length);
    expense.participants.forEach(memberId => {
      owed[memberId] = (owed[memberId] || 0) + share;
    });
  });
  const net: Record<string, number> = {};
  const balances = data.members.map(member => {
    const value = (paid[member.id] || 0) - (owed[member.id] || 0);
    net[member.id] = value;
    return {memberId: member.id, paid: paid[member.id] || 0, share: owed[member.id] || 0, net: value};
  });
  const transfers: { from: string; to: string; amount: number }[] = [];
  for (const debtor of data.members) {
    if ((net[debtor.id] || 0) >= 0) continue;
    for (const creditor of data.members) {
      if ((net[creditor.id] || 0) <= 0) continue;
      const amount = Math.min(-(net[debtor.id] || 0), net[creditor.id] || 0);
      if (amount <= 0) continue;
      transfers.push({from: debtor.id, to: creditor.id, amount});
      net[debtor.id] += amount;
      net[creditor.id] -= amount;
    }
  }
  return {total, balances, transfers};
}

function TravelCard({trip}: { trip: TravelTrip }) {
  const t = useT();
  const {colors: c} = useTheme();
  const progress = progressFor(trip.data);
  return <Pressable accessibilityRole="button" accessibilityLabel={trip.data.name}
                    onPress={() => go('travel-edit', {id: trip.id})}>
    <Card tint style={{gap: 14}}><Row><View style={{flex: 1}}><T size={17} bold>{trip.data.name}</T><T size={11}
                                                                                                       color={c.muted}>{trip.data.destination}</T></View><Badge
      tone={progress.percent === 100 && progress.total > 0 ? 'success' : 'primary'}>{progress.total ? `${progress.percent}%` : t('Mới')}</Badge></Row>
      <Row><Metric label={t('THỜI GIAN')}
                   value={`${dateLabel(trip.data.startDate)} → ${dateLabel(trip.data.endDate)}`}/><Metric
        label={t('NGÂN SÁCH')} value={money(trip.data.budget, trip.data.currency)}/></Row>
      <Row><T size={10} color={c.muted} style={{flex: 1}}>{t('{{n}} địa điểm · {{m}} lịch trình', {
        n: trip.data.places.length,
        m: trip.data.activities.length
      })}</T><T size={10} color={c.primary}>{t('{{done}}/{{total}} việc hoàn tất', {
        done: progress.completed,
        total: progress.total
      })} ›</T></Row>
    </Card>
  </Pressable>;
}

export function TravelPlans() {
  const api = useTravelApi();
  const t = useT();
  const {colors: c} = useTheme();
  const [trips, setTrips] = useState<TravelTrip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback(() => {
    setLoading(true);
    api.listTrips().then(setTrips).catch(e => setError(t(travelErrorMessage(e)))).finally(() => setLoading(false));
  }, [t]);
  useFocusEffect(useCallback(() => {
    load();
  }, [load]));
  return <Screen title={t('Du lịch')} subtitle={t('Lập kế hoạch, chuẩn bị và theo dõi hành trình')}>
    <Row><View style={{flex: 1}}><T size={22} bold>{t('Kế hoạch du lịch')}</T><T size={11}
                                                                                 color={c.muted}>{t('Mọi việc cần mua, cần chuẩn bị và nơi sẽ đến ở cùng một chỗ.')}</T></View><Button
      label={t('Tạo mới')} icon="add" onPress={() => go('travel-edit')}/></Row>
    <Info>{t('Bạn có thể lưu nhiều chuyến đi độc lập, chỉnh sửa lại bất cứ lúc nào và không làm thay đổi dữ liệu đầu tư.')}</Info>
    {error ? <Info tone="error">{error}</Info> : null}
    {loading ? <ActivityIndicator color={c.primary}/> : trips.length ? trips.map(trip => <TravelCard key={trip.id}
                                                                                                     trip={trip}/>) :
      <Empty title={t('Chưa có kế hoạch du lịch')}
             description={t('Tạo kế hoạch đầu tiên để quản lý địa điểm, lịch trình và checklist.')}
             action={t('Tạo kế hoạch')} onPress={() => go('travel-edit')}/>}
  </Screen>;
}

function CheckRow({done, label, detail, onToggle, onDelete}: {
  done: boolean;
  label: string;
  detail?: string;
  onToggle: () => void;
  onDelete: () => void
}) {
  const {colors: c} = useTheme();
  return <Row style={{alignItems: 'flex-start', gap: 8}}><Pressable accessibilityRole="checkbox"
                                                                    accessibilityState={{checked: done}}
                                                                    onPress={onToggle}
                                                                    style={{paddingTop: 2, minWidth: 28}}><Icon
    name={done ? 'checkbox' : 'square-outline'} color={done ? c.success : c.muted} size={20}/></Pressable><View
    style={{flex: 1}}><T bold={done} color={done ? c.muted : c.text}
                         style={done ? {textDecorationLine: 'line-through'} : undefined}>{label}</T>{detail ?
    <T size={10} color={c.muted}>{detail}</T> : null}</View><Pressable accessibilityRole="button"
                                                                       accessibilityLabel="Xóa" onPress={onDelete}
                                                                       style={{padding: 4}}><Icon name="trash-outline"
                                                                                                  color={c.error}
                                                                                                  size={16}/></Pressable></Row>;
}

function ListSection({title, count, children}: { title: string; count: number; children: React.ReactNode }) {
  const t = useT();
  return <><Section title={`${title} (${count})`}/><Card>{children ||
    <T size={11} color="#71889a">{t('Chưa có mục nào')}</T>}</Card></>;
}

export function TravelEditor({id}: { id?: string }) {
  const api = useTravelApi();
  const {authHeader} = useAuth();
  const t = useT();
  const {colors: c} = useTheme();
  const {notify, dialog} = useNotice();
  const editing = !!id;
  const [data, setData] = useState<TravelData>(emptyTravelData);
  const [version, setVersion] = useState(0);
  const [loading, setLoading] = useState(editing);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [error, setError] = useState('');
  const [files, setFiles] = useState<TravelFile[]>([]);
  const [fileBusy, setFileBusy] = useState(false);
  const [deleteFile, setDeleteFile] = useState<TravelFile | null>(null);
  const [shopping, setShopping] = useState({name: '', category: 'Đồ dùng', quantity: '1'});
  const [preparation, setPreparation] = useState({title: '', dueDate: '', notes: ''});
  const [place, setPlace] = useState({name: '', address: '', latitude: '', longitude: '', notes: ''});
  const [activity, setActivity] = useState({date: '', time: '', title: '', location: '', notes: ''});
  const [checklist, setChecklist] = useState({title: '', category: 'Việc cần làm'});
  const [member, setMember] = useState({name: ''});
  const [packing, setPacking] = useState({name: '', category: 'Hành lý', quantity: '1'});
  const [expense, setExpense] = useState({
    title: '',
    date: new Date().toISOString().slice(0, 10),
    amount: '',
    paidBy: 'self',
    participants: ['self']
  });
  const [booking, setBooking] = useState({
    title: '',
    type: 'OTHER',
    reference: '',
    date: new Date().toISOString().slice(0, 10),
    notes: '',
    url: ''
  });

  useEffect(() => {
    if (!editing || !id) return;
    Promise.all([api.getTrip(id), api.listFiles(id)]).then(([trip, attachments]) => {
      setData(trip.data);
      setVersion(trip.version);
      setFiles(attachments);
    }).catch(e => setError(t(travelErrorMessage(e)))).finally(() => setLoading(false));
  }, [id, t]);

  const change = <K extends keyof TravelData>(key: K, value: TravelData[K]) => setData(previous => ({
    ...previous,
    [key]: value
  }));
  const addShopping = () => {
    if (!shopping.name.trim()) return notify(t('Nhập tên món cần mua.'));
    change('shopping', [...data.shopping, {
      id: uid(),
      name: shopping.name.trim(),
      category: shopping.category.trim() || 'Khác',
      quantity: Math.max(1, Number(shopping.quantity) || 1),
      purchased: false
    }]);
    setShopping({name: '', category: shopping.category, quantity: '1'});
  };
  const addPreparation = () => {
    if (!preparation.title.trim()) return notify(t('Nhập việc cần chuẩn bị.'));
    change('preparations', [...data.preparations, {
      id: uid(),
      title: preparation.title.trim(),
      notes: preparation.notes.trim(),
      dueDate: preparation.dueDate.trim() || null,
      completed: false
    }]);
    setPreparation({title: '', dueDate: '', notes: ''});
  };
  const addPlace = () => {
    if (!place.name.trim() || !place.address.trim()) return notify(t('Nhập tên và địa chỉ địa điểm.'));
    change('places', [...data.places, {
      id: uid(),
      name: place.name.trim(),
      address: place.address.trim(),
      latitude: Number(place.latitude) || 0,
      longitude: Number(place.longitude) || 0,
      notes: place.notes.trim(),
      visited: false
    }]);
    setPlace({name: '', address: '', latitude: '', longitude: '', notes: ''});
  };
  const addActivity = () => {
    if (!activity.title.trim() || !activity.date.trim() || !validDate(activity.date)) return notify(t('Nhập lịch trình và ngày hợp lệ dạng YYYY-MM-DD.'));
    change('activities', [...data.activities, {
      id: uid(),
      date: activity.date.trim(),
      time: activity.time.trim(),
      title: activity.title.trim(),
      location: activity.location.trim() || '—',
      notes: activity.notes.trim()
    }]);
    setActivity({date: '', time: '', title: '', location: '', notes: ''});
  };
  const addChecklist = () => {
    if (!checklist.title.trim()) return notify(t('Nhập tên việc trong checklist.'));
    change('checklist', [...data.checklist, {
      id: uid(),
      title: checklist.title.trim(),
      category: checklist.category.trim() || 'Việc cần làm',
      completed: false
    }]);
    setChecklist({title: '', category: checklist.category});
  };
  const addMember = () => {
    if (!member.name.trim()) return notify(t('Nhập tên thành viên.'));
    change('members', [...data.members, {id: uid(), name: member.name.trim()}]);
    setMember({name: ''});
  };
  const addPacking = () => {
    if (!packing.name.trim()) return notify(t('Nhập món hành lý.'));
    change('packing', [...data.packing, {
      id: uid(),
      name: packing.name.trim(),
      category: packing.category.trim() || 'Hành lý',
      quantity: Math.max(1, Number(packing.quantity) || 1),
      packed: false
    }]);
    setPacking({name: '', category: packing.category, quantity: '1'});
  };
  const addExpense = () => {
    const amount = Number(expense.amount.replace(',', '.'));
    if (!expense.title.trim() || !validDate(expense.date) || !Number.isFinite(amount) || amount <= 0 || !data.members.some(memberItem => memberItem.id === expense.paidBy) || !expense.participants.length) return notify(t('Nhập chi phí, ngày, người trả và người tham gia hợp lệ.'));
    change('expenses', [...data.expenses, {
      id: uid(),
      title: expense.title.trim(),
      date: expense.date,
      amount,
      paidBy: expense.paidBy,
      participants: expense.participants
    }]);
    setExpense(current => ({...current, title: '', amount: ''}));
  };
  const addBooking = () => {
    if (!booking.title.trim() || !booking.reference.trim() || !validDate(booking.date) || (booking.url.trim() && !/^https?:\/\/[^\s]+$/i.test(booking.url.trim()))) return notify(t('Nhập booking, mã tham chiếu, ngày và link hợp lệ.'));
    change('bookings', [...data.bookings, {
      id: uid(),
      title: booking.title.trim(),
      type: booking.type,
      reference: booking.reference.trim(),
      date: booking.date,
      notes: booking.notes.trim(),
      url: booking.url.trim()
    }]);
    setBooking(current => ({...current, title: '', reference: '', notes: '', url: ''}));
  };
  const removeMember = (memberId: string) => {
    if (memberId === 'self') return;
    if (data.expenses.some(expenseItem => expenseItem.paidBy === memberId || expenseItem.participants.includes(memberId))) return notify(t('Không thể xóa thành viên đang có trong chi phí.'));
    change('members', data.members.filter(value => value.id !== memberId));
    setExpense(current => ({
      ...current,
      participants: current.participants.filter(idValue => idValue !== memberId),
      paidBy: current.paidBy === memberId ? 'self' : current.paidBy
    }));
  };

  async function save() {
    if (!data.name.trim() || !data.destination.trim()) {
      setError(t('Nhập tên chuyến đi và điểm đến.'));
      return;
    }
    if (!validDate(data.startDate) || !validDate(data.endDate) || data.endDate < data.startDate) {
      setError(t('Ngày bắt đầu và kết thúc không hợp lệ.'));
      return;
    }
    setSaving(true);
    setError('');
    try {
      const payload = {
        ...data,
        name: data.name.trim(),
        destination: data.destination.trim(),
        notes: data.notes.trim(),
        budget: Math.max(0, Number(data.budget) || 0)
      };
      if (editing && id) await api.updateTrip(id, payload, version); else await api.createTrip(payload);
      router.back();
    } catch (e) {
      setError(t(travelErrorMessage(e)));
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!id) return;
    setDeleting(true);
    try {
      await api.deleteTrip(id, version);
      setDeleteOpen(false);
      router.back();
    } catch (e) {
      setError(t(travelErrorMessage(e)));
      setDeleteOpen(false);
    } finally {
      setDeleting(false);
    }
  }

  async function chooseFile() {
    if (!id) {
      notify(t('Hãy lưu chuyến đi trước khi thêm tài liệu.'));
      return;
    }
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'image/png', 'image/jpeg'],
      multiple: false,
      copyToCacheDirectory: true
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    setFileBusy(true);
    setError('');
    try {
      const saved = await api.uploadFile(id, {
        uri: asset.uri,
        name: asset.name,
        type: asset.mimeType || 'application/octet-stream'
      });
      setFiles(current => [...current, saved]);
      notify(t('Đã tải tài liệu lên chuyến đi.'));
    } catch (e) {
      setError(t(travelErrorMessage(e)));
    } finally {
      setFileBusy(false);
    }
  }

  async function removeAttachment() {
    if (!id || !deleteFile) return;
    setFileBusy(true);
    try {
      await api.deleteFile(id, deleteFile.id);
      setFiles(current => current.filter(file => file.id !== deleteFile.id));
      setDeleteFile(null);
      notify(t('Đã xóa tài liệu.'));
    } catch (e) {
      setError(t(travelErrorMessage(e)));
    } finally {
      setFileBusy(false);
    }
  }

  const progress = useMemo(() => progressFor(data), [data]);
  const tripSummary = useMemo(() => summaryFor(data), [data]);
  if (loading) return <Screen title={t('Kế hoạch du lịch')} back><ActivityIndicator color={c.primary}/></Screen>;
  return <Screen title={editing ? t('Chỉnh sửa kế hoạch') : t('Tạo kế hoạch du lịch')}
                 subtitle={t('Lưu từng phần để không bỏ sót việc cần làm')} back
                 footer={<Row><View style={{flex: 1}}><Button label={t('Hủy')} kind="secondary"
                                                              onPress={() => router.back()}/></View><View
                   style={{flex: 2}}><Button label={editing ? t('Lưu thay đổi') : t('Tạo kế hoạch')}
                                             icon="checkmark-circle-outline" onPress={save}
                                             loading={saving}/></View></Row>}>
    {error ? <Info tone="error">{error}</Info> : null}
    <Card tint><T size={11} color={c.primary}>{t('TỔNG QUAN HÀNH TRÌNH')}</T><Field label={t('Tên chuyến đi *')}
                                                                                    value={data.name}
                                                                                    onChangeText={value => change('name', value)}
                                                                                    placeholder={t('Ví dụ: Đà Nẵng 2026')}/><Field
      label={t('Điểm đến chính *')} value={data.destination} onChangeText={value => change('destination', value)}
      placeholder={t('Ví dụ: Đà Nẵng, Hội An')}/><Row><View style={{flex: 1}}><Field label={t('Bắt đầu *')}
                                                                                     value={data.startDate}
                                                                                     onChangeText={value => change('startDate', value)}
                                                                                     placeholder="YYYY-MM-DD"/></View><View
      style={{flex: 1}}><Field label={t('Kết thúc *')} value={data.endDate}
                               onChangeText={value => change('endDate', value)}
                               placeholder="YYYY-MM-DD"/></View></Row><Row><View style={{flex: 1}}><Field
      label={t('Ngân sách')} value={String(data.budget || '')}
      onChangeText={value => change('budget', Number(value.replace(/[^0-9.]/g, '')) || 0)} keyboardType="decimal-pad"/></View><View
      style={{flex: 1}}><T size={12} color={c.muted}>{t('Tiền tệ')}</T><Chips value={data.currency}
                                                                              values={['VND', 'USD', 'EUR', 'THB'].map(value => ({
                                                                                value,
                                                                                label: value
                                                                              }))}
                                                                              onChange={value => change('currency', value)}/></View></Row><Field
      label={t('Ghi chú chung')} value={data.notes} onChangeText={value => change('notes', value)} multiline
      placeholder={t('Ghi chú, lưu ý hoặc mục tiêu chuyến đi')}/><Row><Metric label={t('ĐỊA ĐIỂM')}
                                                                              value={String(data.places.length)}/><Metric
      label={t('LỊCH TRÌNH')} value={String(data.activities.length)}/><Metric label={t('CHECKLIST')}
                                                                              value={`${progress.completed}/${progress.total}`}/></Row></Card>

    <Section title={t('Thành viên chuyến đi')}/><Card><T size={11}
                                                         color={c.muted}>{t('Thành viên được dùng để chia chi phí và tính quyết toán.')}</T>{data.members.map(memberItem =>
    <Row key={memberItem.id} style={{minHeight: 36}}><Icon
      name={memberItem.id === 'self' ? 'person-circle-outline' : 'person-outline'} size={17}/><T
      style={{flex: 1}}>{memberItem.name}</T>{memberItem.id !== 'self' ?
      <Pressable accessibilityRole="button" accessibilityLabel={t('Xóa thành viên')}
                 onPress={() => removeMember(memberItem.id)} style={{padding: 6}}><Icon name="trash-outline"
                                                                                        color={c.error}
                                                                                        size={16}/></Pressable> : null}
    </Row>)}<Row><Field label={t('Tên thành viên')} value={member.name} onChangeText={value => setMember({name: value})}
                        placeholder={t('Ví dụ: Minh')} style={{flex: 1}}/><Button label={t('Thêm')} icon="add"
                                                                                  onPress={addMember}/></Row></Card>
    <ListSection title={t('Hành lý')} count={data.packing.length}>{data.packing.map(item => <CheckRow key={item.id}
                                                                                                      done={item.packed}
                                                                                                      label={`${item.name} × ${item.quantity}`}
                                                                                                      detail={item.category}
                                                                                                      onToggle={() => change('packing', data.packing.map(current => current.id === item.id ? {
                                                                                                        ...current,
                                                                                                        packed: !current.packed
                                                                                                      } : current))}
                                                                                                      onDelete={() => change('packing', data.packing.filter(current => current.id !== item.id))}/>)}<View
      style={{gap: 8, marginTop: 8}}><Row><View style={{flex: 2}}><Field label={t('Tên món')} value={packing.name}
                                                                         onChangeText={value => setPacking(current => ({
                                                                           ...current,
                                                                           name: value
                                                                         }))}/></View><View style={{flex: 1}}><Field
      label={t('SL')} value={packing.quantity}
      onChangeText={value => setPacking(current => ({...current, quantity: value}))}
      keyboardType="numeric"/></View></Row><Row><Field label={t('Nhóm')} value={packing.category}
                                                       onChangeText={value => setPacking(current => ({
                                                         ...current,
                                                         category: value
                                                       }))} style={{flex: 1}}/><Button label={t('Thêm')} icon="add"
                                                                                       onPress={addPacking}/></Row></View></ListSection>
    <ListSection title={t('Đồ cần mua')} count={data.shopping.length}>{data.shopping.map(item => <CheckRow key={item.id}
                                                                                                           done={item.purchased}
                                                                                                           label={`${item.name} × ${item.quantity}`}
                                                                                                           detail={item.category}
                                                                                                           onToggle={() => change('shopping', data.shopping.map(current => current.id === item.id ? {
                                                                                                             ...current,
                                                                                                             purchased: !current.purchased
                                                                                                           } : current))}
                                                                                                           onDelete={() => change('shopping', data.shopping.filter(current => current.id !== item.id))}/>)}<View
      style={{gap: 8, marginTop: 8}}><Row><View style={{flex: 2}}><Field label={t('Tên món')} value={shopping.name}
                                                                         onChangeText={value => setShopping(current => ({
                                                                           ...current,
                                                                           name: value
                                                                         }))}/></View><View style={{flex: 1}}><Field
      label={t('SL')} value={shopping.quantity}
      onChangeText={value => setShopping(current => ({...current, quantity: value}))}
      keyboardType="numeric"/></View></Row><Row><View style={{flex: 1}}><Field label={t('Nhóm')}
                                                                               value={shopping.category}
                                                                               onChangeText={value => setShopping(current => ({
                                                                                 ...current,
                                                                                 category: value
                                                                               }))}/></View><Button label={t('Thêm')}
                                                                                                    icon="add"
                                                                                                    onPress={addShopping}/></Row></View></ListSection>

    <ListSection title={t('Việc cần chuẩn bị')} count={data.preparations.length}>{data.preparations.map(item =>
      <CheckRow key={item.id} done={item.completed} label={item.title}
                detail={[item.dueDate ? `${t('Hạn')}: ${dateLabel(item.dueDate)}` : '', item.notes].filter(Boolean).join(' · ')}
                onToggle={() => change('preparations', data.preparations.map(current => current.id === item.id ? {
                  ...current,
                  completed: !current.completed
                } : current))}
                onDelete={() => change('preparations', data.preparations.filter(current => current.id !== item.id))}/>)}<View
      style={{gap: 8, marginTop: 8}}><Field label={t('Việc cần làm')} value={preparation.title}
                                            onChangeText={value => setPreparation(current => ({
                                              ...current,
                                              title: value
                                            }))} placeholder={t('Ví dụ: Đổi tiền, mua bảo hiểm')}/><Row><View
      style={{flex: 1}}><Field label={t('Hạn hoàn tất')} value={preparation.dueDate}
                               onChangeText={value => setPreparation(current => ({...current, dueDate: value}))}
                               placeholder="YYYY-MM-DD"/></View><Button label={t('Thêm')} icon="add"
                                                                        onPress={addPreparation}/></Row><Field
      label={t('Ghi chú')} value={preparation.notes}
      onChangeText={value => setPreparation(current => ({...current, notes: value}))}/></View></ListSection>

    <ListSection title={t('Các địa điểm sẽ đến')} count={data.places.length}>{data.places.map(item => <CheckRow
      key={item.id} done={item.visited} label={item.name}
      detail={`${item.address}${item.notes ? ` · ${item.notes}` : ''}`}
      onToggle={() => change('places', data.places.map(current => current.id === item.id ? {
        ...current,
        visited: !current.visited
      } : current))} onDelete={() => change('places', data.places.filter(current => current.id !== item.id))}/>)}<View
      style={{gap: 8, marginTop: 8}}><Field label={t('Tên địa điểm')} value={place.name}
                                            onChangeText={value => setPlace(current => ({...current, name: value}))}
                                            placeholder={t('Ví dụ: Bà Nà Hills')}/><Field label={t('Địa chỉ')}
                                                                                          value={place.address}
                                                                                          onChangeText={value => setPlace(current => ({
                                                                                            ...current,
                                                                                            address: value
                                                                                          }))}/><Row><View
      style={{flex: 1}}><Field label={t('Vĩ độ')} value={place.latitude}
                               onChangeText={value => setPlace(current => ({...current, latitude: value}))}
                               keyboardType="decimal-pad"/></View><View style={{flex: 1}}><Field label={t('Kinh độ')}
                                                                                                 value={place.longitude}
                                                                                                 onChangeText={value => setPlace(current => ({
                                                                                                   ...current,
                                                                                                   longitude: value
                                                                                                 }))}
                                                                                                 keyboardType="decimal-pad"/></View></Row><Row><View
      style={{flex: 1}}><Field label={t('Ghi chú')} value={place.notes}
                               onChangeText={value => setPlace(current => ({...current, notes: value}))}/></View><Button
      label={t('Thêm')} icon="add" onPress={addPlace}/></Row></View></ListSection>

    <ListSection title={t('Lịch trình đi')}
                 count={data.activities.length}>{data.activities.slice().sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`)).map(item =>
      <CheckRow key={item.id} done={false} label={`${item.date}${item.time ? ` · ${item.time}` : ''} · ${item.title}`}
                detail={`${item.location}${item.notes ? ` · ${item.notes}` : ''}`}
                onToggle={() => notify(t('Lịch trình không có trạng thái hoàn tất; hãy đánh dấu trong checklist.'))}
                onDelete={() => change('activities', data.activities.filter(current => current.id !== item.id))}/>)}<View
      style={{gap: 8, marginTop: 8}}><Row><View style={{flex: 1}}><Field label={t('Ngày')} value={activity.date}
                                                                         onChangeText={value => setActivity(current => ({
                                                                           ...current,
                                                                           date: value
                                                                         }))} placeholder="YYYY-MM-DD"/></View><View
      style={{flex: 1}}><Field label={t('Giờ')} value={activity.time}
                               onChangeText={value => setActivity(current => ({...current, time: value}))}
                               placeholder="09:00"/></View></Row><Field label={t('Hoạt động trong lịch trình')}
                                                                        value={activity.title}
                                                                        onChangeText={value => setActivity(current => ({
                                                                          ...current,
                                                                          title: value
                                                                        }))}
                                                                        placeholder={t('Ví dụ: Tham quan phố cổ')}/><Row><View
      style={{flex: 1}}><Field label={t('Địa điểm')} value={activity.location}
                               onChangeText={value => setActivity(current => ({
                                 ...current,
                                 location: value
                               }))}/></View><Button label={t('Thêm')} icon="add" onPress={addActivity}/></Row><Field
      label={t('Ghi chú')} value={activity.notes}
      onChangeText={value => setActivity(current => ({...current, notes: value}))}/></View></ListSection>

    <ListSection title={t('Checklist chuyến đi')} count={data.checklist.length}>{data.checklist.map(item => <CheckRow
      key={item.id} done={item.completed} label={item.title} detail={item.category}
      onToggle={() => change('checklist', data.checklist.map(current => current.id === item.id ? {
        ...current,
        completed: !current.completed
      } : current))}
      onDelete={() => change('checklist', data.checklist.filter(current => current.id !== item.id))}/>)}<View
      style={{gap: 8, marginTop: 8}}><Row><View style={{flex: 2}}><Field label={t('Tên checklist')}
                                                                         value={checklist.title}
                                                                         onChangeText={value => setChecklist(current => ({
                                                                           ...current,
                                                                           title: value
                                                                         }))}
                                                                         placeholder={t('Ví dụ: Check-in online')}/></View><View
      style={{flex: 1}}><Field label={t('Nhóm')} value={checklist.category}
                               onChangeText={value => setChecklist(current => ({...current, category: value}))}/></View></Row><Button
      label={t('Thêm vào checklist')} icon="add" onPress={addChecklist}/></View></ListSection>
    <ListSection title={t('Chi phí chuyến đi')} count={data.expenses.length}>{data.expenses.map(item => <CheckRow
      key={item.id} done={false} label={`${item.title} · ${money(item.amount, data.currency)}`}
      detail={`${dateLabel(item.date)} · ${t('Người trả')}: ${data.members.find(memberItem => memberItem.id === item.paidBy)?.name || item.paidBy} · ${t('Tham gia')}: ${item.participants.map(memberId => data.members.find(memberItem => memberItem.id === memberId)?.name || memberId).join(', ')}`}
      onToggle={() => notify(t('Chi phí được quyết toán tự động từ danh sách thành viên.'))}
      onDelete={() => change('expenses', data.expenses.filter(current => current.id !== item.id))}/>)}<View
      style={{gap: 8, marginTop: 8}}><Field label={t('Tên khoản chi')} value={expense.title}
                                            onChangeText={value => setExpense(current => ({...current, title: value}))}
                                            placeholder={t('Ví dụ: Khách sạn')}/><Row><View style={{flex: 1}}><Field
      label={t('Ngày chi')} value={expense.date}
      onChangeText={value => setExpense(current => ({...current, date: value}))} placeholder="YYYY-MM-DD"/></View><View
      style={{flex: 1}}><Field label={t('Số tiền')} value={expense.amount}
                               onChangeText={value => setExpense(current => ({...current, amount: value}))}
                               keyboardType="decimal-pad"/></View></Row><T size={11}
                                                                           color={c.muted}>{t('Người trả')}</T><Chips
      value={expense.paidBy} onChange={value => setExpense(current => ({...current, paidBy: value}))}
      values={data.members.map(memberItem => ({value: memberItem.id, label: memberItem.name}))}/><T size={11}
                                                                                                    color={c.muted}>{t('Người tham gia')}</T>{data.members.map(memberItem => {
      const selected = expense.participants.includes(memberItem.id);
      return <Pressable key={memberItem.id} accessibilityRole="checkbox" accessibilityState={{checked: selected}}
                        onPress={() => setExpense(current => ({
                          ...current,
                          participants: selected ? current.participants.filter(idValue => idValue !== memberItem.id) : [...current.participants, memberItem.id]
                        }))} style={{flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 5}}><Icon
        name={selected ? 'checkbox' : 'square-outline'} color={selected ? c.primary : c.muted}
        size={20}/><T>{memberItem.name}</T></Pressable>;
    })}<Button label={t('Thêm chi phí')} icon="add" onPress={addExpense}/></View></ListSection>
    <Card><Section title={t('Quyết toán chi phí')}/><Metric label={t('TỔNG CHI')}
                                                            value={money(tripSummary.total, data.currency)}/>{tripSummary.balances.map(balance =>
      <Row key={balance.memberId}><T size={11}
                                     style={{flex: 1}}>{data.members.find(memberItem => memberItem.id === balance.memberId)?.name || balance.memberId}</T><T
        size={11}
        color={balance.net >= 0 ? c.success : c.warning}>{balance.net >= 0 ? '+' : ''}{money(balance.net, data.currency)}</T></Row>)}{tripSummary.transfers.length ? <>
        <T size={11} bold color={c.primary}>{t('Gợi ý chuyển khoản')}</T>{tripSummary.transfers.map((transfer, index) =>
        <T key={`${transfer.from}-${transfer.to}-${index}`} size={11}
           color={c.muted}>{data.members.find(memberItem => memberItem.id === transfer.from)?.name || transfer.from} → {data.members.find(memberItem => memberItem.id === transfer.to)?.name || transfer.to}: {money(transfer.amount, data.currency)}</T>)}</> :
      <T size={11} color={c.muted}>{t('Chưa có khoản cần quyết toán.')}</T>}</Card>
    <ListSection title={t('Booking & đặt chỗ')} count={data.bookings.length}>{data.bookings.map(item => <CheckRow
      key={item.id} done={false} label={`${item.title} · ${item.reference}`}
      detail={`${dateLabel(item.date)} · ${item.type}${item.url ? ` · ${item.url}` : ''}`}
      onToggle={() => notify(t('Booking được lưu cùng kế hoạch; mở link từ ứng dụng khi cần.'))}
      onDelete={() => change('bookings', data.bookings.filter(current => current.id !== item.id))}/>)}<View
      style={{gap: 8, marginTop: 8}}><Field label={t('Tên booking')} value={booking.title}
                                            onChangeText={value => setBooking(current => ({...current, title: value}))}
                                            placeholder={t('Ví dụ: Vé máy bay')}/><T size={11}
                                                                                     color={c.muted}>{t('Loại booking')}</T><Chips
      value={booking.type} onChange={value => setBooking(current => ({...current, type: value}))}
      values={[{value: 'FLIGHT', label: t('Vé máy bay')}, {value: 'STAY', label: t('Chỗ ở')}, {
        value: 'TRAIN',
        label: t('Tàu hỏa')
      }, {value: 'BUS', label: t('Xe khách')}, {value: 'ACTIVITY', label: t('Hoạt động đặt chỗ')}, {
        value: 'OTHER',
        label: t('Khác')
      }]}/><Row><View style={{flex: 1}}><Field label={t('Mã tham chiếu')} value={booking.reference}
                                               onChangeText={value => setBooking(current => ({
                                                 ...current,
                                                 reference: value
                                               }))}/></View><View style={{flex: 1}}><Field label={t('Ngày booking')}
                                                                                           value={booking.date}
                                                                                           onChangeText={value => setBooking(current => ({
                                                                                             ...current,
                                                                                             date: value
                                                                                           }))}
                                                                                           placeholder="YYYY-MM-DD"/></View></Row><Field
      label={t('Link đặt chỗ')} value={booking.url}
      onChangeText={value => setBooking(current => ({...current, url: value}))} autoCapitalize="none"
      placeholder="https://"/><Field label={t('Ghi chú booking')} value={booking.notes}
                                     onChangeText={value => setBooking(current => ({...current, notes: value}))}
                                     multiline/><Button label={t('Thêm booking')} icon="add"
                                                        onPress={addBooking}/></View></ListSection>
    {editing && id ? <Card><Section
      title={t('Tài liệu chuyến đi')}/><Info>{t('Chỉ nhận PDF, PNG hoặc JPEG; mỗi chuyến đi tối đa 20 tài liệu. File được bảo vệ theo quyền của chuyến đi.')}</Info><Button
      label={t('Thêm tài liệu')} kind="secondary" icon="cloud-upload-outline" onPress={() => void chooseFile()}
      loading={fileBusy}/>{files.length ? files.map(file => <Row key={file.id} style={{
        alignItems: 'flex-start',
        gap: 8
      }}>{file.contentType.startsWith('image/') ? <Image source={{uri: travelFileUri(id, file.id), headers: authHeader()}}
                                                         style={{width: 56, height: 44, borderRadius: 8}}/> : <View
        style={{
          width: 56,
          height: 44,
          borderRadius: 8,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: c.elevated
        }}><Icon name="document-text-outline" size={21}/></View>}<View style={{flex: 1}}><T size={11} bold>{file.name}</T><T
        size={10} color={c.muted}>{file.contentType} · {(file.size / 1024).toFixed(0)} KB</T></View><Pressable
        accessibilityRole="button" accessibilityLabel={t('Xóa tài liệu')} onPress={() => setDeleteFile(file)}
        style={{padding: 8}}><Icon name="trash-outline" color={c.error} size={17}/></Pressable></Row>) :
      <T size={11} color={c.muted}>{t('Chưa có tài liệu chuyến đi.')}</T>}</Card> : null}
    <Info>{t('Các thay đổi chỉ được ghi nhận khi bạn bấm Lưu. Nếu kế hoạch đã được sửa ở thiết bị khác, ứng dụng sẽ báo xung đột để tránh ghi đè.')}</Info>
    {editing ? <Button label={t('Xóa kế hoạch')} kind="danger" icon="trash-outline" onPress={() => setDeleteOpen(true)}
                       loading={deleting}/> : null}
    <Dialog visible={!!deleteFile} title={t('Xóa tài liệu?')}
            message={t('Tài liệu sẽ bị xóa khỏi chuyến đi và không còn hiển thị trong danh sách.')}
            confirmLabel={t('Xóa tài liệu')} onClose={() => setDeleteFile(null)} onConfirm={removeAttachment}/>
    <Dialog visible={deleteOpen} title={t('Xóa kế hoạch du lịch?')}
            message={t('Toàn bộ địa điểm, lịch trình và checklist của kế hoạch này sẽ bị xóa.')}
            onClose={() => setDeleteOpen(false)} onConfirm={remove} confirmLabel={t('Xóa kế hoạch')}/>
    {dialog}
  </Screen>;
}
