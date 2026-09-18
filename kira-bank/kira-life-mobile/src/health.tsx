import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {ActivityIndicator, Pressable, View} from 'react-native';
import {useFocusEffect} from 'expo-router';
import {validDate} from './data';
import {useLanguage, useT} from './i18n';
import {
  HealthAiJob,
  healthErrorMessage,
  healthErrorMessageForCode,
  HealthJournal,
  HealthJournalData,
  HealthPlan,
  HealthPlanItem,
  HealthProfile,
  HealthProfileView,
  HealthSummary,
  HealthWeight,
  useHealthApi,
} from './healthApi';
import {useTheme} from './theme';
import {
  Badge,
  Button,
  Card,
  Chips,
  Dialog,
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

function todayDate() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function addDays(value: string, days: number) {
  const date = new Date(`${value}T12:00:00`);
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function monday(value: string) {
  const date = new Date(`${value}T12:00:00`);
  const offset = (date.getDay() + 6) % 7;
  return addDays(value, -offset);
}

function dateLabel(value: string) {
  return value ? value.split('-').reverse().join('/') : '—';
}

function numberLabel(value: number | null | undefined, digits = 0) {
  return value == null ? '—' : value.toLocaleString('vi-VN', {maximumFractionDigits: digits});
}

function dayName(value: string, lang: 'vi' | 'en') {
  return new Date(`${value}T12:00:00`).toLocaleDateString(lang === 'en' ? 'en-US' : 'vi-VN', {weekday: 'short'});
}

const emptyProfile: HealthProfile = {
  heightCm: 170,
  birthDate: '1990-01-01',
  formulaSex: 'MALE',
  goal: 'MAINTAIN',
  timezone: 'Asia/Ho_Chi_Minh',
  activityFactor: 1.55,
  calorieAdjustment: 0,
  foodPreferences: '',
  allergies: '',
  avoidedFoods: '',
  preparationMinutes: 30,
  exerciseExperience: '',
  equipment: '',
  availability: '',
  movementRestrictions: '',
};

function statusTone(status: string): 'primary' | 'success' | 'warning' | 'error' | 'muted' {
  return status === 'ACTIVE' || status === 'READY' ? 'success' : status === 'FAILED' ? 'error' : status === 'DRAFT' || status === 'RUNNING' ? 'warning' : 'muted';
}

function statusLabel(status: string, t: (value: string) => string) {
  return status === 'DRAFT' ? t('Bản nháp') : status === 'ACTIVE' ? t('Đang hoạt động') : status === 'ARCHIVED' ? t('Đã lưu trữ') : status === 'RUNNING' ? t('Đang tạo') : status === 'READY' ? t('Sẵn sàng') : status === 'FAILED' ? t('Thất bại') : status;
}

function SummaryCard({summary}: { summary: HealthSummary }) {
  const t = useT();
  const {colors: c} = useTheme();
  return <Card tint><Row><View style={{
    width: 42,
    height: 42,
    borderRadius: 22,
    backgroundColor: c.primary + '22',
    alignItems: 'center',
    justifyContent: 'center'
  }}><Icon name="heart-outline" color={c.primary}/></View><View style={{flex: 1}}><T size={18}
                                                                                     bold>{t('Tổng quan hôm nay')}</T><T
    size={11}
    color={c.muted}>{dateLabel(summary.date)} · {summary.targetSource === 'MISSING_PROFILE' ? t('Chưa đủ hồ sơ') : summary.targetSource === 'PROFILE_ESTIMATE' ? t('Ước tính từ hồ sơ') : t('Dữ liệu Apple Health tạm tính')}</T></View><Badge
    tone={summary.provisional ? 'warning' : 'success'}>{summary.provisional ? t('Tạm tính') : t('Đã đồng bộ')}</Badge></Row><Row><Metric
    label={t('BMI')} value={numberLabel(summary.bmi, 1)}/><Metric label={t('ĐÃ ĂN')}
                                                                  value={`${numberLabel(summary.eatenCalories)} kcal`}
                                                                  color={c.lavender}/><Metric label={t('MỤC TIÊU')}
                                                                                              value={summary.targetCalories == null ? '—' : `${numberLabel(summary.targetCalories)} kcal`}
                                                                                              color={c.success}/></Row><Row><Metric
    label={t('BƯỚC ĐI')} value={summary.steps == null ? '—' : numberLabel(summary.steps)}/><Metric label={t('VẬN ĐỘNG')}
                                                                                                   value={summary.activeCalories == null ? '—' : `${numberLabel(summary.activeCalories)} kcal`}/><Metric
    label={t('ĐÃ ĐỐT')}
    value={summary.totalBurned == null ? '—' : `${numberLabel(summary.totalBurned)} kcal`}/></Row>{summary.targetCalories != null ?
    <View style={{gap: 6}}><Row><T size={10} color={c.muted}>{t('Tiến độ năng lượng')}</T><View style={{flex: 1}}/><T
      size={10}
      color={c.primary}>{Math.round(summary.eatenCalories / Math.max(summary.targetCalories, 1) * 100)}%</T></Row><Progress
      value={summary.eatenCalories / Math.max(summary.targetCalories, 1) * 100}
      color={summary.eatenCalories > summary.targetCalories ? c.warning : c.primary}/></View> : <Info
      tone="warning">{t('Hoàn tất hồ sơ và nhập cân nặng để có BMI, mục tiêu năng lượng và kế hoạch cá nhân.')}</Info>}
  </Card>;
}

function Statistics({values, lang}: { values: HealthSummary[]; lang: 'vi' | 'en' }) {
  const t = useT();
  const {colors: c} = useTheme();
  if (!values.length) return null;
  const max = Math.max(...values.map(item => item.eatenCalories), ...values.map(item => item.targetCalories || 0), 1);
  return <><Section title={t('Xu hướng 7 ngày')}/><Card><Row><View style={{flex: 1}}><T size={12}
                                                                                        bold>{t('Năng lượng đã ăn')}</T><T
    size={10} color={c.muted}>{t('Số liệu được tổng hợp theo từng ngày')}</T></View><Icon name="analytics-outline"
                                                                                          color={c.primary}/></Row><View
    style={{gap: 10}}>{values.map(item => <Row key={item.date}><T size={10} color={c.muted}
                                                                  style={{width: 38}}>{dayName(item.date, lang)}</T><View
    style={{flex: 1, gap: 4}}><Progress value={item.eatenCalories / max * 100}
                                        color={item.targetCalories != null && item.eatenCalories > item.targetCalories ? c.warning : c.primary}/><T
    size={9}
    color={c.muted}>{numberLabel(item.eatenCalories)} kcal{item.targetCalories == null ? '' : ` · ${t('mục tiêu')} ${numberLabel(item.targetCalories)}`}</T></View></Row>)}</View></Card></>;
}

function WeightSection({weights, onSaved, onDelete}: {
  weights: HealthWeight[];
  onSaved: () => void;
  onDelete: (date: string) => void
}) {
  const api = useHealthApi();
  const t = useT();
  const {colors: c} = useTheme();
  const {notify} = useNotice();
  const [date, setDate] = useState(todayDate());
  const [kg, setKg] = useState('');
  const [saving, setSaving] = useState(false);

  async function save() {
    const value = Number(kg.replace(',', '.'));
    if (!validDate(date) || !Number.isFinite(value) || value < 20 || value > 500) {
      notify(t('Ngày hoặc cân nặng không hợp lệ.'));
      return;
    }
    setSaving(true);
    try {
      await api.saveWeight(date, value);
      setKg('');
      onSaved();
    } catch (e) {
      notify(t(healthErrorMessage(e)));
    } finally {
      setSaving(false);
    }
  }

  return <><Section title={t('Cân nặng')} action={t('Hồ sơ sức khỏe')} onPress={() => go('health-profile')}/><Card><Row><Field
    label={t('Ngày')} value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" style={{flex: 1}}/><Field
    label={t('Kg')} value={kg} onChangeText={setKg} placeholder="70.5" keyboardType="decimal-pad"
    style={{flex: 1}}/><Button label={t('Lưu')} icon="checkmark-outline" onPress={save} loading={saving}
                               disabled={!kg}/></Row>{weights.length ? weights.slice(0, 8).map(item => <Row
      key={item.date} style={{minHeight: 34}}><Icon name="scale-outline" size={17} color={c.muted}/><T size={12}
                                                                                                       style={{flex: 1}}>{dateLabel(item.date)}</T><T
      size={14} bold color={c.primary}>{numberLabel(item.kg, 2)} kg</T><Pressable accessibilityRole="button"
                                                                                  accessibilityLabel={t('Xóa')}
                                                                                  onPress={() => onDelete(item.date)}
                                                                                  style={{padding: 6}}><Icon
      name="trash-outline" color={c.error} size={16}/></Pressable></Row>) :
    <T size={11} color={c.muted}>{t('Chưa có cân nặng. Nhập số đo đầu tiên để kích hoạt BMI và kế hoạch AI.')}</T>}
  </Card></>;
}

function JournalSection({journals, onChanged}: { journals: HealthJournal[]; onChanged: () => void }) {
  const api = useHealthApi();
  const t = useT();
  const {colors: c} = useTheme();
  const {notify} = useNotice();
  const [kind, setKind] = useState<'MEAL' | 'WORKOUT'>('MEAL');
  const [title, setTitle] = useState('');
  const [calories, setCalories] = useState('');
  const [minutes, setMinutes] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<HealthJournal | null>(null);

  async function save() {
    const kcal = Number(calories.replace(',', '.'));
    const duration = Number(minutes || 0);
    if (!title.trim() || !Number.isFinite(kcal) || kcal < 0 || kcal > 10000 || !Number.isInteger(duration) || duration < 0 || duration > 1440) {
      notify(t('Tên nhật ký, năng lượng hoặc thời lượng không hợp lệ.'));
      return;
    }
    const data: HealthJournalData = {kind, title: title.trim(), calories: kcal, minutes: duration, notes: notes.trim()};
    setSaving(true);
    try {
      await api.createJournal(todayDate(), data);
      setTitle('');
      setCalories('');
      setMinutes('');
      setNotes('');
      onChanged();
    } catch (e) {
      notify(t(healthErrorMessage(e)));
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!deleteId) return;
    try {
      await api.deleteJournal(deleteId.id, deleteId.version);
      setDeleteId(null);
      onChanged();
    } catch (e) {
      notify(t(healthErrorMessage(e)));
    }
  }

  return <><Section title={t('Nhật ký hôm nay')}/><Card><Chips value={kind}
                                                               onChange={value => setKind(value as 'MEAL' | 'WORKOUT')}
                                                               values={[{
                                                                 value: 'MEAL',
                                                                 label: t('Bữa ăn')
                                                               }, {
                                                                 value: 'WORKOUT',
                                                                 label: t('Tập luyện')
                                                               }]}/><Row><Field label={t('Tên')} value={title}
                                                                                onChangeText={setTitle}
                                                                                placeholder={kind === 'MEAL' ? t('Ví dụ: Cơm gà') : t('Ví dụ: Chạy bộ')}
                                                                                style={{flex: 1}}/><Field
    label={t('Kcal')} value={calories} onChangeText={setCalories} keyboardType="decimal-pad" placeholder="500"
    style={{flex: 1}}/></Row><Row><Field label={t('Phút')} value={minutes} onChangeText={setMinutes}
                                         keyboardType="number-pad" placeholder="30" style={{flex: 1}}/><Field
    label={t('Ghi chú')} value={notes} onChangeText={setNotes} placeholder={t('Không bắt buộc')}
    style={{flex: 2}}/></Row><Button label={t('Thêm nhật ký')} icon="add-circle-outline" onPress={save} loading={saving}
                                     disabled={!title || !calories}/>{journals.length ? journals.map(item => <Row
      key={item.id} style={{alignItems: 'flex-start', minHeight: 42}}><Icon
      name={item.data.kind === 'MEAL' ? 'restaurant-outline' : 'barbell-outline'}
      color={item.data.kind === 'MEAL' ? c.lavender : c.success} size={18}/><View style={{flex: 1}}><T size={12}
                                                                                                       bold>{item.data.title}</T><T
      size={10}
      color={c.muted}>{item.data.kind === 'MEAL' ? t('Bữa ăn') : t('Tập luyện')} · {numberLabel(item.data.calories)} kcal
      · {item.data.minutes} {t('phút')}{item.data.notes ? ` · ${item.data.notes}` : ''}</T></View><Pressable
      accessibilityRole="button" accessibilityLabel={t('Xóa')} onPress={() => setDeleteId(item)}
      style={{padding: 5}}><Icon name="trash-outline" color={c.error} size={16}/></Pressable></Row>) :
    <T size={11} color={c.muted}>{t('Chưa có nhật ký hôm nay.')}</T>}</Card><Dialog visible={!!deleteId}
                                                                                    title={t('Xóa nhật ký?')}
                                                                                    message={t('Bản ghi này sẽ bị xóa khỏi thống kê hôm nay.')}
                                                                                    confirmLabel={t('Xóa')}
                                                                                    onClose={() => setDeleteId(null)}
                                                                                    onConfirm={remove}/></>;
}

function PlanSection({plans, aiJobs, profile, weekStart, onChanged, lang}: {
  plans: HealthPlan[];
  aiJobs: HealthAiJob[];
  profile: HealthProfileView | null;
  weekStart: string;
  onChanged: () => void;
  lang: 'vi' | 'en'
}) {
  const api = useHealthApi();
  const t = useT();
  const {colors: c} = useTheme();
  const {notify, dialog} = useNotice();
  const [busy, setBusy] = useState('');
  const plan = plans.find(item => item.status === 'ACTIVE') || plans.find(item => item.status === 'DRAFT') || plans[0];
  const items = plan?.data.items || [];

  async function generate() {
    if (!profile) {
      notify(t('Hãy hoàn tất hồ sơ sức khỏe trước khi tạo kế hoạch.'));
      return;
    }
    setBusy('ai');
    try {
      await api.generateAiPlan(weekStart, todayDate(), lang);
      notify(t('Đã gửi yêu cầu tạo kế hoạch AI.'));
      onChanged();
    } catch (e) {
      notify(t(healthErrorMessage(e)));
    } finally {
      setBusy('');
    }
  }

  async function approve() {
    if (!plan) return;
    setBusy('approve');
    try {
      await api.approvePlan(plan.id, plan.version);
      onChanged();
    } catch (e) {
      notify(t(healthErrorMessage(e)));
    } finally {
      setBusy('');
    }
  }

  async function toggle(index: number, completed: boolean) {
    if (!plan || plan.status !== 'ACTIVE') return;
    setBusy(`item-${index}`);
    try {
      await api.completePlanItem(plan.id, index, plan.version, completed);
      onChanged();
    } catch (e) {
      notify(t(healthErrorMessage(e)));
    } finally {
      setBusy('');
    }
  }

  return <><Section title={t('Kế hoạch tuần')} action={t('Tạo bằng AI')} onPress={generate}/><Card><Row><View
    style={{flex: 1}}><T size={15} bold>{plan?.data.title || t('Chưa có kế hoạch')}</T><T size={10}
                                                                                          color={c.muted}>{dateLabel(weekStart)} — {dateLabel(addDays(weekStart, 6))}</T></View>{plan ?
    <Badge tone={statusTone(plan.status)}>{statusLabel(plan.status, t)}</Badge> : null}</Row>{!plan ? <>
    <Info>{t('AI có thể tạo kế hoạch bữa ăn và tập luyện dựa trên hồ sơ, thiết bị và giới hạn bạn đã khai báo.')}</Info><Button
    label={t('Tạo kế hoạch bằng AI')} icon="sparkles-outline" onPress={generate}
    loading={busy === 'ai'}/></> : <>{plan.data.warnings.length ?
    <Info tone="warning">{plan.data.warnings.join(' · ')}</Info> : null}<View
    style={{gap: 8}}>{items.slice(0, 21).map((item, index) => <PlanItemRow key={`${item.date}-${index}`} item={item}
                                                                           index={index}
                                                                           canToggle={plan.status === 'ACTIVE'}
                                                                           busy={busy === `item-${index}`}
                                                                           onToggle={() => toggle(index, !item.completed)}
                                                                           t={t} colors={c}
                                                                           lang={lang}/>)}</View>{items.length > 21 ?
    <T size={10}
       color={c.muted}>{t('Đang hiển thị 21 mục đầu tiên trong kế hoạch.')}</T> : null}{plan.status === 'DRAFT' ?
    <Button label={t('Tôi đã kiểm tra hạn chế và kích hoạt kế hoạch')} icon="checkmark-circle-outline" onPress={approve}
            loading={busy === 'approve'}/> : null}</>}</Card>{aiJobs.length ?
    <Card><Row><Icon name="sparkles-outline" color={c.lavender}/><T size={13} bold
                                                                    style={{flex: 1}}>{t('Lịch sử tạo kế hoạch AI')}</T></Row>{aiJobs.slice(0, 5).map(job =>
      <Row key={job.id}><Badge tone={statusTone(job.status)}>{statusLabel(job.status, t)}</Badge><T size={10}
                                                                                                    color={c.muted}
                                                                                                    style={{flex: 1}}>{job.errorCode ? t(healthErrorMessageForCode(job.errorCode)) : job.planId ? t('Đã tạo kế hoạch') : t('Đang xử lý')}</T></Row>)}
    </Card> : null}{dialog}</>;
}

function PlanItemRow({item, index, canToggle, busy, onToggle, t, colors, lang}: {
  item: HealthPlanItem;
  index: number;
  canToggle: boolean;
  busy: boolean;
  onToggle: () => void;
  t: (value: string, vars?: Record<string, string | number>) => string;
  colors: ReturnType<typeof useTheme>['colors'];
  lang: 'vi' | 'en'
}) {
  return <Row style={{alignItems: 'flex-start', gap: 8}}><Pressable accessibilityRole="checkbox" accessibilityState={{
    checked: item.completed,
    disabled: !canToggle
  }} disabled={!canToggle || busy} onPress={onToggle} style={{paddingTop: 2, minWidth: 26}}><Icon
    name={item.completed ? 'checkbox' : 'square-outline'} color={item.completed ? colors.success : colors.muted}
    size={19}/></Pressable><View style={{flex: 1}}><Row><Badge
    tone={item.kind === 'MEAL' ? 'primary' : item.kind === 'WORKOUT' ? 'success' : 'muted'}>{item.kind === 'MEAL' ? t('Bữa ăn') : item.kind === 'WORKOUT' ? t('Tập luyện') : t('Nghỉ')}</Badge><T
    size={10} color={colors.muted}>{dayName(item.date, lang)} · {dateLabel(item.date)}</T></Row><T size={12}
                                                                                                   bold={item.completed}
                                                                                                   style={item.completed ? {textDecorationLine: 'line-through'} : undefined}>{item.title}</T><T
    size={10}
    color={colors.muted}>{item.portion}{item.calories ? ` · ${numberLabel(item.calories)} kcal` : ''}{item.minutes ? ` · ${item.minutes} ${t('phút')}` : ''}</T>{item.notes ?
    <T size={10} color={colors.muted}>{item.notes}</T> : null}</View></Row>;
}

export function HealthDashboard() {
  const api = useHealthApi();
  const t = useT();
  const {lang} = useLanguage();
  const {colors: c} = useTheme();
  const {dialog, notify} = useNotice();
  const [today] = useState(todayDate());
  const weekStart = useMemo(() => monday(today), [today]);
  const [profile, setProfile] = useState<HealthProfileView | null>(null);
  const [summary, setSummary] = useState<HealthSummary | null>(null);
  const [statistics, setStatistics] = useState<HealthSummary[]>([]);
  const [weights, setWeights] = useState<HealthWeight[]>([]);
  const [plans, setPlans] = useState<HealthPlan[]>([]);
  const [journals, setJournals] = useState<HealthJournal[]>([]);
  const [aiJobs, setAiJobs] = useState<HealthAiJob[]>([]);
  const [device, setDevice] = useState<Awaited<ReturnType<typeof api.getConnection>>>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleteDate, setDeleteDate] = useState('');
  const [disconnecting, setDisconnecting] = useState(false);
  const load = useCallback(() => {
    setLoading(true);
    const from = addDays(today, -6);
    Promise.all([api.getProfile(), api.getSummary(today), api.getStatistics(from, today), api.listWeights(), api.listPlans(weekStart), api.listJournals(from, today), api.listAiJobs(), api.getConnection()]).then(([p, s, stats, w, ps, js, jobs, connection]) => {
      setProfile(p);
      setSummary(s);
      setStatistics(stats);
      setWeights(w);
      setPlans(ps);
      setJournals(js);
      setAiJobs(jobs);
      setDevice(connection);
      setError('');
    }).catch(e => setError(t(healthErrorMessage(e)))).finally(() => setLoading(false));
  }, [today, weekStart, t]);
  useFocusEffect(useCallback(() => {
    load();
  }, [load]));

  async function removeWeight() {
    if (!deleteDate) return;
    try {
      await api.deleteWeight(deleteDate);
      setDeleteDate('');
      load();
    } catch (e) {
      notify(t(healthErrorMessage(e)));
    }
  }

  async function disconnect() {
    setDisconnecting(true);
    try {
      await api.disconnect(false);
      setDevice(null);
      notify(t('Đã ngắt kết nối thiết bị.'));
    } catch (e) {
      notify(t(healthErrorMessage(e)));
    } finally {
      setDisconnecting(false);
    }
  }

  return <Screen title={t('Sức khỏe')} subtitle={t('Theo dõi chỉ số, nhật ký và kế hoạch cá nhân')}>
    <Row><View style={{flex: 1}}><T size={22} bold>{t('Trung tâm sức khỏe')}</T><T size={11}
                                                                                   color={c.muted}>{t('Dữ liệu của bạn thuộc về bạn; kế hoạch AI chỉ là gợi ý chung cho người trưởng thành.')}</T></View><Button
      label={t('Tải lại')} kind="secondary" icon="refresh-outline" onPress={load}/></Row>
    {error ? <Info tone="error">{error}</Info> : null}{loading ? <ActivityIndicator color={c.primary}/> : summary ?
    <SummaryCard summary={summary}/> : null}
    {!loading && !profile ? <Card tint><Info
      tone="warning">{t('Chưa có hồ sơ sức khỏe. Hãy khai báo thông tin cơ bản để tính chỉ số và dùng kế hoạch AI.')}</Info><Button
      label={t('Thiết lập hồ sơ sức khỏe')} icon="person-outline" onPress={() => go('health-profile')}/></Card> : null}
    <Statistics values={statistics} lang={lang}/>
    <WeightSection weights={weights} onSaved={load} onDelete={setDeleteDate}/>
    <JournalSection journals={journals} onChanged={load}/>
    <PlanSection plans={plans} aiJobs={aiJobs} profile={profile} weekStart={weekStart} onChanged={load} lang={lang}/>
    <Section title={t('Thiết bị & đồng bộ')}/><Card><Row><View style={{
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: c.elevated,
    alignItems: 'center',
    justifyContent: 'center'
  }}><Icon name="watch-outline" color={c.primary}/></View><View style={{flex: 1}}><T size={14}
                                                                                     bold>{device ? t('Đã liên kết thiết bị') : t('Chưa liên kết Apple Health')}</T><T
    size={10}
    color={c.muted}>{device ? `${device.timezone} · ${t('lần đồng bộ')} ${device.lastSyncedAt ? new Date(device.lastSyncedAt).toLocaleString() : t('chưa có')}` : t('Màn hình sẽ hiển thị dữ liệu khi bản native được cấp quyền Apple Health.')}</T></View>{device ?
    <Badge tone="success">{t('Đang kết nối')}</Badge> : <Badge tone="muted">{t('Chưa kết nối')}</Badge>}</Row>{device ?
    <Button label={t('Ngắt kết nối thiết bị')} kind="danger" onPress={disconnect} loading={disconnecting}/> : <Info
      tone="warning">{t('Bản Expo hiện chưa có native bridge HealthKit/Health Connect. Backend đã sẵn sàng; sau khi build native và cấp quyền, dữ liệu sẽ được đồng bộ an toàn theo revision.')}</Info>}
  </Card>
    <Dialog visible={!!deleteDate} title={t('Xóa số đo?')}
            message={t('Số đo này sẽ bị xóa khỏi lịch sử và các phép tính BMI sau đó.')} confirmLabel={t('Xóa')}
            onClose={() => setDeleteDate('')} onConfirm={removeWeight}/>{dialog}
  </Screen>;
}

export function HealthProfileEditor() {
  const api = useHealthApi();
  const t = useT();
  const {colors: c} = useTheme();
  const {notify, dialog} = useNotice();
  const [data, setData] = useState<HealthProfile>(emptyProfile);
  const [version, setVersion] = useState(-1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    api.getProfile().then(value => {
      if (value) {
        setData(value.data);
        setVersion(value.version);
      }
    }).catch(e => setError(t(healthErrorMessage(e)))).finally(() => setLoading(false));
  }, [t]);
  const set = <K extends keyof HealthProfile>(key: K, value: HealthProfile[K]) => setData(previous => ({
    ...previous,
    [key]: value
  }));

  async function save() {
    const numeric = [data.heightCm, data.activityFactor, data.calorieAdjustment, data.preparationMinutes];
    if (!validDate(data.birthDate) || numeric.some(value => !Number.isFinite(Number(value))) || data.heightCm < 80 || data.heightCm > 250 || data.activityFactor < 1.2 || data.activityFactor > 2.4 || data.calorieAdjustment < -1000 || data.calorieAdjustment > 1000 || data.preparationMinutes < 0 || data.preparationMinutes > 240 || !data.timezone.trim()) {
      setError(t('Vui lòng kiểm tra các trường hồ sơ sức khỏe.'));
      return;
    }
    setSaving(true);
    setError('');
    try {
      const saved = await api.saveProfile(data, version);
      setData(saved.data);
      setVersion(saved.version);
      notify(t('Đã lưu hồ sơ sức khỏe.'));
    } catch (e) {
      setError(t(healthErrorMessage(e)));
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Screen title={t('Hồ sơ sức khỏe')} back><ActivityIndicator color={c.primary}/></Screen>;
  return <Screen title={t('Hồ sơ sức khỏe')}
                 subtitle={t('Thông tin được dùng để tính ước tính và tạo kế hoạch an toàn hơn')} back>
    {error ? <Info
      tone="error">{error}</Info> : null}<Info>{t('Đây là công cụ theo dõi sức khỏe tổng quát, không thay thế tư vấn y tế. Hãy nhập dữ liệu bạn thấy phù hợp.')}</Info>
    <Card tint><Section title={t('Thông tin cơ bản')}/><Row><Field label={t('Chiều cao (cm) *')}
                                                                   value={String(data.heightCm)}
                                                                   onChangeText={value => set('heightCm', Number(value.replace(',', '.')))}
                                                                   keyboardType="decimal-pad" style={{flex: 1}}/><Field
      label={t('Ngày sinh *')} value={data.birthDate} onChangeText={value => set('birthDate', value)}
      placeholder="YYYY-MM-DD" style={{flex: 1}}/></Row><T size={11}
                                                           color={c.muted}>{t('Giới tính dùng cho công thức năng lượng')}</T><Chips
      value={data.formulaSex} onChange={value => set('formulaSex', value as HealthProfile['formulaSex'])}
      values={[{value: 'MALE', label: t('Nam')}, {value: 'FEMALE', label: t('Nữ')}]}/><T size={11}
                                                                                         color={c.muted}>{t('Mục tiêu')}</T><Chips
      value={data.goal} onChange={value => set('goal', value as HealthProfile['goal'])}
      values={[{value: 'LOSE', label: t('Giảm cân')}, {value: 'MAINTAIN', label: t('Duy trì')}, {
        value: 'GAIN',
        label: t('Tăng cân')
      }]}/><Row><Field label={t('Múi giờ *')} value={data.timezone} onChangeText={value => set('timezone', value)}
                       style={{flex: 1}}/><Field label={t('Hệ số vận động *')} value={String(data.activityFactor)}
                                                 onChangeText={value => set('activityFactor', Number(value.replace(',', '.')))}
                                                 keyboardType="decimal-pad" style={{flex: 1}}/></Row><Field
      label={t('Điều chỉnh năng lượng (kcal)')} value={String(data.calorieAdjustment)}
      onChangeText={value => set('calorieAdjustment', Number(value.replace(',', '.')))} keyboardType="number-pad"
      hint={t('Giảm cân dùng số âm; tăng cân dùng số dương; duy trì phải bằng 0.')}/></Card>
    <Card><Section title={t('Ăn uống & chuẩn bị')}/><Field label={t('Sở thích ăn uống')} value={data.foodPreferences}
                                                           onChangeText={value => set('foodPreferences', value)}
                                                           multiline
                                                           placeholder={t('Ví dụ: món Việt, nhiều rau')}/><Field
      label={t('Dị ứng')} value={data.allergies} onChangeText={value => set('allergies', value)} multiline
      placeholder={t('Phân tách bằng dấu phẩy')}/><Field label={t('Thực phẩm muốn tránh')} value={data.avoidedFoods}
                                                         onChangeText={value => set('avoidedFoods', value)}
                                                         multiline/><Field label={t('Thời gian chuẩn bị tối đa (phút)')}
                                                                           value={String(data.preparationMinutes)}
                                                                           onChangeText={value => set('preparationMinutes', Number(value.replace(',', '.')))}
                                                                           keyboardType="number-pad"/></Card>
    <Card><Section title={t('Vận động & an toàn')}/><Field label={t('Kinh nghiệm tập luyện')}
                                                           value={data.exerciseExperience}
                                                           onChangeText={value => set('exerciseExperience', value)}
                                                           multiline/><Field label={t('Thiết bị hiện có')}
                                                                             value={data.equipment}
                                                                             onChangeText={value => set('equipment', value)}
                                                                             multiline/><Field
      label={t('Thời gian có thể tập')} value={data.availability} onChangeText={value => set('availability', value)}
      multiline/><Field label={t('Hạn chế vận động')} value={data.movementRestrictions}
                        onChangeText={value => set('movementRestrictions', value)} multiline/><Button
      label={t('Lưu hồ sơ sức khỏe')} icon="checkmark-circle-outline" onPress={save} loading={saving}/></Card>{dialog}
  </Screen>;
}
