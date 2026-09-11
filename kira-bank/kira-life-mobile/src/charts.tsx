import React from 'react';
import { View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop, Path, Line, Text as SvgText } from 'react-native-svg';
import { colors as c } from './theme';
import { Row, T } from './ui';

export function TrendChart({ investment = false, period = '6T' }: { investment?: boolean; period?: string }) {
  const points = period === '3T' ? [72, 45, 32] : period === '1N' ? [100, 92, 96, 84, 88, 80, 60, 72, 45, 32, 40, 28] : [88, 80, 60, 72, 45, 32];
  const coordinates = points.map((y, i) => `${15 + i * 310 / (points.length - 1)},${y}`);
  const line = period === '6T' ? 'M 15 88 Q 70 75, 90 80 T 160 60 T 225 72 T 285 45 T 325 32' : `M${coordinates.join(' L')}`;
  return <View accessibilityLabel={investment ? 'Biểu đồ dòng tiền theo tháng' : 'Biểu đồ dư nợ theo kỳ'}>
    <Svg width="100%" height={160} viewBox="0 0 340 160">
      <Defs><LinearGradient id="area" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor={c.primary} stopOpacity="0.3" /><Stop offset="1" stopColor={c.primary} stopOpacity="0" /></LinearGradient></Defs>
      {[25, 65, 110].map(y => <Line key={y} x1="15" x2="325" y1={y} y2={y} stroke={c.border} strokeDasharray="4 4" />)}
      <Path d={`${line} L325,110 L15,110 Z`} fill="url(#area)" /><Path d={line} fill="none" stroke={c.primary} strokeWidth="2.5" />
      <Circle cx="325" cy={points[points.length - 1]} r="4" fill={c.primary} />
      {(period === '3T' ? ['T08', 'T09', 'T10'] : period === '1N' ? ['T11', 'T01', 'T03', 'T05', 'T07', 'T10'] : ['T05', 'T06', 'T07', 'T08', 'T09', 'T10']).map((label, i, labels) => <SvgText fontFamily="Inter_600SemiBold" key={label} x={15 + i * 310 / (labels.length - 1)} y="142" fill={c.muted} fontSize="10" textAnchor={i === 0 ? 'start' : i === labels.length - 1 ? 'end' : 'middle'}>{label}</SvgText>)}
    </Svg>
  </View>;
}
export function Gauge({ value = 28.5 }: { value?: number }) {
  return <View style={{ alignItems: 'center', gap: 6 }}><Svg width={130} height={80} viewBox="0 0 120 75"><Path d="M10 65 A50 50 0 0 1 110 65" stroke={c.elevated} strokeWidth="9" fill="none" strokeLinecap="round" /><Path d="M10 65 A50 50 0 0 1 110 65" stroke={c.primary} strokeWidth="9" fill="none" strokeDasharray="157" strokeDashoffset={157 * (1 - value / 100)} strokeLinecap="round" /><SvgText fontFamily="Inter_600SemiBold" x="60" y="60" fill={c.primary} textAnchor="middle" fontWeight="bold" fontSize="20">{value}%</SvgText></Svg><T size={10} color={c.muted}>Tỷ lệ sử dụng</T></View>;
}
export function Allocation({ items }: { items: { label: string; percent: number; value?: string }[] }) {
  const palette = [c.primary, c.lavender, '#88b4cc', '#4a6070'];
  return <View style={{ gap: 14 }}><Row style={{ gap: 3, overflow: 'hidden', borderRadius: 8 }}>{items.map((item, i) => <View key={item.label} style={{ flex: item.percent, height: 8, backgroundColor: palette[i % palette.length] }} />)}</Row>{items.map((item, i) => <Row key={item.label} style={{ gap: 8 }}><View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: palette[i % palette.length] }} /><T size={12} style={{ flex: 1 }}>{item.label}</T><View style={{ alignItems: 'flex-end' }}>{item.value ? <T size={12} bold>{item.value}</T> : null}<T size={10} color={c.muted}>{item.percent}%</T></View></Row>)}</View>;
}
