// src/utils/theme.ts
// Central design tokens — colours, spacing, typography
// All text uses Times New Roman (timesNewRoman) font family

export const COLORS = {
  green: '#2D6A4F',
  greenLight: '#40916C',
  greenPale: '#D8F3DC',
  orange: '#F4721B',
  orangeLight: '#FFB347',
  cream: '#FFF8EE',
  dark: '#1B1B1B',
  gray: '#6B7280',
  grayLight: '#F3F4F6',
  white: '#FFFFFF',
  red: '#DC2626',
  redLight: '#FEE2E2',
  border: '#E5E7EB',
};

// Times New Roman font family name as loaded via expo-font
// We use the built-in system Times New Roman on both platforms.
// On Android: 'serif' maps to Times/Times New Roman
// On iOS: 'TimesNewRomanPSMT' is the exact PostScript name
// We expose a helper so every Text component uses it consistently.
import { Platform } from 'react-native';

export const TNR = Platform.select({
  ios: 'TimesNewRomanPSMT',
  android: 'serif',
  default: 'serif',
}) as string;

export const TNR_BOLD = Platform.select({
  ios: 'TimesNewRomanPS-BoldMT',
  android: 'serif',
  default: 'serif',
}) as string;

export const TNR_ITALIC = Platform.select({
  ios: 'TimesNewRomanPS-ItalicMT',
  android: 'serif',
  default: 'serif',
}) as string;

// Font style helpers — all use Times New Roman
export const FONTS = {
  regular:   { fontFamily: TNR,      fontWeight: '400' as const },
  medium:    { fontFamily: TNR,      fontWeight: '500' as const },
  semiBold:  { fontFamily: TNR,      fontWeight: '600' as const },
  bold:      { fontFamily: TNR_BOLD, fontWeight: '700' as const },
  extraBold: { fontFamily: TNR_BOLD, fontWeight: '800' as const },
  italic:    { fontFamily: TNR_ITALIC, fontStyle: 'italic' as const },
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
};

export const RADIUS = {
  sm: 8,
  md: 12,
  lg: 16,
  full: 999,
};

export const SHADOW = {
  small: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  medium: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.10,
    shadowRadius: 8,
    elevation: 4,
  },
};
