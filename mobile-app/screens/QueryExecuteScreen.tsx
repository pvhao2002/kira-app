import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  Modal,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

const API_URL = 'http://192.168.2.129:2308/api/sql/execute';
const HISTORY_KEY = 'query_execute_history';
const MAX_HISTORY = 10;

export type QueryHistoryItem = {
  firstHdc: string;
  lastHdc: string;
  firstOu: string;
  lastOu: string;
  firstCorner: string;
  lastCorner: string;
  htResult: string;
  mode: string;
  createdAt: number;
  name?: string;
};

function formatHistoryDate(ts: number): string {
  const d = new Date(ts);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${day}/${month}/${year} ${h}:${m}`;
}

// Mockup: background #050a14, card #0d1526, input #121d33, border #1e2d4d, primary #00e5ff, text-dim #a0aec0
const Q = {
  bg: '#050a14',
  card: '#0d1526',
  input: '#121d33',
  border: '#1e2d4d',
  primary: '#00e5ff',
  textDim: '#a0aec0',
  accentBlue: '#3b82f6',
};

type ResultRow = { ft: string; ht: string; count: number };

function parseApiRow(item: Record<string, unknown>): ResultRow {
  const ft = (item.ftScore ?? item.ft_score ?? item.ft ?? '') as string;
  const ht = (item.htScore ?? item.ht_score ?? item.ht ?? '') as string;
  const count = Number(item.count ?? item.total ?? 0);
  return {
    ft: String(ft).replace(/-/g, ' - '),
    ht: String(ht).replace(/-/g, ' - '),
    count: Number.isNaN(count) ? 0 : count,
  };
}

export default function QueryExecuteScreen() {
  const [firstHdc, setFirstHdc] = useState('');
  const [lastHdc, setLastHdc] = useState('');
  const [firstOu, setFirstOu] = useState('');
  const [lastOu, setLastOu] = useState('');
  const [firstCorner, setFirstCorner] = useState('');
  const [lastCorner, setLastCorner] = useState('');
  const [htResult, setHtResult] = useState('');
  const [rows, setRows] = useState<ResultRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasExecuted, setHasExecuted] = useState(false);
  const [history, setHistory] = useState<QueryHistoryItem[]>([]);
  const [editingHistoryIndex, setEditingHistoryIndex] = useState<number | null>(null);
  const [editingName, setEditingName] = useState('');
  const [historyExpanded, setHistoryExpanded] = useState(false);

  const defaultHistoryCount = 3;
  const displayedHistory = historyExpanded ? history : history.slice(0, defaultHistoryCount);
  const hasMoreHistory = history.length > defaultHistoryCount;

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(HISTORY_KEY);
        const list = raw ? JSON.parse(raw) : [];
        setHistory(Array.isArray(list) ? list.slice(0, MAX_HISTORY) : []);
      } catch {
        setHistory([]);
      }
    })();
  }, []);

  const applyHistoryItem = useCallback((item: QueryHistoryItem) => {
    setFirstHdc(item.firstHdc ?? '');
    setLastHdc(item.lastHdc ?? '');
    setFirstOu(item.firstOu ?? '');
    setLastOu(item.lastOu ?? '');
    setFirstCorner(item.firstCorner ?? '');
    setLastCorner(item.lastCorner ?? '');
    setHtResult(item.htResult ?? '');
    setError(null);
  }, []);

  const openRenameModal = useCallback((item: QueryHistoryItem, index: number) => {
    setEditingName(item.name ?? '');
    setEditingHistoryIndex(index);
  }, []);

  const saveHistoryName = useCallback(() => {
    if (editingHistoryIndex === null) return;
    const idx = editingHistoryIndex;
    setHistory(prev => {
      const next = prev.map((it, i) =>
        i === idx ? { ...it, name: editingName.trim() || undefined } : it
      );
      AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
    setEditingHistoryIndex(null);
  }, [editingHistoryIndex, editingName]);

  const clearHistory = useCallback(() => {
    Alert.alert(
      'Xóa lịch sử',
      'Bạn có chắc muốn xóa toàn bộ lịch sử truy vấn?',
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xóa',
          style: 'destructive',
          onPress: () => {
            setHistory([]);
            AsyncStorage.setItem(HISTORY_KEY, JSON.stringify([])).catch(() => {});
          },
        },
      ]
    );
  }, []);

  const handleReset = () => {
    setFirstHdc('');
    setLastHdc('');
    setFirstOu('');
    setLastOu('');
    setFirstCorner('');
    setLastCorner('');
    setHtResult('');
    setRows([]);
    setError(null);
    setHasExecuted(false);
  };

  const handleExecute = async () => {
    setError(null);
    setLoading(true);
    try {
      const body = {
        firstHdc: firstHdc.trim() || '-0.5#+0.5',
        lastHdc: lastHdc.trim() || '-0.5/1#+0.5/1',
        firstOu: firstOu.trim() || '2.5/3',
        lastOu: lastOu.trim() || '2.5',
        firstCorner: firstCorner.trim() || '9.5',
        lastCorner: lastCorner.trim() || '9.5',
        htScoreStr: htResult.trim(),
        mode: 'FT',
      };
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'accept': 'application/json, text/plain, */*',
          'content-type': 'application/json',
          'origin': 'https://kira.id.vn',
          'referer': 'https://kira.id.vn/',
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `HTTP ${res.status}`);
      }
      const data = await res.json();
      const list = Array.isArray(data) ? data : (data.data ?? data.rows ?? data.result ?? []);
      const parsed = list.map((item: Record<string, unknown>) => parseApiRow(item));
      setRows(parsed);
      setHasExecuted(true);
      const historyItem: QueryHistoryItem = {
        firstHdc: body.firstHdc,
        lastHdc: body.lastHdc,
        firstOu: body.firstOu,
        lastOu: body.lastOu,
        firstCorner: body.firstCorner,
        lastCorner: body.lastCorner,
        htResult: body.htScoreStr,
        mode: body.mode,
        createdAt: Date.now(),
      };
      setHistory(prev => {
        const next = [historyItem, ...prev].slice(0, MAX_HISTORY);
        AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(next)).catch(() => {});
        return next;
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Lỗi kết nối';
      setError(message);
      setRows([]);
      setHasExecuted(true);
      Alert.alert('Lỗi', message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: Q.bg }]} edges={['top']}>
      <View style={[styles.header, { backgroundColor: Q.bg, borderBottomColor: Q.border }]}>
        <View style={styles.headerLeft}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.8}>
            <MaterialIcons name="arrow-back-ios-new" size={20} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Query nâng cao</Text>
        </View>
        <TouchableOpacity onPress={handleReset} activeOpacity={0.8}>
          <Text style={[styles.resetBtn, { color: Q.primary }]}>Đặt lại</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.form}>
          <View style={styles.row2}>
            <View style={styles.fieldHalf}>
              <Text style={[styles.label, { color: Q.textDim }]}>First HDC</Text>
              <TextInput
                style={[styles.input, { backgroundColor: Q.input, borderColor: Q.border, color: '#fff' }]}
                placeholder=""
                placeholderTextColor="#4a5568"
                value={firstHdc}
                onChangeText={setFirstHdc}
              />
            </View>
            <View style={styles.fieldHalf}>
              <Text style={[styles.label, { color: Q.textDim }]}>Last HDC</Text>
              <TextInput
                style={[styles.input, { backgroundColor: Q.input, borderColor: Q.border, color: '#fff' }]}
                placeholder=""
                placeholderTextColor="#4a5568"
                value={lastHdc}
                onChangeText={setLastHdc}
              />
            </View>
          </View>
          <View style={styles.row2}>
            <View style={styles.fieldHalf}>
              <Text style={[styles.label, { color: Q.textDim }]}>First OU</Text>
              <TextInput
                style={[styles.input, { backgroundColor: Q.input, borderColor: Q.border, color: '#fff' }]}
                placeholder=""
                placeholderTextColor="#4a5568"
                value={firstOu}
                onChangeText={setFirstOu}
              />
            </View>
            <View style={styles.fieldHalf}>
              <Text style={[styles.label, { color: Q.textDim }]}>Last OU</Text>
              <TextInput
                style={[styles.input, { backgroundColor: Q.input, borderColor: Q.border, color: '#fff' }]}
                placeholder=""
                placeholderTextColor="#4a5568"
                value={lastOu}
                onChangeText={setLastOu}
              />
            </View>
          </View>
          <View style={styles.row2}>
            <View style={styles.fieldHalf}>
              <Text style={[styles.label, { color: Q.textDim }]}>First Corner</Text>
              <TextInput
                style={[styles.input, { backgroundColor: Q.input, borderColor: Q.border, color: '#fff' }]}
                placeholder=""
                placeholderTextColor="#4a5568"
                value={firstCorner}
                onChangeText={setFirstCorner}
              />
            </View>
            <View style={styles.fieldHalf}>
              <Text style={[styles.label, { color: Q.textDim }]}>Last Corner</Text>
              <TextInput
                style={[styles.input, { backgroundColor: Q.input, borderColor: Q.border, color: '#fff' }]}
                placeholder=""
                placeholderTextColor="#4a5568"
                value={lastCorner}
                onChangeText={setLastCorner}
              />
            </View>
          </View>
          <View style={styles.field}>
            <Text style={[styles.label, { color: Q.textDim }]}>HT Result</Text>
            <TextInput
              style={[styles.input, { backgroundColor: Q.input, borderColor: Q.border, color: '#fff' }]}
              placeholder=""
              placeholderTextColor="#4a5568"
              value={htResult}
              onChangeText={setHtResult}
            />
          </View>
          <TouchableOpacity
            style={[styles.executeBtn, { backgroundColor: Q.primary }]}
            activeOpacity={0.9}
            onPress={handleExecute}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color={Q.bg} />
            ) : (
              <>
                <MaterialIcons name="dataset" size={22} color={Q.bg} />
                <Text style={[styles.executeBtnText, { color: Q.bg }]}>Execute Query</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {history.length > 0 && (
          <View style={styles.historySection}>
            <View style={styles.historySectionHead}>
              <Text style={[styles.historyTitle, { color: Q.textDim }]}>Lịch sử 10 lần query gần nhất</Text>
              <TouchableOpacity onPress={clearHistory} activeOpacity={0.8}>
                <Text style={[styles.clearHistoryBtn, { color: Q.textDim }]}>Xóa lịch sử</Text>
              </TouchableOpacity>
            </View>
            <View style={[styles.historyList, { backgroundColor: Q.card, borderColor: Q.border }]}>
              {displayedHistory.map((item, index) => (
                <TouchableOpacity
                  key={`${item.createdAt}-${index}`}
                  style={[styles.historyItem, index < displayedHistory.length - 1 && { borderBottomWidth: 1, borderBottomColor: Q.border }]}
                  onPress={() => applyHistoryItem(item)}
                  onLongPress={() => openRenameModal(item, index)}
                  activeOpacity={0.7}
                >
                  <View style={styles.historyItemContent}>
                    {item.name ? (
                      <Text style={[styles.historyItemName, { color: Q.primary }]} numberOfLines={1}>{item.name}</Text>
                    ) : null}
                    <Text style={[styles.historyItemTime, { color: Q.textDim }]}>{formatHistoryDate(item.createdAt)}</Text>
                    <Text style={[styles.historyItemSummary, { color: '#fff' }]} numberOfLines={1}>
                      HDC {item.firstHdc} → {item.lastHdc} · OU {item.firstOu} → {item.lastOu} · Corner {item.firstCorner} → {item.lastCorner}
                      {item.htResult ? ` · HT: ${item.htResult}` : ''}
                    </Text>
                  </View>
                  <MaterialIcons name="chevron-right" size={20} color={Q.textDim} />
                </TouchableOpacity>
              ))}
            </View>
            {hasMoreHistory && (
              <TouchableOpacity
                style={[styles.expandHistoryBtn, { borderColor: Q.border }]}
                onPress={() => setHistoryExpanded(!historyExpanded)}
                activeOpacity={0.8}
              >
                <Text style={[styles.expandHistoryBtnText, { color: Q.primary }]}>
                  {historyExpanded ? 'Thu gọn' : `Xem thêm (${history.length - defaultHistoryCount})`}
                </Text>
                <MaterialIcons name={historyExpanded ? 'expand-less' : 'expand-more'} size={20} color={Q.primary} />
              </TouchableOpacity>
            )}
          </View>
        )}

        <View style={styles.resultsSection}>
          <View style={styles.resultsHead}>
            <Text style={styles.resultsTitle}>Kết quả truy vấn</Text>
            <View style={[styles.liveBadge, { backgroundColor: 'rgba(0,229,255,0.1)', borderColor: 'rgba(0,229,255,0.3)' }]}>
              <Text style={[styles.liveBadgeText, { color: Q.primary }]}>Live Data</Text>
            </View>
          </View>
          {error ? (
            <View style={[styles.tableWrap, { padding: 16, backgroundColor: Q.card, borderColor: Q.border }]}>
              <Text style={[styles.errorText, { color: Q.textDim }]}>{error}</Text>
            </View>
          ) : (
            <View style={[styles.tableWrap, { backgroundColor: Q.card, borderColor: Q.border }]}>
              <View style={[styles.tableHeader, { backgroundColor: 'rgba(18,29,51,0.5)', borderBottomColor: Q.border }]}>
                <Text style={[styles.th, { color: Q.textDim }]}>FT Score</Text>
                <Text style={[styles.th, { color: Q.textDim }]}>HT Score</Text>
                <Text style={[styles.th, styles.thRight, { color: Q.textDim }]}>Count</Text>
              </View>
              {rows.length === 0 ? (
                <View style={styles.emptyRow}>
                  <Text style={[styles.emptyText, { color: Q.textDim }]}>
                    {hasExecuted ? 'No records.' : 'Vui lòng bấm nút Execute.'}
                  </Text>
                </View>
              ) : (
                rows.map((row, i) => (
                  <View
                    key={i}
                    style={[styles.tableRow, i < rows.length - 1 && { borderBottomWidth: 1, borderBottomColor: 'rgba(30,45,77,0.5)' }]}
                  >
                    <Text style={styles.tdFt}>{row.ft}</Text>
                    <Text style={[styles.tdHt, { color: Q.textDim }]}>{row.ht}</Text>
                    <Text style={[styles.tdCount, { color: Q.primary }]}>{row.count}</Text>
                  </View>
                ))
              )}
              <View style={[styles.tableFooter, { backgroundColor: 'rgba(18,29,51,0.3)', borderTopColor: Q.border }]}>
                <Text style={[styles.footerText, { color: Q.textDim }]}>
                  {rows.length === 0 ? '0 hàng' : `Hiển thị ${rows.length} hàng`}
                </Text>
                <View style={styles.pagination}>
                  <TouchableOpacity style={[styles.pageBtn, { opacity: 0.3 }]} disabled>
                    <MaterialIcons name="chevron-left" size={20} color={Q.textDim} />
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.pageBtn]}>
                    <MaterialIcons name="chevron-right" size={20} color={Q.primary} />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}
          <View style={[styles.infoBox, { backgroundColor: 'rgba(59,130,246,0.05)', borderColor: 'rgba(59,130,246,0.2)' }]}>
            <MaterialIcons name="info" size={22} color={Q.accentBlue} />
            <Text style={[styles.infoText, { color: Q.textDim }]}>
              Dữ liệu được tổng hợp từ các mùa giải gần nhất. Bạn có thể thay đổi tham số để tinh chỉnh độ chính xác của dự đoán.
            </Text>
          </View>
        </View>
        <View style={styles.bottomPad} />
      </ScrollView>

      <Modal
        visible={editingHistoryIndex !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setEditingHistoryIndex(null)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setEditingHistoryIndex(null)}
        >
          <TouchableOpacity style={[styles.modalBox, { backgroundColor: Q.card, borderColor: Q.border }]} activeOpacity={1} onPress={() => {}}>
            <Text style={[styles.modalTitle, { color: '#fff' }]}>Đặt tên truy vấn</Text>
            <TextInput
              style={[styles.modalInput, { backgroundColor: Q.input, borderColor: Q.border, color: '#fff' }]}
              placeholder="Nhập tên..."
              placeholderTextColor={Q.textDim}
              value={editingName}
              onChangeText={setEditingName}
              autoFocus
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.modalBtn, { borderColor: Q.border }]} onPress={() => setEditingHistoryIndex(null)}>
                <Text style={[styles.modalBtnText, { color: Q.textDim }]}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: Q.primary }]} onPress={saveHistoryName}>
                <Text style={[styles.modalBtnText, { color: Q.bg }]}>Lưu</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  backBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#fff' },
  resetBtn: { fontSize: 14, fontWeight: '600' },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 40, maxWidth: 400, alignSelf: 'center', width: '100%' },
  hero: { alignItems: 'center', paddingVertical: 24 },
  heroTitle: { fontSize: 24, fontWeight: '700', color: '#fff' },
  heroSub: { fontSize: 14, marginTop: 4 },
  form: { gap: 16 },
  row2: { flexDirection: 'row', gap: 12 },
  field: { gap: 6 },
  fieldHalf: { flex: 1, gap: 6 },
  label: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginLeft: 4 },
  input: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
    fontSize: 14,
  },
  executeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 52,
    borderRadius: 12,
    marginTop: 8,
  },
  executeBtnText: { fontSize: 16, fontWeight: '700' },
  historySection: { marginTop: 24, gap: 10 },
  historySectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  historyTitle: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginLeft: 4 },
  clearHistoryBtn: { fontSize: 12, fontWeight: '600' },
  expandHistoryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  expandHistoryBtnText: { fontSize: 14, fontWeight: '600' },
  historyList: { borderRadius: 12, borderWidth: 1, overflow: 'hidden' },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  historyItemContent: { flex: 1, marginRight: 8, gap: 2 },
  historyItemName: { fontSize: 14, fontWeight: '700' },
  historyItemTime: { fontSize: 11 },
  historyItemSummary: { fontSize: 13 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalBox: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    gap: 16,
  },
  modalTitle: { fontSize: 18, fontWeight: '700' },
  modalInput: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
    fontSize: 14,
  },
  modalActions: { flexDirection: 'row', gap: 12, justifyContent: 'flex-end' },
  modalBtn: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  modalBtnText: { fontSize: 14, fontWeight: '600' },
  resultsSection: { marginTop: 32, gap: 16 },
  resultsHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  resultsTitle: { fontSize: 18, fontWeight: '700', color: '#fff' },
  liveBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1 },
  liveBadgeText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  tableWrap: { borderRadius: 12, borderWidth: 1, overflow: 'hidden' },
  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  th: { fontSize: 10, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', flex: 1 },
  thRight: { textAlign: 'right' },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  tdFt: { flex: 1, fontSize: 14, fontWeight: '600', color: '#fff' },
  tdHt: { flex: 1, fontSize: 14 },
  tdCount: { flex: 1, fontSize: 14, fontWeight: '700', textAlign: 'right' },
  emptyRow: { padding: 24, alignItems: 'center' },
  emptyText: { fontSize: 14 },
  errorText: { fontSize: 14 },
  tableFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
  },
  footerText: { fontSize: 10 },
  pagination: { flexDirection: 'row', gap: 4 },
  pageBtn: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  infoText: { flex: 1, fontSize: 12, lineHeight: 18 },
  bottomPad: { height: 24 },
});
