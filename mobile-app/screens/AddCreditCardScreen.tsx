import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { AppPalette } from '@/constants/theme';

const inputBg = '#1c2127';
const borderInput = '#334155';

export default function AddCreditCardScreen() {
  const P = AppPalette;
  const [bankName, setBankName] = useState('');
  const [limit, setLimit] = useState('');
  const [cardholder, setCardholder] = useState('');
  const [statementDay, setStatementDay] = useState('');
  const [paymentDay, setPaymentDay] = useState('');
  const [paymentTime, setPaymentTime] = useState('09:00');

  const displayBank = bankName.trim() || 'TPBank';
  const displayLimit = limit.trim() || '50.000.000';
  const displayCardholder = cardholder.trim().toUpperCase() || 'NGUYEN VAN A';
  const displayStmtDay = statementDay.trim() || '20';
  const displayPayDay = paymentDay.trim() || '05';

  const handleSave = () => {
    router.back();
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: P.background }]} edges={['top']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={[styles.cardPreview, { backgroundColor: '#1e3a5f' }]}>
            <View style={styles.cardInner}>
              <View style={styles.cardTopRow}>
                <View style={styles.chip} />
                <Text style={styles.cardBankName} numberOfLines={1}>{displayBank}</Text>
              </View>
              <View style={styles.cardCreditLabel}>
                <Text style={styles.cardCreditLabelText}>Hạn mức tín dụng</Text>
                <Text style={styles.cardCreditValue}>
                  {displayLimit.replace(/\B(?=(\d{3})+(?!\d))/g, '.')} <Text style={styles.cardVnd}>VND</Text>
                </Text>
              </View>
              <View style={styles.cardBottomRow}>
                <View>
                  <Text style={styles.cardMetaLabel}>Chủ thẻ</Text>
                  <Text style={styles.cardMetaValue} numberOfLines={1}>{displayCardholder}</Text>
                </View>
                <View style={styles.cardMetaRight}>
                  <View style={styles.cardMetaCol}>
                    <Text style={styles.cardMetaLabel}>Sao kê</Text>
                    <Text style={styles.cardMetaValue}>Ngày {displayStmtDay}</Text>
                  </View>
                  <View style={[styles.cardMetaDivider, { backgroundColor: 'rgba(255,255,255,0.2)' }]} />
                  <View style={styles.cardMetaCol}>
                    <Text style={styles.cardMetaLabel}>Hạn TT</Text>
                    <Text style={[styles.cardMetaValue, { color: '#fde047' }]}>Ngày {displayPayDay}</Text>
                  </View>
                </View>
              </View>
            </View>
          </View>

          <View style={styles.form}>
            <View style={styles.field}>
              <Text style={[styles.label, { color: P.labelDark }]}>Tên ngân hàng</Text>
              <View style={[styles.inputWrap, { backgroundColor: inputBg, borderColor: borderInput }]}>
                <MaterialIcons name="account-balance" size={20} color={P.textSecondary} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, { color: P.text }]}
                  placeholder="Ví dụ: TPBank, Vietcombank"
                  placeholderTextColor={P.textSecondary}
                  value={bankName}
                  onChangeText={setBankName}
                />
              </View>
            </View>

            <View style={styles.field}>
              <Text style={[styles.label, { color: P.labelDark }]}>Hạn mức tín dụng</Text>
              <View style={[styles.inputWrap, { backgroundColor: inputBg, borderColor: borderInput }]}>
                <MaterialIcons name="payments" size={20} color={P.textSecondary} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, { color: P.text }]}
                  placeholder="50.000.000"
                  placeholderTextColor={P.textSecondary}
                  value={limit}
                  onChangeText={setLimit}
                  keyboardType="numeric"
                />
                <Text style={[styles.inputSuffix, { color: P.textSecondary }]}>VND</Text>
              </View>
            </View>

            <View style={styles.field}>
              <Text style={[styles.label, { color: P.labelDark }]}>Tên chủ thẻ</Text>
              <View style={[styles.inputWrap, { backgroundColor: inputBg, borderColor: borderInput }]}>
                <MaterialIcons name="person" size={20} color={P.textSecondary} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, { color: P.text }]}
                  placeholder="NGUYEN VAN A"
                  placeholderTextColor={P.textSecondary}
                  value={cardholder}
                  onChangeText={setCardholder}
                  autoCapitalize="characters"
                />
              </View>
            </View>

            <View style={styles.row2}>
              <View style={[styles.field, styles.half]}>
                <Text style={[styles.label, { color: P.labelDark }]}>Ngày sao kê</Text>
                <View style={[styles.inputWrap, { backgroundColor: inputBg, borderColor: borderInput }]}>
                  <MaterialIcons name="receipt-long" size={20} color={P.textSecondary} style={styles.inputIcon} />
                  <TextInput
                    style={[styles.input, { color: P.text }]}
                    placeholder="Ngày 20"
                    placeholderTextColor={P.textSecondary}
                    value={statementDay}
                    onChangeText={setStatementDay}
                  />
                </View>
              </View>
              <View style={[styles.field, styles.half]}>
                <Text style={[styles.label, { color: P.labelDark }]}>Ngày thanh toán</Text>
                <View style={[styles.inputWrap, { backgroundColor: inputBg, borderColor: borderInput }]}>
                  <MaterialIcons name="event-available" size={20} color={P.textSecondary} style={styles.inputIcon} />
                  <TextInput
                    style={[styles.input, { color: P.text }]}
                    placeholder="Ngày 05"
                    placeholderTextColor={P.textSecondary}
                    value={paymentDay}
                    onChangeText={setPaymentDay}
                  />
                </View>
              </View>
            </View>

            <View style={styles.field}>
              <Text style={[styles.label, { color: P.labelDark }]}>Giờ thanh toán</Text>
              <View style={[styles.inputWrap, { backgroundColor: inputBg, borderColor: borderInput }]}>
                <MaterialIcons name="schedule" size={20} color={P.textSecondary} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, { color: P.text }]}
                  value={paymentTime}
                  onChangeText={setPaymentTime}
                  placeholder="09:00"
                  placeholderTextColor={P.textSecondary}
                />
              </View>
              <Text style={[styles.hint, { color: P.textSecondary }]}>
                Chúng tôi sẽ nhắc bạn thanh toán vào thời gian này.
              </Text>
            </View>

            <View style={styles.securityRow}>
              <MaterialIcons name="shield" size={20} color={AppPalette.green} />
              <Text style={[styles.securityText, { color: P.textSecondary }]}>Thông tin được bảo mật 100%</Text>
            </View>

            <TouchableOpacity
              style={[styles.saveBtn, { backgroundColor: P.primary }]}
              onPress={handleSave}
              activeOpacity={0.9}
            >
              <Text style={styles.saveBtnText}>Lưu thẻ</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 40, maxWidth: 400, alignSelf: 'center', width: '100%' },
  cardPreview: {
    width: '100%',
    aspectRatio: 1.586,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 32,
  },
  cardInner: {
    flex: 1,
    justifyContent: 'space-between',
    padding: 24,
  },
  cardTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  chip: {
    width: 48,
    height: 36,
    borderRadius: 6,
    backgroundColor: 'rgba(253,224,71,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(253,224,71,0.4)',
  },
  cardBankName: { fontSize: 18, fontWeight: '700', letterSpacing: 1, color: 'rgba(255,255,255,0.9)', maxWidth: 140 },
  cardCreditLabel: { marginTop: 8 },
  cardCreditLabelText: { fontSize: 10, fontWeight: '600', letterSpacing: 1, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase' },
  cardCreditValue: { fontSize: 28, fontWeight: '700', color: '#fff' },
  cardVnd: { fontSize: 16, fontWeight: '500', opacity: 0.8 },
  cardBottomRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  cardMetaRight: { flexDirection: 'row', alignItems: 'flex-end', gap: 12 },
  cardMetaCol: { alignItems: 'flex-end' },
  cardMetaLabel: { fontSize: 10, fontWeight: '600', letterSpacing: 1, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', marginBottom: 2 },
  cardMetaValue: { fontSize: 14, fontWeight: '700', color: '#fff' },
  cardMetaDivider: { width: 1, height: 32, marginBottom: 4 },
  form: { gap: 20 },
  field: { gap: 8 },
  half: { flex: 1 },
  row2: { flexDirection: 'row', gap: 16 },
  label: { fontSize: 14, fontWeight: '500' },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    paddingLeft: 12,
    paddingRight: 12,
  },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, fontSize: 16 },
  inputSuffix: { fontSize: 14, fontWeight: '500', marginLeft: 8 },
  hint: { fontSize: 12, marginTop: 4, paddingHorizontal: 4 },
  securityRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16, opacity: 0.8 },
  securityText: { fontSize: 12, fontWeight: '500' },
  saveBtn: {
    height: 52,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
