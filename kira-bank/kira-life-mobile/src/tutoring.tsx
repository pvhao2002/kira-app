import React, {useCallback, useState} from 'react';
import {ActivityIndicator, Pressable, View} from 'react-native';
import {useFocusEffect} from 'expo-router';
import {validDate} from './data';
import {useLanguage, useT} from './i18n';
import {useTheme} from './theme';
import {
  isTutoringConflict,
  tutoringErrorMessage,
  TutoringLesson,
  TutoringStudent,
  TutoringTeachingMode,
  useTutoringApi
} from './tutoringApi';
import {
  Badge,
  Button,
  Card,
  Chips,
  Dialog,
  Empty,
  Field,
  Icon,
  Info,
  Metric,
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
  return addDays(value, -((date.getDay() + 6) % 7));
}

function dateLabel(value: string) {
  return value.split('-').reverse().join('/');
}

function timeLabel(value: string) {
  return value.slice(0, 5);
}

function weekday(value: string, lang: 'vi' | 'en') {
  return new Date(`${value}T12:00:00`).toLocaleDateString(lang === 'en' ? 'en-US' : 'vi-VN', {weekday: 'short'});
}

function dayOfWeek(value: string) {
  const day = new Date(`${value}T00:00:00Z`).getUTCDay();
  return day === 0 ? 7 : day;
}

function minutes(value: string) {
  const [hours, mins] = value.split(':').map(Number);
  return hours * 60 + mins;
}

function money(value: number, lang: 'vi' | 'en') {
  return new Intl.NumberFormat(lang === 'en' ? 'en-US' : 'vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0
  }).format(value);
}

const emptyStudent = {name: '', phone: '', color: '#2563EB', note: ''};
const emptyLesson = {
  studentId: '',
  subject: '',
  date: todayDate(),
  startTime: '18:00',
  endTime: '19:30',
  mode: 'IN_PERSON' as TutoringTeachingMode,
  location: '',
  fee: '0',
  note: ''
};

function lessonStatus(lesson: TutoringLesson, t: (value: string) => string) {
  return lesson.cancelled ? t('Nghỉ buổi này') : lesson.exceptionAction === 'MOVE' ? t('Đã đổi riêng') : lesson.teachingMode === 'ONLINE' ? t('Online') : t('Trực tiếp');
}

export function TutoringSchedule() {
  const api = useTutoringApi();
  const t = useT();
  const {lang} = useLanguage();
  const {colors: c} = useTheme();
  const {notify, dialog} = useNotice();
  const [weekStart, setWeekStart] = useState(monday(todayDate()));
  const [week, setWeek] = useState<Awaited<ReturnType<typeof api.getWeek>> | null>(null);
  const [students, setStudents] = useState<TutoringStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [lessonEditor, setLessonEditor] = useState(false);
  const [studentEditor, setStudentEditor] = useState(false);
  const [editingLesson, setEditingLesson] = useState<TutoringLesson | null>(null);
  const [editingStudent, setEditingStudent] = useState<TutoringStudent | null>(null);
  const [lessonForm, setLessonForm] = useState(emptyLesson);
  const [studentForm, setStudentForm] = useState(emptyStudent);
  const [scope, setScope] = useState<'FUTURE' | 'ONCE'>('FUTURE');
  const [forceConflict, setForceConflict] = useState(false);
  const [deleteLesson, setDeleteLesson] = useState<TutoringLesson | null>(null);
  const [cancelLesson, setCancelLesson] = useState<TutoringLesson | null>(null);
  const [deleteStudent, setDeleteStudent] = useState<TutoringStudent | null>(null);
  const load = useCallback(() => {
    setLoading(true);
    Promise.all([api.getWeek(weekStart), api.listStudents()]).then(([schedule, directory]) => {
      setWeek(schedule);
      setStudents(directory);
      setError('');
    }).catch(e => setError(t(tutoringErrorMessage(e)))).finally(() => setLoading(false));
  }, [t, weekStart]);
  useFocusEffect(useCallback(() => {
    load();
  }, [load]));
  const days = Array.from({length: 7}, (_, index) => addDays(weekStart, index));

  function previousWeek() {
    setWeekStart(value => addDays(value, -7));
  }

  function nextWeek() {
    setWeekStart(value => addDays(value, 7));
  }

  function openNewLesson(date = days.find(value => value === todayDate()) || weekStart) {
    if (week?.readOnly) return;
    if (!students.length) {
      openStudent();
      return;
    }
    setEditingLesson(null);
    setScope('FUTURE');
    setForceConflict(false);
    setLessonForm({...emptyLesson, date, studentId: String(students[0].id)});
    setLessonEditor(true);
  }

  function openExistingLesson(lesson: TutoringLesson) {
    if (lesson.cancelled) return;
    setEditingLesson(lesson);
    setScope('FUTURE');
    setForceConflict(false);
    setLessonForm({
      studentId: String(lesson.studentId),
      subject: lesson.subject,
      date: lesson.date,
      startTime: timeLabel(lesson.startTime),
      endTime: timeLabel(lesson.endTime),
      mode: lesson.teachingMode,
      location: lesson.location || '',
      fee: String(lesson.fee),
      note: lesson.note || ''
    });
    setLessonEditor(true);
  }

  function setLesson<K extends keyof typeof emptyLesson>(key: K, value: typeof emptyLesson[K]) {
    setLessonForm(previous => ({...previous, [key]: value}));
  }

  async function saveLesson() {
    if (week?.readOnly) return;
    const studentId = Number(lessonForm.studentId);
    const fee = Number(lessonForm.fee.replace(',', '.'));
    if (!studentId || !lessonForm.subject.trim() || !validDate(lessonForm.date) || !/^\d{2}:\d{2}$/.test(lessonForm.startTime) || !/^\d{2}:\d{2}$/.test(lessonForm.endTime) || minutes(lessonForm.endTime) <= minutes(lessonForm.startTime) || !Number.isFinite(fee) || fee < 0 || fee > 100000000) {
      setError(t('Vui lòng kiểm tra thông tin buổi học.'));
      return;
    }
    setSaving(true);
    setError('');
    try {
      if (editingLesson && scope === 'ONCE') await api.saveException(editingLesson.seriesId, editingLesson.originalDate, 'MOVE', lessonForm.date, lessonForm.startTime, lessonForm.endTime, editingLesson.exceptionVersion, forceConflict);
      else {
        const input = {
          studentId,
          dayOfWeek: dayOfWeek(lessonForm.date),
          startTime: lessonForm.startTime,
          endTime: lessonForm.endTime,
          subject: lessonForm.subject.trim(),
          teachingMode: lessonForm.mode,
          location: lessonForm.location.trim() || null,
          fee,
          note: lessonForm.note.trim() || null,
          effectiveFrom: weekStart,
          confirmConflict: forceConflict
        };
        if (editingLesson) await api.updateSeries(editingLesson.seriesId, input, editingLesson.seriesVersion, forceConflict); else await api.createSeries(input);
      }
      setLessonEditor(false);
      setForceConflict(false);
      notify(t('Đã lưu lịch dạy.'));
      load();
    } catch (e) {
      setError(t(tutoringErrorMessage(e)));
      if (isTutoringConflict(e)) setForceConflict(true);
    } finally {
      setSaving(false);
    }
  }

  async function removeLesson() {
    if (!deleteLesson || week?.readOnly) return;
    setSaving(true);
    try {
      await api.deleteSeries(deleteLesson.seriesId, weekStart, deleteLesson.seriesVersion);
      setDeleteLesson(null);
      setLessonEditor(false);
      notify(t('Đã kết thúc lịch lặp.'));
      load();
    } catch (e) {
      setError(t(tutoringErrorMessage(e)));
    } finally {
      setSaving(false);
    }
  }

  async function cancelOnce() {
    if (!cancelLesson || week?.readOnly) return;
    setSaving(true);
    try {
      await api.saveException(cancelLesson.seriesId, cancelLesson.originalDate, 'CANCEL', null, null, null, cancelLesson.exceptionVersion, false);
      setCancelLesson(null);
      setLessonEditor(false);
      notify(t('Đã nghỉ buổi học này.'));
      load();
    } catch (e) {
      setError(t(tutoringErrorMessage(e)));
    } finally {
      setSaving(false);
    }
  }

  async function restore(lesson: TutoringLesson) {
    if (week?.readOnly || lesson.exceptionVersion == null) return;
    setSaving(true);
    try {
      await api.restoreException(lesson.seriesId, lesson.originalDate, lesson.exceptionVersion, false);
      notify(t('Đã khôi phục buổi học.'));
      load();
    } catch (e) {
      setError(t(tutoringErrorMessage(e)));
    } finally {
      setSaving(false);
    }
  }

  function openStudent(student: TutoringStudent | null = null) {
    if (week?.readOnly) return;
    setEditingStudent(student);
    setStudentForm(student ? {
      name: student.name,
      phone: student.phone || '',
      color: student.color,
      note: student.note || ''
    } : {...emptyStudent, color: ['#2563EB', '#7C3AED', '#DB2777', '#059669'][students.length % 4]});
    setStudentEditor(true);
  }

  async function saveStudent() {
    if (!studentForm.name.trim() || !/^#[0-9A-Fa-f]{6}$/.test(studentForm.color)) {
      setError(t('Vui lòng kiểm tra thông tin học viên.'));
      return;
    }
    setSaving(true);
    setError('');
    try {
      const input = {
        name: studentForm.name.trim(),
        phone: studentForm.phone.trim() || null,
        color: studentForm.color,
        note: studentForm.note.trim() || null
      };
      const saved = editingStudent ? await api.updateStudent(editingStudent.id, input, editingStudent.version) : await api.createStudent(input);
      setStudents(previous => [...previous.filter(value => value.id !== saved.id), saved].sort((a, b) => a.name.localeCompare(b.name)));
      setStudentEditor(false);
      notify(t('Đã lưu học viên.'));
    } catch (e) {
      setError(t(tutoringErrorMessage(e)));
    } finally {
      setSaving(false);
    }
  }

  async function removeStudent() {
    if (!deleteStudent) return;
    setSaving(true);
    try {
      await api.deleteStudent(deleteStudent.id, deleteStudent.version);
      setStudents(previous => previous.filter(value => value.id !== deleteStudent.id));
      setDeleteStudent(null);
      notify(t('Đã lưu trữ học viên.'));
    } catch (e) {
      setError(t(tutoringErrorMessage(e)));
    } finally {
      setSaving(false);
    }
  }

  const grouped = (date: string) => (week?.lessons || []).filter(lesson => lesson.date === date).sort((a, b) => a.startTime.localeCompare(b.startTime));
  return <Screen title={t('Lịch dạy')} subtitle={t('Lập lịch lặp, đổi riêng từng buổi và theo dõi học phí')}>
    <Row><View style={{flex: 1}}><T size={22} bold>{t('Lịch dạy gia sư')}</T><T size={11}
                                                                                color={c.muted}>{dateLabel(weekStart)} — {dateLabel(addDays(weekStart, 6))} · {week?.timeZone || 'Asia/Ho_Chi_Minh'}</T></View><Button
      label={t('Học viên')} kind="secondary" icon="people-outline" onPress={() => openStudent()}/><Button
      label={t('Thêm')} icon="add" onPress={() => openNewLesson()} disabled={!!week?.readOnly}/></Row>
    <Row><Button label={t('Tuần trước')} kind="secondary" icon="chevron-back" onPress={previousWeek}
                 disabled={loading}/><View style={{flex: 1, alignItems: 'center'}}><Badge
      tone={week?.readOnly ? 'muted' : 'primary'}>{week?.readOnly ? t('Chỉ đọc') : t('Tuần đang chỉnh sửa')}</Badge></View><Button
      label={t('Tuần sau')} kind="secondary" icon="chevron-forward" onPress={nextWeek} disabled={loading}/></Row>
    {error ? <Info tone="error">{error}</Info> : null}{loading ? <ActivityIndicator color={c.primary}/> : week ? <><Row><Metric
      label={t('SỐ BUỔI')} value={String(week.lessonCount)}/><Metric label={t('GIỜ DẠY')} value={`${week.totalHours} h`}/><Metric
      label={t('HỌC PHÍ DỰ KIẾN')} value={money(week.totalFee, lang)}/></Row>{week.readOnly ?
      <Info>{t('Các tuần trước được giữ nguyên dưới dạng lịch sử chỉ đọc.')}</Info> : null}{week.conflicts.length ?
      <Card><Row><Icon name="warning-outline" color={c.warning}/><T size={13} bold
                                                                    style={{flex: 1}}>{t('Lịch bị trùng')}</T><Badge
        tone="warning">{week.conflicts.length}</Badge></Row>{week.conflicts.map((conflict, index) => <T
        key={`${conflict.date}-${index}`} size={11}
        color={c.warning}>{dateLabel(conflict.date)} · {timeLabel(conflict.startTime)}–{timeLabel(conflict.endTime)} · {conflict.description}</T>)}
      </Card> : null}<Section title={t('Lịch theo tuần')}/>{days.map(date => <Card key={date}><Row><View
      style={{flex: 1}}><T size={14} bold
                           color={date === todayDate() ? c.primary : c.text}>{weekday(date, lang)} · {dateLabel(date)}</T></View>{!week.readOnly ?
      <Pressable accessibilityRole="button" accessibilityLabel={t('Thêm buổi')} onPress={() => openNewLesson(date)}
                 style={{padding: 6}}><Icon name="add-circle-outline" color={c.primary} size={18}/></Pressable> : null}
    </Row>{grouped(date).length ? grouped(date).map(lesson => <Pressable key={`${lesson.seriesId}-${lesson.originalDate}`}
                                                                         accessibilityRole="button"
                                                                         onPress={() => lesson.cancelled ? restore(lesson) : openExistingLesson(lesson)}><Row
        style={{alignItems: 'flex-start', gap: 8, paddingVertical: 8, borderTopWidth: 1, borderColor: c.border}}><View
        style={{
          width: 5,
          minHeight: 48,
          alignSelf: 'stretch',
          borderRadius: 4,
          backgroundColor: lesson.studentColor
        }}/><View style={{flex: 1}}><Row><T size={12} bold
                                            style={{flex: 1}}>{timeLabel(lesson.startTime)}–{timeLabel(lesson.endTime)} · {lesson.studentName}</T><Badge
        tone={lesson.cancelled ? 'muted' : lesson.conflict ? 'warning' : 'primary'}>{lessonStatus(lesson, t)}</Badge></Row><T
        size={12}>{lesson.subject}</T><T size={10}
                                         color={c.muted}>{lesson.location || (lesson.teachingMode === 'ONLINE' ? t('Học online') : t('Chưa có địa điểm'))} · {money(lesson.fee, lang)}{lesson.note ? ` · ${lesson.note}` : ''}</T></View></Row></Pressable>) :
      <T size={11} color={c.muted}>{t('Chưa có buổi học.')}</T>}</Card>)}</> :
    <Empty title={t('Chưa có lịch dạy')} description={t('Thêm học viên và buổi học đầu tiên để bắt đầu.')}
           action={t('Thêm học viên')} onPress={() => openStudent()}/>}
    {lessonEditor ? <Card tint><Section title={t(editingLesson ? 'Sửa buổi học' : 'Thêm buổi học')}/><Row><Field
      label={t('Học viên *')} value={lessonForm.studentId} onChangeText={value => setLesson('studentId', value)}
      keyboardType="number-pad" placeholder={students[0] ? String(students[0].id) : ''} style={{flex: 1}}/><Field
      label={t('Ngày học *')} value={lessonForm.date} onChangeText={value => setLesson('date', value)}
      placeholder="YYYY-MM-DD" style={{flex: 1}}/></Row><Field label={t('Môn học *')} value={lessonForm.subject}
                                                               onChangeText={value => setLesson('subject', value)}/><Row><Field
      label={t('Bắt đầu *')} value={lessonForm.startTime} onChangeText={value => setLesson('startTime', value)}
      placeholder="18:00" style={{flex: 1}}/><Field label={t('Kết thúc *')} value={lessonForm.endTime}
                                                    onChangeText={value => setLesson('endTime', value)}
                                                    placeholder="19:30" style={{flex: 1}}/><Field
      label={t('Học phí (VND)')} value={lessonForm.fee} onChangeText={value => setLesson('fee', value)}
      keyboardType="number-pad" style={{flex: 1}}/></Row><T size={11} color={c.muted}>{t('Hình thức')}</T><Chips
      value={lessonForm.mode} onChange={value => setLesson('mode', value as TutoringTeachingMode)}
      values={[{value: 'IN_PERSON', label: t('Trực tiếp')}, {value: 'ONLINE', label: t('Online')}]}/><Field
      label={t('Địa điểm hoặc link học')} value={lessonForm.location}
      onChangeText={value => setLesson('location', value)}/><Field label={t('Ghi chú')} value={lessonForm.note}
                                                                   onChangeText={value => setLesson('note', value)}
                                                                   multiline/>{editingLesson ? <><T size={11}
                                                                                                    color={c.muted}>{t('Phạm vi thay đổi')}</T><Chips
      value={scope} onChange={value => setScope(value as 'FUTURE' | 'ONCE')}
      values={[{value: 'FUTURE', label: t('Từ tuần này về sau')}, {
        value: 'ONCE',
        label: t('Chỉ buổi này')
      }]}/>{scope === 'ONCE' ?
      <Info>{t('Đổi một lần chỉ thay ngày giờ của buổi này. Các thông tin khác được giữ nguyên.')}</Info> : null}</> : null}{forceConflict ?
      <Info tone="warning">{t('Lịch mới bị trùng giờ. Bạn có thể xác nhận để lưu tiếp.')}</Info> : null}<Row><Button
      label={forceConflict ? t('Lưu dù trùng lịch') : t('Lưu')} onPress={saveLesson} loading={saving}/><Button
      label={t('Hủy')} kind="secondary"
      onPress={() => setLessonEditor(false)}/></Row>{editingLesson && !week?.readOnly ?
      <Row><Button label={t('Nghỉ buổi này')} kind="secondary" onPress={() => setCancelLesson(editingLesson)}/><Button
        label={t('Kết thúc lịch lặp')} kind="danger" onPress={() => setDeleteLesson(editingLesson)}/></Row> : null}
    </Card> : null}
    {studentEditor ? <Card tint><Section title={t(editingStudent ? 'Sửa học viên' : 'Thêm học viên')}/><Field
      label={t('Tên học viên *')} value={studentForm.name}
      onChangeText={value => setStudentForm(previous => ({...previous, name: value}))}/><Field label={t('Điện thoại')}
                                                                                               value={studentForm.phone}
                                                                                               onChangeText={value => setStudentForm(previous => ({
                                                                                                 ...previous,
                                                                                                 phone: value
                                                                                               }))}
                                                                                               keyboardType="phone-pad"/><Field
      label={t('Màu trên lịch')} value={studentForm.color}
      onChangeText={value => setStudentForm(previous => ({...previous, color: value}))} placeholder="#2563EB"
      autoCapitalize="characters"/><Field label={t('Ghi chú')} value={studentForm.note}
                                          onChangeText={value => setStudentForm(previous => ({
                                            ...previous,
                                            note: value
                                          }))} multiline/><Row><Button label={t('Lưu')} onPress={saveStudent}
                                                                       loading={saving}/><Button label={t('Hủy')}
                                                                                                 kind="secondary"
                                                                                                 onPress={() => setStudentEditor(false)}/></Row>{editingStudent ?
      <Button label={t('Lưu trữ học viên')} kind="danger" onPress={() => setDeleteStudent(editingStudent)}
              disabled={saving}/> : null}<Section
      title={t('Danh bạ học viên')}/>{students.length ? students.map(student => <Row key={student.id}
                                                                                     style={{minHeight: 42}}><View
        style={{width: 12, height: 12, borderRadius: 6, backgroundColor: student.color}}/><T
        style={{flex: 1}}>{student.name}{student.phone ? ` · ${student.phone}` : ''}</T><Pressable
        accessibilityRole="button" accessibilityLabel={t('Sửa')} onPress={() => openStudent(student)}
        style={{padding: 6}}><Icon name="create-outline" size={16}/></Pressable></Row>) :
      <T size={11} color={c.muted}>{t('Chưa có học viên.')}</T>}</Card> : null}
    <Dialog visible={!!deleteLesson} title={t('Kết thúc lịch lặp?')}
            message={t('Lịch này sẽ dừng từ tuần đang xem về sau; lịch sử trước đó vẫn giữ nguyên.')}
            confirmLabel={t('Kết thúc')} onClose={() => setDeleteLesson(null)} onConfirm={removeLesson}/><Dialog
    visible={!!cancelLesson} title={t('Nghỉ buổi này?')}
    message={t('Chỉ buổi học được chọn bị hủy; các tuần sau vẫn giữ nguyên.')} confirmLabel={t('Nghỉ buổi')}
    onClose={() => setCancelLesson(null)} onConfirm={cancelOnce}/><Dialog visible={!!deleteStudent}
                                                                          title={t('Lưu trữ học viên?')}
                                                                          message={t('Chỉ có thể lưu trữ học viên không còn lịch dạy hiện tại hoặc tương lai.')}
                                                                          confirmLabel={t('Lưu trữ')}
                                                                          onClose={() => setDeleteStudent(null)}
                                                                          onConfirm={removeStudent}/>{dialog}
  </Screen>;
}
