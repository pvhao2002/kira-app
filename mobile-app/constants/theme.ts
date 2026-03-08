import { Platform } from 'react-native';

// Global design tokens for the mobile app (colors, backgrounds, API base, fonts).
// Bám mockup đăng nhập: primary #137fec, background-dark #101922, input dark #1C2632.

const primary = '#137fec';
const accentBlue = '#2563eb'; // blue-600 cho gradient logo
const backgroundLight = '#f6f7f8';
const backgroundDark = '#101922';
const cardDark = '#0d1526';
const inputDark = '#1C2632';
const borderDark = '#334155'; // slate-700
const borderDarkDivider = '#1e293b'; // slate-800
const textSecondaryLight = '#64748b'; // slate-500
const textSecondaryDark = '#94a3b8'; // slate-400
const labelDark = '#cbd5e1'; // slate-300

export const Colors = {
  light: {
    text: '#0f172a',
    background: backgroundLight,
    tint: primary,
    icon: textSecondaryLight,
    tabIconDefault: textSecondaryLight,
    tabIconSelected: primary,
    border: '#e2e8f0',
    card: '#ffffff',
    surface: '#ffffff',
    surfaceMuted: '#f1f5f9',
    primary,
    primarySoft: accentBlue,
    textSecondary: textSecondaryLight,
    inputBg: '#ffffff',
    surfaceCard: '#ffffff',
    surfaceInput: '#f1f5f9',
  },
  dark: {
    text: '#ffffff',
    background: backgroundDark,
    tint: primary,
    icon: textSecondaryDark,
    tabIconDefault: textSecondaryDark,
    tabIconSelected: primary,
    border: borderDark,
    card: inputDark,
    surface: backgroundDark,
    surfaceMuted: inputDark,
    primary,
    primarySoft: accentBlue,
    textSecondary: textSecondaryDark,
    label: labelDark,
    inputBg: inputDark,
    borderDivider: borderDarkDivider,
    /** Mockup danh sách sự kiện: thẻ trận đấu */
    surfaceCard: '#1c252e',
    /** Mockup danh sách sự kiện: ô search, chip, kèo */
    surfaceInput: '#283039',
  },
};

/** Palette thống nhất cho toàn app (bám mockup dark): background #101922, surface #1c252e, primary #137fec. */
export const AppPalette = {
  background: backgroundDark,
  surfaceCard: '#1c252e',
  surfaceInput: '#283039',
  text: '#ffffff',
  textSecondary: '#9dabb9',
  primary: primary,
  border: 'rgba(255,255,255,0.05)',
  borderStrong: 'rgba(255,255,255,0.1)',
  headerBorder: 'rgba(40,48,57,0.3)',
  scoreBoxBg: 'rgba(40,48,57,0.5)',
  primarySoft: 'rgba(19,127,236,0.1)',
  green: '#22c55e',
  greenSoft: 'rgba(34,197,94,0.1)',
  red: '#ef4444',
  redSoft: 'rgba(239,68,68,0.1)',
  graySoft: 'rgba(255,255,255,0.05)',
  orange: '#f97316',
  yellow: '#eab308',
  /** Tab bar (bottom nav) – khớp mockup */
  tabBarBackground: '#1c252e',
  tabBarBorder: 'rgba(255,255,255,0.05)',
  tabBarActive: primary,
  tabBarInactive: '#9dabb9',
  /** Login card/input khi dùng dark */
  inputDark: inputDark,
  labelDark: labelDark,
  borderDivider: borderDarkDivider,
} as const;

// Global API base URL for the mobile app.
// On physical devices, replace "localhost" with the machine IP (e.g. http://192.168.x.x:2308).
export const API_BASE = 'http://localhost:2308';

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
