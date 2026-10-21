/**
 * Color Token System for Light / Dark mode.
 *
 * Every color used across the app should come from here.
 * Components access tokens via MUI theme palette or `getColors(mode)`.
 */

export interface ColorTokens {
  // Backgrounds
  bg: string;
  bgPaper: string;
  bgElevated: string;
  bgSubtle: string;

  // Text
  text: string;
  textSecondary: string;
  textMuted: string;

  // Borders
  border: string;
  borderHover: string;
  divider: string;

  // Brand / Accent
  primary: string;
  primaryLight: string;
  accent: string;
  accentLight: string;

  // Semantic
  success: string;
  successLight: string;
  warning: string;
  warningLight: string;
  error: string;
  errorLight: string;
  info: string;
  infoLight: string;

  // Neutral scale (for edge cases)
  gray50: string;
  gray100: string;
  gray200: string;
  gray300: string;
  gray400: string;
  gray500: string;
  gray600: string;
  gray700: string;
  gray800: string;
  gray900: string;

  // Misc
  white: string;
}

const lightColors: ColorTokens = {
  bg: '#fafafa',
  bgPaper: '#ffffff',
  bgElevated: '#ffffff',
  bgSubtle: '#f5f5f5',

  text: '#171717',
  textSecondary: '#525252',
  textMuted: '#737373',

  border: '#e5e5e5',
  borderHover: '#d4d4d4',
  divider: '#e5e5e5',

  primary: '#1a1a2e',
  primaryLight: '#3d3d5c',
  accent: '#0066cc',
  accentLight: '#e6f0ff',

  success: '#059669',
  successLight: '#ecfdf5',
  warning: '#d97706',
  warningLight: '#fffbeb',
  error: '#dc2626',
  errorLight: '#fef2f2',
  info: '#0284c7',
  infoLight: '#f0f9ff',

  gray50: '#fafafa',
  gray100: '#f5f5f5',
  gray200: '#e5e5e5',
  gray300: '#d4d4d4',
  gray400: '#a3a3a3',
  gray500: '#737373',
  gray600: '#525252',
  gray700: '#404040',
  gray800: '#262626',
  gray900: '#171717',

  white: '#ffffff',
};

const darkColors: ColorTokens = {
  bg: '#0a0a0f',
  bgPaper: '#141419',
  bgElevated: '#1c1c24',
  bgSubtle: '#111116',

  text: '#e5e5e5',
  textSecondary: '#a3a3a3',
  textMuted: '#737373',

  border: '#2a2a35',
  borderHover: '#3a3a48',
  divider: '#2a2a35',

  primary: '#e5e5e5',
  primaryLight: '#a3a3a3',
  accent: '#3b82f6',
  accentLight: '#1e3a5f',

  success: '#10b981',
  successLight: '#0d2d22',
  warning: '#f59e0b',
  warningLight: '#2d1f04',
  error: '#ef4444',
  errorLight: '#2d0f0f',
  info: '#3b82f6',
  infoLight: '#0f1d2d',

  gray50: '#111116',
  gray100: '#1c1c24',
  gray200: '#2a2a35',
  gray300: '#3a3a48',
  gray400: '#737373',
  gray500: '#a3a3a3',
  gray600: '#d4d4d4',
  gray700: '#e5e5e5',
  gray800: '#f5f5f5',
  gray900: '#fafafa',

  white: '#141419',
};

export function getColors(mode: 'light' | 'dark'): ColorTokens {
  return mode === 'dark' ? darkColors : lightColors;
}
