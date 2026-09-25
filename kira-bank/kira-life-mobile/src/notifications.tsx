import React, {useCallback, useState} from 'react';
import {ActivityIndicator, Pressable, View} from 'react-native';
import {useFocusEffect} from 'expo-router';
import {dateLabel} from './data';
import {notificationErrorMessage, NotificationResponse, useNotificationApi} from './notificationApi';
import {useT} from './i18n';
import {useTheme} from './theme';
import {Badge, Button, Card, Chips, Empty, go, Icon, Info, Row, Screen, T} from './ui';

const severityTone = (severity: string): 'primary' | 'success' | 'warning' | 'error' | 'muted' => severity === 'ERROR' || severity === 'CRITICAL' ? 'error' : severity === 'WARNING' ? 'warning' : severity === 'SUCCESS' ? 'success' : 'primary';
const allowedPages = new Set(['statement-import', 'cards', 'credit-stats', 'statements', 'payments', 'billing-cycle', 'statement-pay', 'queue', 'source', 'ai-result', 'draft-edit', 'history', 'account-stats', 'investment-reports', 'investment-report-detail', 'investment-report-create']);

function notificationTarget(deepLink: string | null): { page: string; params: Record<string, string> } | null {
  if (!deepLink) return null;
  const [path, queryString] = deepLink.replace(/^\//, '').split('?');
  const page = path.split('#')[0];
  if (!allowedPages.has(page)) return null;
  const params: Record<string, string> = {};
  if (queryString) {
    new URLSearchParams(queryString.split('#')[0]).forEach((value, key) => {
      if (/^(id|accountId|batchId)$/.test(key) && value) params[key] = value;
    });
  }
  return {page, params};
}

function NotificationCard({item, onOpen}: { item: NotificationResponse; onOpen: () => void }) {
  const t = useT();
  const {colors: c} = useTheme();
  const tone = severityTone(item.severity);
  const target = notificationTarget(item.deepLink);
  const title = item.type === 'INVESTMENT_AI_READY' ? t('AI đã nhận diện xong chứng từ') : item.type === 'INVESTMENT_AI_FAILED' ? t('AI không xử lý được chứng từ') : item.type === 'INVESTMENT_REPORT_STATUS' ? t('Cập nhật hồ sơ tra soát') : t(item.title);
  const readyMatch = item.type === 'INVESTMENT_AI_READY' ? item.message.match(/^Chứng từ (.+) đã có kết quả để bạn kiểm tra và xác nhận\.$/) : null;
  const failedMatch = item.type === 'INVESTMENT_AI_FAILED' ? item.message.match(/^Chứng từ (.+) đã hết số lần thử\. Bạn có thể mở hàng đợi để thử lại hoặc nhập thủ công\.$/) : null;
  const statementReadyMatch = item.type === 'CREDIT_STATEMENT_IMPORT_READY' ? item.message.match(/^Sao kê thẻ (.+) đã có kết quả, hãy kiểm tra và xác nhận\.$/) : null;
  const reportMatch = item.type === 'INVESTMENT_REPORT_STATUS' ? item.message.match(/^Hồ sơ tra soát #(\d+) đã chuyển sang (.+)\.$/) : null;
  const message = readyMatch ? t('Chứng từ {{name}} đã có kết quả để bạn kiểm tra và xác nhận.', {name: readyMatch[1]})
    : statementReadyMatch ? t('Sao kê thẻ {{name}} đã có kết quả, hãy kiểm tra và xác nhận.', {name: statementReadyMatch[1]})
    : failedMatch ? t('Chứng từ {{name}} đã hết số lần thử. Bạn có thể mở hàng đợi để thử lại hoặc nhập thủ công.', {name: failedMatch[1]})
      : reportMatch ? t('Hồ sơ tra soát #{{id}} đã chuyển sang {{status}}.', {
          id: reportMatch[1],
          status: t(reportMatch[2])
        })
        : t(item.message);
  return <Pressable accessibilityRole="button" accessibilityState={{selected: !item.readAt}} onPress={onOpen}><Card
    style={!item.readAt ? {borderWidth: 1, borderColor: c.primary + '66'} : undefined}><Row><View style={{
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: c[tone] + '18',
    alignItems: 'center',
    justifyContent: 'center'
  }}><Icon name="notifications-outline" color={c[tone]} size={18}/></View><View style={{flex: 1}}><T size={13}
                                                                                                     bold>{title}</T><T
    size={9} color={c.muted}>{item.module} · {dateLabel(item.createdAt)}</T></View>{!item.readAt ?
    <Badge tone="primary">{t('Mới')}</Badge> : null}</Row><T size={11} color={c.muted}>{message}</T><Row><Badge
    tone={tone}>{t(item.severity)}</Badge><View style={{flex: 1}}/>{target ?
    <T size={10} color={c.primary}>{t('Mở liên quan')} ›</T> : !item.readAt ?
      <T size={10} color={c.primary}>{t('Đánh dấu đã đọc')} ›</T> : null}</Row></Card></Pressable>;
}

export function Notifications() {
  const api = useNotificationApi();
  const t = useT();
  const {colors: c} = useTheme();
  const [items, setItems] = useState<NotificationResponse[]>([]);
  const [unread, setUnread] = useState(0);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback(() => {
    setLoading(true);
    Promise.all([api.listAll(), api.unreadCount()]).then(([allItems, count]) => {
      setItems(allItems);
      setUnread(count.count);
      setError('');
    }).catch(e => setError(t(notificationErrorMessage(e)))).finally(() => setLoading(false));
  }, [t]);
  useFocusEffect(useCallback(() => {
    load();
  }, [load]));

  async function open(item: NotificationResponse) {
    let current = item;
    if (!item.readAt) {
      try {
        current = await api.markRead(item.id);
        setItems(previous => previous.map(value => value.id === item.id ? current : value));
        setUnread(value => Math.max(0, value - 1));
      } catch (e) {
        setError(t(notificationErrorMessage(e)));
        return;
      }
    }
    const target = notificationTarget(current.deepLink);
    if (target) go(target.page, target.params);
  }

  async function markAllRead() {
    if (!unread) return;
    try {
      await api.markAllRead();
      setItems(previous => previous.map(item => item.readAt ? item : {...item, readAt: new Date().toISOString()}));
      setUnread(0);
    } catch (e) {
      setError(t(notificationErrorMessage(e)));
    }
  }

  const shown = items.filter(item => filter === 'all' || !item.readAt);
  return <Screen title={t('Thông báo')} subtitle={t('Theo dõi cảnh báo sao kê, AI và tài khoản')} back><Row><View
    style={{flex: 1}}><T size={21} bold>{t('Trung tâm thông báo')}</T><T size={11}
                                                                         color={c.muted}>{t('{{n}} thông báo chưa đọc', {n: unread})}</T></View><Button
    label={t('Tải lại')} kind="secondary" icon="refresh-outline" onPress={load}/></Row><Row><View
    style={{flex: 1}}><Button label={t('Đọc tất cả')} kind="secondary" icon="checkmark-done-outline"
                              onPress={markAllRead} disabled={!unread}/></View></Row><Chips value={filter}
                                                                                            onChange={setFilter}
                                                                                            values={[{
                                                                                              value: 'all',
                                                                                              label: t('Tất cả')
                                                                                            }, {
                                                                                              value: 'unread',
                                                                                              label: t('Chưa đọc')
                                                                                            }]}/>{error ?
    <Info tone="error">{error}</Info> : null}{loading ?
    <ActivityIndicator color={c.primary}/> : shown.length ? shown.map(item => <NotificationCard key={item.id}
                                                                                                item={item}
                                                                                                onOpen={() => open(item)}/>) :
      <Empty title={filter === 'unread' ? t('Không có thông báo chưa đọc') : t('Chưa có thông báo')}
             description={t('Các cảnh báo mới sẽ xuất hiện tại đây.')}/>}</Screen>;
}
