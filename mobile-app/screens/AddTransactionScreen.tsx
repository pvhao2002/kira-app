import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { AppPalette } from '@/constants/theme';

const P = AppPalette;
const secondary = '#8b5cf6';
const inputBg = '#121d33';

type TxTypeId = 'deposit' | 'withdraw' | 'reward';
const TX_TYPES: { id: TxTypeId; label: string; icon: string }[] = [
  { id: 'deposit', label: 'Nạp tiền', icon: 'call-received' },
  { id: 'withdraw', label: 'Rút tiền', icon: 'call-made' },
  { id: 'reward', label: 'Thưởng', icon: 'redeem' },
];

export default function AddTransactionScreen() {
  const [txType, setTxType] = useState<TxTypeId>('deposit');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState('2023-10-24');
  const [time, setTime] = useState('14:30');
  const [description, setDescription] = useState('');

  const handleSave = () => {
    router.back();
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: P.background }]} edges={['top']}>
      <View style={[styles.header, { backgroundColor: P.background, borderBottomColor: P.headerBorder }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.8}>
          <MaterialIcons name="arrow-back" size={24} color={P.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: P.text }]}>Thêm giao dịch</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.aiCard, { borderColor: 'rgba(139,92,246,0.3)' }]}>
          <View style={styles.aiCardHead}>
            <View style={styles.aiTitleRow}>
              <MaterialIcons name="auto-fix-high" size={22} color={secondary} />
              <Text style={[styles.aiTitle, { color: P.text }]}>Quét hóa đơn bằng AI</Text>
            </View>
            <View style={[styles.premiumBadge, { backgroundColor: secondary }]}>
              <Text style={styles.premiumText}>Premium</Text>
            </View>
          </View>
          <TouchableOpacity style={[styles.uploadZone, { borderColor: 'rgba(139,92,246,0.3)' }]} activeOpacity={0.8}>
            <View style={[styles.uploadIconWrap, { backgroundColor: 'rgba(139,92,246,0.2)' }]}>
              <MaterialIcons name="cloud-upload" size={32} color={secondary} />
            </View>
            <Text style={[styles.uploadTitle, { color: P.text }]}>Tải lên hoặc chụp ảnh</Text>
            <Text style={[styles.uploadSub, { color: P.textSecondary }]}>Hỗ trợ JPG, PNG, PDF từ ngân hàng hoặc hóa đơn</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.aiBtn, { backgroundColor: secondary }]} activeOpacity={0.9}>
            <MaterialIcons name="settings-suggest" size={18} color="#fff" />
            <Text style={styles.aiBtnText}>Bắt đầu quét bằng AI</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={[styles.label, { color: P.textSecondary }]}>Loại giao dịch</Text>
          <View style={styles.txTypeRow}>
            {TX_TYPES.map((t) => {
              const selected = txType === t.id;
              return (
                <TouchableOpacity
                  key={t.id}
                  style={[
                    styles.txTypeBtn,
                    { backgroundColor: selected ? P.primarySoft : inputBg, borderColor: selected ? P.primary : 'transparent' },
                  ]}
                  onPress={() => setTxType(t.id)}
                  activeOpacity={0.8}
                >
                  <MaterialIcons name={t.icon as 'call-received'} size={24} color={selected ? P.primary : P.textSecondary} />
                  <Text style={[styles.txTypeLabel, { color: selected ? P.primary : P.textSecondary }]}>{t.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.label, { color: P.textSecondary }]}>Số tiền (VNĐ)</Text>
          <View style={[styles.amountWrap, { backgroundColor: inputBg }]}>
            <Text style={[styles.amountPrefix, { color: P.primary }]}>₫</Text>
            <TextInput
              style={[styles.amountInput, { color: P.text }]}
              placeholder="0"
              placeholderTextColor={P.textSecondary}
              value={amount}
              onChangeText={setAmount}
              keyboardType="numeric"
            />
          </View>
        </View>

        <View style={styles.row2}>
          <View style={[styles.section, styles.half]}>
            <Text style={[styles.label, { color: P.textSecondary }]}>Ngày giao dịch</Text>
            <View style={[styles.inputWrap, { backgroundColor: inputBg }]}>
              <TextInput
                style={[styles.input, { color: P.text }]}
                value={date}
                onChangeText={setDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={P.textSecondary}
              />
              <MaterialIcons name="calendar-today" size={22} color={P.textSecondary} />
            </View>
          </View>
          <View style={[styles.section, styles.half]}>
            <Text style={[styles.label, { color: P.textSecondary }]}>Giờ giao dịch</Text>
            <View style={[styles.inputWrap, { backgroundColor: inputBg }]}>
              <TextInput
                style={[styles.input, { color: P.text }]}
                value={time}
                onChangeText={setTime}
                placeholder="14:30"
                placeholderTextColor={P.textSecondary}
              />
              <MaterialIcons name="schedule" size={22} color={P.textSecondary} />
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.labelRow}>
            <Text style={[styles.label, { color: P.textSecondary }]}>Mô tả</Text>
            <Text style={[styles.optional, { color: P.textSecondary }]}>Tùy chọn</Text>
          </View>
          <TextInput
            style={[styles.textArea, { backgroundColor: inputBg, color: P.text }]}
            placeholder="Nhập ghi chú cho giao dịch này..."
            placeholderTextColor={P.textSecondary}
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={3}
          />
        </View>

        <View style={styles.actionsRow}>
          <TouchableOpacity style={[styles.cancelBtn, { backgroundColor: P.surfaceInput }]} onPress={() => router.back()} activeOpacity={0.8}>
            <Text style={[styles.cancelBtnText, { color: P.text }]}>Hủy bỏ</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.saveBtn, { backgroundColor: P.primary }]} onPress={handleSave} activeOpacity={0.9}>
            <MaterialIcons name="save" size={18} color="#fff" />
            <Text style={styles.saveBtnText}>Lưu giao dịch</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.footerNote}>
          <MaterialIcons name="verified-user" size={14} color={P.textSecondary} />
          <Text style={[styles.footerNoteText, { color: P.textSecondary }]}>Dữ liệu được xử lý an toàn & bảo mật bởi KiraManager AI</Text>
        </View>
        <View style={styles.bottomPad} />
      </ScrollView>
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
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  headerRight: { width: 40 },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 40 },
  aiCard: {
    backgroundColor: 'rgba(67,56,202,0.25)',
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    marginBottom: 24,
  },
  aiCardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  aiTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  aiTitle: { fontSize: 16, fontWeight: '600' },
  premiumBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  premiumText: { fontSize: 10, fontWeight: '700', color: '#fff', textTransform: 'uppercase' },
  uploadZone: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderRadius: 12,
    backgroundColor: 'rgba(139,92,246,0.08)',
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
  },
  uploadIconWrap: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  uploadTitle: { fontSize: 14, fontWeight: '500' },
  uploadSub: { fontSize: 11, marginTop: 4, textAlign: 'center' },
  aiBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 48,
    borderRadius: 12,
  },
  aiBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  section: { marginBottom: 20 },
  half: { flex: 1 },
  row2: { flexDirection: 'row', gap: 16 },
  label: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, marginLeft: 4 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  optional: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  txTypeRow: { flexDirection: 'row', gap: 8 },
  txTypeBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 2,
  },
  txTypeLabel: { fontSize: 12, fontWeight: '600' },
  amountWrap: { flexDirection: 'row', alignItems: 'center', height: 56, borderRadius: 12, paddingLeft: 16, paddingRight: 16 },
  amountPrefix: { fontSize: 22, fontWeight: '800', marginRight: 8 },
  amountInput: { flex: 1, fontSize: 24, fontWeight: '800' },
  inputWrap: { flexDirection: 'row', alignItems: 'center', height: 48, borderRadius: 12, paddingLeft: 16, paddingRight: 12 },
  input: { flex: 1, fontSize: 14, fontWeight: '500' },
  textArea: { minHeight: 88, borderRadius: 12, padding: 16, fontSize: 14, textAlignVertical: 'top' },
  actionsRow: { flexDirection: 'row', gap: 16, marginTop: 24 },
  cancelBtn: { flex: 1, height: 52, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  cancelBtnText: { fontSize: 16, fontWeight: '700' },
  saveBtn: { flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 52, borderRadius: 12 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  footerNote: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 24 },
  footerNoteText: { fontSize: 10 },
  bottomPad: { height: 24 },
});
