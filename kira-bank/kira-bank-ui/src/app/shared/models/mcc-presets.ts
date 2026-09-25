/** Common spending groups offered as shortcuts. Each maps to one representative 4-digit MCC. */
export interface MccPreset {
  key: string;
  mcc: string;
  labelKey: string
}

export const MCC_PRESETS: readonly MccPreset[] = [
  {key: 'dining', mcc: '5812', labelKey: 'mcc.dining'},
  {key: 'fastFood', mcc: '5814', labelKey: 'mcc.fastFood'},
  {key: 'grocery', mcc: '5411', labelKey: 'mcc.grocery'},
  {key: 'fuel', mcc: '5541', labelKey: 'mcc.fuel'},
  {key: 'ecommerce', mcc: '5399', labelKey: 'mcc.ecommerce'},
  {key: 'rideHailing', mcc: '4121', labelKey: 'mcc.rideHailing'},
  {key: 'airline', mcc: '4511', labelKey: 'mcc.airline'},
  {key: 'hotel', mcc: '7011', labelKey: 'mcc.hotel'},
  {key: 'electronics', mcc: '5732', labelKey: 'mcc.electronics'},
  {key: 'pharmacy', mcc: '5912', labelKey: 'mcc.pharmacy'},
  {key: 'cinema', mcc: '7832', labelKey: 'mcc.cinema'},
  {key: 'education', mcc: '8299', labelKey: 'mcc.education'},
  {key: 'utilities', mcc: '4900', labelKey: 'mcc.utilities'}
];
