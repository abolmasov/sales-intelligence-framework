import { createTheme, Theme } from '@mui/material/styles';
import { getColors } from './colorTokens';

/**
 * Professional Theme Factory
 * Creates an MUI theme for the given mode ('light' | 'dark').
 */
export function createAppTheme(mode: 'light' | 'dark'): Theme {
  const c = getColors(mode);
  const isDark = mode === 'dark';

  return createTheme({
    palette: {
      mode,
      primary: {
        main: isDark ? '#e5e5e5' : '#1a1a2e',
        light: isDark ? '#a3a3a3' : '#3d3d5c',
        dark: isDark ? '#fafafa' : '#171717',
        contrastText: isDark ? '#0a0a0f' : '#ffffff',
      },
      secondary: {
        main: c.accent,
        light: c.accentLight,
        dark: isDark ? '#2563eb' : '#0052a3',
        contrastText: '#ffffff',
      },
      background: {
        default: c.bg,
        paper: c.bgPaper,
      },
      text: {
        primary: c.text,
        secondary: c.textSecondary,
        disabled: c.textMuted,
      },
      divider: c.divider,
      success: { main: c.success, light: c.successLight },
      warning: { main: c.warning, light: c.warningLight },
      error: { main: c.error, light: c.errorLight },
      info: { main: c.info, light: c.infoLight },
    },
    typography: {
      fontFamily:
        '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      h1: { fontSize: '2rem', fontWeight: 600, letterSpacing: '-0.025em', lineHeight: 1.2 },
      h2: { fontSize: '1.5rem', fontWeight: 600, letterSpacing: '-0.02em', lineHeight: 1.3 },
      h3: { fontSize: '1.25rem', fontWeight: 600, letterSpacing: '-0.015em', lineHeight: 1.4 },
      h4: { fontSize: '1.125rem', fontWeight: 600, lineHeight: 1.4 },
      h5: { fontSize: '1rem', fontWeight: 600, lineHeight: 1.5 },
      h6: { fontSize: '0.875rem', fontWeight: 600, lineHeight: 1.5 },
      body1: { fontSize: '0.9375rem', lineHeight: 1.6 },
      body2: { fontSize: '0.875rem', lineHeight: 1.5 },
      caption: { fontSize: '0.75rem', lineHeight: 1.5, color: c.textMuted },
      button: { textTransform: 'none' as const, fontWeight: 500, fontSize: '0.875rem' },
    },
    shape: { borderRadius: 6 },
    shadows: [
      'none',
      isDark ? '0 1px 2px 0 rgb(0 0 0 / 0.3)' : '0 1px 2px 0 rgb(0 0 0 / 0.05)',
      isDark ? '0 1px 3px 0 rgb(0 0 0 / 0.4)' : '0 1px 3px 0 rgb(0 0 0 / 0.1)',
      isDark ? '0 4px 6px -1px rgb(0 0 0 / 0.4)' : '0 4px 6px -1px rgb(0 0 0 / 0.1)',
      isDark ? '0 10px 15px -3px rgb(0 0 0 / 0.4)' : '0 10px 15px -3px rgb(0 0 0 / 0.1)',
      isDark ? '0 20px 25px -5px rgb(0 0 0 / 0.4)' : '0 20px 25px -5px rgb(0 0 0 / 0.1)',
      isDark ? '0 25px 50px -12px rgb(0 0 0 / 0.5)' : '0 25px 50px -12px rgb(0 0 0 / 0.25)',
      ...(Array(18).fill(
        isDark ? '0 10px 15px -3px rgb(0 0 0 / 0.4)' : '0 10px 15px -3px rgb(0 0 0 / 0.1)'
      ) as string[]),
    ] as Theme['shadows'],
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            backgroundColor: c.bg,
            color: c.text,
            transition: 'background-color 0.2s ease, color 0.2s ease',
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: 6,
            padding: '8px 16px',
            boxShadow: 'none',
            '&:hover': { boxShadow: 'none' },
          },
          contained: {
            '&:hover': {
              boxShadow: isDark
                ? '0 1px 3px 0 rgb(0 0 0 / 0.4)'
                : '0 1px 3px 0 rgb(0 0 0 / 0.1)',
            },
          },
          containedPrimary: {
            backgroundColor: isDark ? '#e5e5e5' : '#1a1a2e',
            color: isDark ? '#0a0a0f' : '#ffffff',
            '&:hover': {
              backgroundColor: isDark ? '#d4d4d4' : '#262626',
            },
          },
          containedSecondary: {
            backgroundColor: c.accent,
            '&:hover': { backgroundColor: isDark ? '#2563eb' : '#0052a3' },
          },
          outlined: {
            borderColor: c.border,
            '&:hover': { borderColor: c.borderHover, backgroundColor: c.bgSubtle },
          },
          text: {
            '&:hover': { backgroundColor: c.bgSubtle },
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: { backgroundImage: 'none' },
          elevation1: {
            boxShadow: isDark
              ? '0 1px 3px 0 rgb(0 0 0 / 0.4), 0 1px 2px -1px rgb(0 0 0 / 0.4)'
              : '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            boxShadow: isDark
              ? '0 1px 3px 0 rgb(0 0 0 / 0.4)'
              : '0 1px 3px 0 rgb(0 0 0 / 0.1)',
            border: `1px solid ${c.border}`,
            backgroundColor: c.bgPaper,
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: { fontWeight: 500, borderRadius: 6 },
        },
      },
      MuiTextField: {
        styleOverrides: {
          root: {
            '& .MuiOutlinedInput-root': {
              borderRadius: 6,
              '& fieldset': { borderColor: c.border },
              '&:hover fieldset': { borderColor: c.borderHover },
            },
          },
        },
      },
      MuiDialog: {
        styleOverrides: {
          paper: { borderRadius: 8, backgroundColor: c.bgElevated },
        },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: { borderRadius: 0, backgroundColor: c.bgPaper },
        },
      },
      MuiAppBar: {
        styleOverrides: {
          root: {
            boxShadow: 'none',
            borderBottom: `1px solid ${c.border}`,
            backgroundColor: c.bgPaper,
          },
        },
      },
      MuiTableCell: {
        styleOverrides: {
          root: { borderBottom: `1px solid ${c.border}` },
          head: { fontWeight: 600, backgroundColor: c.bgSubtle },
        },
      },
      MuiFab: {
        styleOverrides: {
          root: {
            boxShadow: isDark
              ? '0 4px 6px -1px rgb(0 0 0 / 0.4)'
              : '0 4px 6px -1px rgb(0 0 0 / 0.1)',
            '&:hover': {
              boxShadow: isDark
                ? '0 10px 15px -3px rgb(0 0 0 / 0.4)'
                : '0 10px 15px -3px rgb(0 0 0 / 0.1)',
            },
          },
        },
      },
      MuiMenu: {
        styleOverrides: {
          paper: { backgroundColor: c.bgElevated, border: `1px solid ${c.border}` },
        },
      },
      MuiPopover: {
        styleOverrides: {
          paper: { backgroundColor: c.bgElevated },
        },
      },
      MuiTooltip: {
        styleOverrides: {
          tooltip: {
            backgroundColor: isDark ? '#2a2a35' : '#171717',
            color: isDark ? '#e5e5e5' : '#ffffff',
          },
        },
      },
      MuiDivider: {
        styleOverrides: {
          root: { borderColor: c.divider },
        },
      },
      MuiListItemButton: {
        styleOverrides: {
          root: {
            '&:hover': { backgroundColor: c.bgSubtle },
            '&.Mui-selected': { backgroundColor: c.bgSubtle },
          },
        },
      },
      MuiSwitch: {
        styleOverrides: {
          switchBase: {
            '&.Mui-checked': { color: c.accent },
            '&.Mui-checked + .MuiSwitch-track': { backgroundColor: c.accent },
          },
        },
      },
      MuiTab: {
        styleOverrides: {
          root: {
            textTransform: 'none' as const,
            fontWeight: 500,
            color: c.textMuted,
            '&.Mui-selected': { color: c.text },
          },
        },
      },
      MuiTabs: {
        styleOverrides: {
          indicator: { backgroundColor: c.text },
        },
      },
      MuiAlert: {
        styleOverrides: {
          root: { borderRadius: 6 },
        },
      },
      MuiSkeleton: {
        styleOverrides: {
          root: { backgroundColor: isDark ? '#1c1c24' : '#e5e5e5' },
        },
      },
      MuiLinearProgress: {
        styleOverrides: {
          root: { backgroundColor: isDark ? '#2a2a35' : '#e5e5e5' },
        },
      },
    },
  });
}

// Backward-compatible default export
export const professionalTheme = createAppTheme('light');

// Backward-compatible colors export (light mode defaults)
export const colors = getColors('light');
