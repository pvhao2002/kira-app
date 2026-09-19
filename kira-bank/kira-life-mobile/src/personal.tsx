import React, {useEffect, useMemo, useState} from 'react';
import {Linking, View} from 'react-native';
import {
  FavoriteSong,
  FavoriteSongInput,
  JobApplication,
  JobApplicationInput,
  personalErrorMessage,
  usePersonalApi
} from './personalApi';
import {useT} from './i18n';
import {useTheme} from './theme';
import {Badge, Button, Card, Chips, Dialog, Empty, Field, Icon, Info, Row, Screen, T, useNotice} from './ui';

type SongDraft = { title: string; artist: string; genre: string; karaokeCode: string; tone: string; link: string; note: string };
type JobDraft = {
  companyName: string; positionTitle: string; location: string; jobUrl: string; salary: string;
  employmentType: string; status: JobApplication['status']; priority: JobApplication['priority']; deadline: string;
  contactName: string; contactEmail: string; notes: string;
};

const emptySong: SongDraft = {title: '', artist: '', genre: '', karaokeCode: '', tone: '', link: '', note: ''};
const emptyJob: JobDraft = {
  companyName: '', positionTitle: '', location: '', jobUrl: '', salary: '', employmentType: '', status: 'SAVED',
  priority: 'MEDIUM', deadline: '', contactName: '', contactEmail: '', notes: ''
};
const nullable = (value: string) => value.trim() || null;

function songDraft(song: FavoriteSong): SongDraft {
  return {title: song.title, artist: song.artist || '', genre: song.genre || '', karaokeCode: song.karaokeCode || '', tone: song.tone || '', link: song.link || '', note: song.note || ''};
}

function jobDraft(job: JobApplication): JobDraft {
  return {companyName: job.companyName, positionTitle: job.positionTitle, location: job.location || '', jobUrl: job.jobUrl || '', salary: job.salary || '', employmentType: job.employmentType || '', status: job.status, priority: job.priority, deadline: job.deadline || '', contactName: job.contactName || '', contactEmail: job.contactEmail || '', notes: job.notes || ''};
}

function songInput(draft: SongDraft): FavoriteSongInput {
  return {title: draft.title.trim(), artist: nullable(draft.artist), genre: nullable(draft.genre), karaokeCode: nullable(draft.karaokeCode), tone: nullable(draft.tone), link: nullable(draft.link), note: nullable(draft.note)};
}

function jobInput(draft: JobDraft): JobApplicationInput {
  return {companyName: draft.companyName.trim(), positionTitle: draft.positionTitle.trim(), location: nullable(draft.location), jobUrl: nullable(draft.jobUrl), salary: nullable(draft.salary), employmentType: nullable(draft.employmentType), status: draft.status, priority: draft.priority, deadline: nullable(draft.deadline), contactName: nullable(draft.contactName), contactEmail: nullable(draft.contactEmail), notes: nullable(draft.notes)};
}

function statusLabel(status: JobApplication['status'], t: (value: string) => string) {
  return t({SAVED: 'Đã lưu', APPLIED: 'Đã ứng tuyển', INTERVIEW: 'Phỏng vấn', OFFER: 'Offer', REJECTED: 'Từ chối', WITHDRAWN: 'Đã rút hồ sơ'}[status]);
}

export function FavoriteSongs() {
  const api = usePersonalApi();
  const t = useT();
  const {colors: c} = useTheme();
  const {notify, dialog} = useNotice();
  const [songs, setSongs] = useState<FavoriteSong[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [editor, setEditor] = useState<{id: number; version: number} | null | undefined>(undefined);
  const [draft, setDraft] = useState<SongDraft>(emptySong);
  const [deleting, setDeleting] = useState<FavoriteSong | null>(null);

  function load() {
    setLoading(true);
    api.listAllSongs().then(result => {setSongs(result); setError('');}).catch(e => setError(t(personalErrorMessage(e)))).finally(() => setLoading(false));
  }
  useEffect(() => { load(); }, []);
  const filtered = useMemo(() => {
    const q = search.trim().toLocaleLowerCase();
    return q ? songs.filter(song => [song.title, song.artist, song.genre, song.karaokeCode].some(value => value?.toLocaleLowerCase().includes(q))) : songs;
  }, [songs, search]);
  const update = (key: keyof SongDraft, value: string) => setDraft(current => ({...current, [key]: value} as SongDraft));
  function openCreate() { setError(''); setDraft({...emptySong}); setEditor(null); }
  function openEdit(song: FavoriteSong) { setError(''); setDraft(songDraft(song)); setEditor({id: song.id, version: song.version}); }
  async function save() {
    if (!draft.title.trim()) {setError(t('Tên bài hát là bắt buộc.')); return;}
    setSaving(true); setError('');
    try {
      const saved = editor === null ? await api.createSong(songInput(draft)) : await api.updateSong(editor.id, {...songInput(draft), version: editor.version});
      setSongs(current => editor === null ? [saved, ...current] : current.map(item => item.id === saved.id ? saved : item));
      setEditor(undefined); notify(t('Đã lưu bài hát yêu thích.'));
    } catch (e) {setError(t(personalErrorMessage(e)));} finally {setSaving(false);}
  }
  async function remove() {
    if (!deleting) return;
    try {await api.deleteSong(deleting.id, deleting.version); setSongs(current => current.filter(item => item.id !== deleting.id)); setDeleting(null);}
    catch (e) {setDeleting(null); setError(t(personalErrorMessage(e)));}
  }
  if (editor !== undefined) return <Screen title={t(editor === null ? 'Thêm bài hát yêu thích' : 'Sửa bài hát yêu thích')} subtitle={t('Lưu thông tin để chọn bài nhanh hơn khi đi karaoke.')} back>
    {error ? <Info tone="error">{error}</Info> : null}<Card tint>
      <Field label={t('Tên bài hát *')} value={draft.title} onChangeText={value => update('title', value)} placeholder={t('Ví dụ: Nàng thơ')}/>
      <Field label={t('Ca sĩ')} value={draft.artist} onChangeText={value => update('artist', value)} placeholder={t('Ca sĩ hoặc phiên bản muốn hát')}/>
      <Row><View style={{flex: 1}}><Field label={t('Thể loại')} value={draft.genre} onChangeText={value => update('genre', value)}/></View><View style={{flex: 1}}><Field label={t('Mã karaoke')} value={draft.karaokeCode} onChangeText={value => update('karaokeCode', value)}/></View></Row>
      <Row><View style={{flex: 1}}><Field label={t('Tone / tông')} value={draft.tone} onChangeText={value => update('tone', value)} placeholder={t('Ví dụ: Nam -2')}/></View><View style={{flex: 1}}><Field label={t('Link bài hát')} value={draft.link} onChangeText={value => update('link', value)} autoCapitalize="none" keyboardType="url"/></View></Row>
      <Field label={t('Ghi chú')} value={draft.note} onChangeText={value => update('note', value)} multiline placeholder={t('Cách vào bài, đoạn cần nhớ…')}/>
      <Button label={t('Lưu bài hát')} onPress={() => void save()} loading={saving}/><Button label={t('Hủy')} kind="secondary" onPress={() => setEditor(undefined)} disabled={saving}/>
    </Card>
  </Screen>;
  return <Screen title={t('Bài hát karaoke yêu thích')} subtitle={t('Lưu mã bài, tone và link để tra nhanh khi đi hát.')}>
    <Button label={t('Thêm bài hát')} icon="add" onPress={openCreate}/><Field label={t('Tìm bài hát')} value={search} onChangeText={setSearch} placeholder={t('Tên bài, ca sĩ hoặc mã karaoke')}/>{error ? <Info tone="error">{error}</Info> : null}
    {loading ? <Card><T color={c.muted}>{t('Đang tải danh sách bài hát…')}</T></Card> : filtered.length ? filtered.map(song => <Card key={song.id}>
      <Row><Icon name="musical-notes-outline" size={22}/><View style={{flex: 1}}><T size={17} bold>{song.title}</T><T size={12} color={c.muted}>{song.artist || t('Chưa có ca sĩ')}</T></View>{song.tone ? <Badge>{song.tone}</Badge> : null}</Row>
      <View style={{gap: 4}}>{song.genre ? <T size={11} color={c.muted}>{t('Thể loại')}: {song.genre}</T> : null}{song.karaokeCode ? <T size={11} color={c.muted}>{t('Mã karaoke')}: {song.karaokeCode}</T> : null}{song.note ? <T size={12}>{song.note}</T> : null}</View>
      <Row><Button label={t('Sửa')} kind="secondary" icon="create-outline" onPress={() => openEdit(song)}/>{song.link ? <Button label={t('Mở link')} kind="secondary" icon="link-outline" onPress={() => Linking.openURL(song.link!).catch(() => notify(t('Không thể mở link bài hát.')))}/> : null}<Button label={t('Xóa')} kind="danger" icon="trash-outline" onPress={() => setDeleting(song)}/></Row>
    </Card>) : <Empty title={t('Chưa có bài hát yêu thích')} description={t('Thêm bài đầu tiên để không phải tìm lại mã karaoke và tone.')}/>}<Dialog visible={!!deleting} title={t('Xóa bài hát?')} message={t('Bài hát sẽ được xóa khỏi danh sách cá nhân.')} onClose={() => setDeleting(null)} onConfirm={() => void remove()} confirmLabel={t('Xóa')}/>{dialog}
  </Screen>;
}

export function JobTracker() {
  const api = usePersonalApi();
  const t = useT();
  const {colors: c} = useTheme();
  const {notify, dialog} = useNotice();
  const [jobs, setJobs] = useState<JobApplication[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [editor, setEditor] = useState<{id: number; version: number} | null | undefined>(undefined);
  const [draft, setDraft] = useState<JobDraft>(emptyJob);
  const [deleting, setDeleting] = useState<JobApplication | null>(null);
  function load() {setLoading(true); api.listAllJobs().then(result => {setJobs(result); setError('');}).catch(e => setError(t(personalErrorMessage(e)))).finally(() => setLoading(false));}
  useEffect(() => { load(); }, []);
  const filtered = useMemo(() => {const q = search.trim().toLocaleLowerCase(); return q ? jobs.filter(job => [job.companyName, job.positionTitle, job.location].some(value => value?.toLocaleLowerCase().includes(q))) : jobs;}, [jobs, search]);
  const update = (key: keyof JobDraft, value: string) => setDraft(current => ({...current, [key]: value} as JobDraft));
  function openCreate() {setError(''); setDraft({...emptyJob}); setEditor(null);}
  function openEdit(job: JobApplication) {setError(''); setDraft(jobDraft(job)); setEditor({id: job.id, version: job.version});}
  async function save() {
    if (!draft.companyName.trim() || !draft.positionTitle.trim()) {setError(t('Công ty và vị trí là bắt buộc.')); return;}
    setSaving(true); setError('');
    try {
      const saved = editor === null ? await api.createJob(jobInput(draft)) : await api.updateJob(editor.id, {...jobInput(draft), version: editor.version});
      setJobs(current => editor === null ? [saved, ...current] : current.map(item => item.id === saved.id ? saved : item));
      setEditor(undefined); notify(t('Đã lưu job.'));
    } catch (e) {setError(t(personalErrorMessage(e)));} finally {setSaving(false);}
  }
  async function remove() {if (!deleting) return; try {await api.deleteJob(deleting.id, deleting.version); setJobs(current => current.filter(item => item.id !== deleting.id)); setDeleting(null);} catch (e) {setDeleting(null); setError(t(personalErrorMessage(e)));}}
  if (editor !== undefined) return <Screen title={t(editor === null ? 'Thêm job' : 'Sửa job')} subtitle={t('Theo dõi cơ hội và chuẩn bị từng bước trước khi nhảy việc.')} back>
    {error ? <Info tone="error">{error}</Info> : null}<Card tint><Field label={t('Công ty *')} value={draft.companyName} onChangeText={value => update('companyName', value)}/><Field label={t('Vị trí *')} value={draft.positionTitle} onChangeText={value => update('positionTitle', value)}/>
      <Row><View style={{flex: 1}}><Field label={t('Địa điểm')} value={draft.location} onChangeText={value => update('location', value)}/></View><View style={{flex: 1}}><Field label={t('Mức lương')} value={draft.salary} onChangeText={value => update('salary', value)}/></View></Row>
      <Field label={t('Link công việc')} value={draft.jobUrl} onChangeText={value => update('jobUrl', value)} autoCapitalize="none" keyboardType="url"/><Field label={t('Loại hình làm việc')} value={draft.employmentType} onChangeText={value => update('employmentType', value)} placeholder={t('Full-time, contract…')}/>
      <T size={12} color={c.muted}>{t('Trạng thái')}</T><Chips value={draft.status} onChange={value => update('status', value)} values={[['SAVED', 'Đã lưu'], ['APPLIED', 'Đã ứng tuyển'], ['INTERVIEW', 'Phỏng vấn'], ['OFFER', 'Offer'], ['REJECTED', 'Từ chối'], ['WITHDRAWN', 'Đã rút hồ sơ']].map(([value, label]) => ({value, label: t(label)}))}/>
      <T size={12} color={c.muted}>{t('Độ ưu tiên')}</T><Chips value={draft.priority} onChange={value => update('priority', value)} values={[['LOW', 'Thấp'], ['MEDIUM', 'Trung bình'], ['HIGH', 'Cao']].map(([value, label]) => ({value, label: t(label)}))}/>
      <Field label={t('Hạn ứng tuyển')} value={draft.deadline} onChangeText={value => update('deadline', value)} placeholder="YYYY-MM-DD"/><Row><View style={{flex: 1}}><Field label={t('Người liên hệ')} value={draft.contactName} onChangeText={value => update('contactName', value)}/></View><View style={{flex: 1}}><Field label={t('Email liên hệ')} value={draft.contactEmail} onChangeText={value => update('contactEmail', value)} autoCapitalize="none" keyboardType="email-address"/></View></Row>
      <Field label={t('Ghi chú')} value={draft.notes} onChangeText={value => update('notes', value)} multiline placeholder={t('Điểm phù hợp, việc cần chuẩn bị, người giới thiệu…')}/><Button label={t('Lưu job')} onPress={() => void save()} loading={saving}/><Button label={t('Hủy')} kind="secondary" onPress={() => setEditor(undefined)} disabled={saving}/>
    </Card>
  </Screen>;
  return <Screen title={t('Theo dõi việc làm')} subtitle={t('Lưu các cơ hội đang cân nhắc và theo dõi tiến độ ứng tuyển.')}>
    <Button label={t('Thêm job')} icon="add" onPress={openCreate}/><Field label={t('Tìm job')} value={search} onChangeText={setSearch} placeholder={t('Công ty, vị trí hoặc địa điểm')}/>{error ? <Info tone="error">{error}</Info> : null}
    {loading ? <Card><T color={c.muted}>{t('Đang tải danh sách job…')}</T></Card> : filtered.length ? filtered.map(job => <Card key={job.id}><Row><Icon name="briefcase-outline" size={22}/><View style={{flex: 1}}><T size={17} bold>{job.positionTitle}</T><T size={12} color={c.muted}>{job.companyName}{job.location ? ` · ${job.location}` : ''}</T></View><Badge tone={job.priority === 'HIGH' ? 'warning' : job.status === 'OFFER' ? 'success' : 'primary'}>{statusLabel(job.status, t)}</Badge></Row>
      <View style={{gap: 4}}><T size={11} color={c.muted}>{t('Ưu tiên')}: {job.priority === 'HIGH' ? t('Cao') : job.priority === 'LOW' ? t('Thấp') : t('Trung bình')}</T>{job.deadline ? <T size={11} color={c.muted}>{t('Deadline')}: {job.deadline}</T> : null}{job.salary ? <T size={12}>{job.salary}</T> : null}{job.notes ? <T size={12}>{job.notes}</T> : null}</View>
      <Row><Button label={t('Sửa')} kind="secondary" icon="create-outline" onPress={() => openEdit(job)}/>{job.jobUrl ? <Button label={t('Mở link')} kind="secondary" icon="link-outline" onPress={() => Linking.openURL(job.jobUrl!).catch(() => notify(t('Không thể mở link công việc.')))}/> : null}<Button label={t('Xóa')} kind="danger" icon="trash-outline" onPress={() => setDeleting(job)}/></Row>
    </Card>) : <Empty title={t('Chưa có job nào')} description={t('Thêm cơ hội đầu tiên để chuẩn bị hồ sơ và theo dõi tiến độ.')} />}<Dialog visible={!!deleting} title={t('Xóa job?')} message={t('Job sẽ được xóa khỏi danh sách theo dõi cá nhân.')} onClose={() => setDeleting(null)} onConfirm={() => void remove()} confirmLabel={t('Xóa')}/>{dialog}
  </Screen>;
}
