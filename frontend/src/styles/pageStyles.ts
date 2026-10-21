/**
 * Shared page styles - Clean, minimal design system
 * Dark-mode aware via MUI theme palette references.
 */
import { alpha, SxProps, Theme } from '@mui/material/styles';
import { getColors } from '../theme/colorTokens';

// Backward-compatible static export (light mode defaults)
export const COLORS = {
  ...getColors('light'),
  // Legacy aliases
  primary: '#1a1a2e',
  primaryLight: '#3d3d5c',
  primaryDark: '#0f0f1a',
  secondary: '#1a1a2e',
  secondaryLight: '#3d3d5c',
  slate50: '#fafafa',
  slate100: '#f5f5f5',
  slate200: '#e5e5e5',
  slate300: '#d4d4d4',
  slate400: '#a3a3a3',
  slate500: '#737373',
  slate600: '#525252',
  slate700: '#404040',
  slate800: '#262626',
  slate900: '#171717',
  purple: '#6366f1',
  pink: '#ec4899',
  gradient: '#171717',
};

/**
 * Hook-like helper: call inside a component to get mode-aware colors.
 * Usage: const c = usePageColors();
 */
export { getColors } from '../theme/colorTokens';
export type { ColorTokens } from '../theme/colorTokens';

// Page header - simple, clean
export const pageHeaderStyles: SxProps<Theme> = {
  mb: 3,
};

export const pageHeaderPatternStyles: SxProps<Theme> = {
  display: 'none',
};

export const pageHeaderIconBoxStyles = (): SxProps<Theme> => ({
  width: 40,
  height: 40,
  borderRadius: 1,
  bgcolor: 'action.hover',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  '& svg': { color: 'text.secondary' },
});

// Card styles - flat, bordered
export const modernCardStyles: SxProps<Theme> = {
  borderRadius: 2,
  border: 1,
  borderColor: 'divider',
  boxShadow: 'none',
  bgcolor: 'background.paper',
  transition: 'border-color 0.15s',
  '&:hover': {
    borderColor: 'action.disabled',
  },
};

export const flatCardStyles: SxProps<Theme> = {
  borderRadius: 2,
  border: 1,
  borderColor: 'divider',
  boxShadow: 'none',
  bgcolor: 'background.paper',
};

export const gradientCardStyles = (): SxProps<Theme> => ({
  borderRadius: 2,
  bgcolor: 'background.paper',
  border: 1,
  borderColor: 'divider',
});

// Stat cards - clean, no gradients
export const statCardStyles = (): SxProps<Theme> => ({
  borderRadius: 2,
  height: '100%',
  bgcolor: 'background.paper',
  border: 1,
  borderColor: 'divider',
  transition: 'border-color 0.15s',
  '&:hover': {
    borderColor: 'action.disabled',
  },
});

export const metricIconBoxStyles = (color: string): SxProps<Theme> => ({
  width: 36,
  height: 36,
  borderRadius: 1,
  bgcolor: alpha(color, 0.1),
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  '& svg': { fontSize: 18, color },
});

// Button styles - flat, no transforms
export const primaryButtonStyles: SxProps<Theme> = {
  bgcolor: 'primary.main',
  color: 'primary.contrastText',
  px: 3,
  py: 1,
  fontWeight: 500,
  borderRadius: 1.5,
  boxShadow: 'none',
  '&:hover': {
    bgcolor: 'primary.dark',
    boxShadow: 'none',
  },
};

export const outlinedButtonStyles = (color?: string): SxProps<Theme> => ({
  borderColor: 'divider',
  color: color || 'text.secondary',
  fontWeight: 500,
  borderRadius: 1.5,
  '&:hover': {
    borderColor: 'action.disabled',
    bgcolor: 'action.hover',
  },
});

// Input styles
export const modernInputStyles: SxProps<Theme> = {
  '& .MuiOutlinedInput-root': {
    borderRadius: 1.5,
    bgcolor: 'background.paper',
    '& fieldset': { borderColor: 'divider' },
    '&:hover fieldset': { borderColor: 'action.disabled' },
    '&.Mui-focused fieldset': { borderColor: 'secondary.main' },
  },
};

// Sidebar styles
export const sidebarStyles: SxProps<Theme> = {
  width: 240,
  flexShrink: 0,
  borderRight: 1,
  borderColor: 'divider',
  display: 'flex',
  flexDirection: 'column',
  bgcolor: 'background.paper',
};

export const sidebarItemStyles = (isSelected: boolean): SxProps<Theme> => ({
  py: 1,
  px: 1.5,
  borderRadius: 1,
  bgcolor: isSelected ? 'action.selected' : 'transparent',
  color: isSelected ? 'text.primary' : 'text.secondary',
  '&:hover': { bgcolor: 'action.hover' },
  transition: 'background-color 0.15s',
});

// Progress styles
export const progressBarStyles = (color: string): SxProps<Theme> => ({
  height: 4,
  borderRadius: 2,
  bgcolor: alpha(color, 0.15),
  '& .MuiLinearProgress-bar': {
    borderRadius: 2,
    bgcolor: color,
  },
});

export const statusChipStyles = (
  status: 'success' | 'warning' | 'error' | 'info' | 'neutral'
): SxProps<Theme> => {
  const colorMap = {
    success: COLORS.success,
    warning: COLORS.warning,
    error: COLORS.error,
    info: COLORS.info,
    neutral: COLORS.gray500,
  };
  const color = colorMap[status];
  return {
    bgcolor: alpha(color, 0.1),
    color: color,
    fontWeight: 500,
    borderRadius: 1,
  };
};

// Table styles
export const tableHeaderStyles: SxProps<Theme> = {
  bgcolor: 'action.hover',
  '& th': {
    fontWeight: 600,
    color: 'text.secondary',
    borderBottom: 1,
    borderColor: 'divider',
    fontSize: '0.75rem',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
};

export const tableRowHoverStyles: SxProps<Theme> = {
  cursor: 'pointer',
  '&:hover': {
    bgcolor: 'action.hover',
  },
};

// Alert styles
export const alertBannerStyles = (
  type: 'success' | 'warning' | 'error' | 'info'
): SxProps<Theme> => {
  const colorMap = {
    success: COLORS.success,
    warning: COLORS.warning,
    error: COLORS.error,
    info: COLORS.info,
  };
  const bgMap = {
    success: COLORS.successLight,
    warning: COLORS.warningLight,
    error: COLORS.errorLight,
    info: COLORS.infoLight,
  };
  return {
    p: 2,
    borderRadius: 1.5,
    bgcolor: bgMap[type],
    border: `1px solid ${alpha(colorMap[type], 0.2)}`,
  };
};

// Section title
export const sectionTitleStyles: SxProps<Theme> = {
  fontWeight: 600,
  color: 'text.primary',
  fontSize: '0.875rem',
  mb: 2,
};

// Avatar styles
export const avatarStyles = (size: 'small' | 'medium' | 'large' = 'medium'): SxProps<Theme> => {
  const sizes = {
    small: { width: 28, height: 28, fontSize: '0.75rem' },
    medium: { width: 36, height: 36, fontSize: '0.875rem' },
    large: { width: 48, height: 48, fontSize: '1rem' },
  };
  return {
    ...sizes[size],
    bgcolor: 'action.selected',
    color: 'text.secondary',
    fontWeight: 500,
  };
};

// Tab styles
export const modernTabsStyles: SxProps<Theme> = {
  '& .MuiTab-root': {
    fontWeight: 500,
    textTransform: 'none',
    minHeight: 44,
    color: 'text.disabled',
    '&.Mui-selected': {
      color: 'text.primary',
    },
  },
  '& .MuiTabs-indicator': {
    height: 2,
    bgcolor: 'text.primary',
  },
};

// Empty state
export const emptyStateStyles: SxProps<Theme> = {
  py: 6,
  textAlign: 'center',
  bgcolor: 'action.hover',
  borderRadius: 2,
  border: '1px dashed',
  borderColor: 'divider',
};

// Upload zone
export const uploadZoneStyles = (isDragOver: boolean, hasFile: boolean): SxProps<Theme> => ({
  p: 3,
  borderRadius: 2,
  border: '1px dashed',
  borderColor: hasFile ? 'success.main' : isDragOver ? 'secondary.main' : 'divider',
  bgcolor: hasFile
    ? alpha(COLORS.success, 0.05)
    : isDragOver
    ? alpha(COLORS.accent, 0.05)
    : 'action.hover',
  cursor: hasFile ? 'default' : 'pointer',
  transition: 'border-color 0.15s, background-color 0.15s',
  '&:hover': !hasFile
    ? {
        borderColor: 'action.disabled',
      }
    : {},
});

// Score color helper
export const getScoreColor = (score: number): string => {
  if (score >= 70) return COLORS.success;
  if (score >= 40) return COLORS.warning;
  return COLORS.error;
};

// Consistent spacing scale
export const spacing = {
  page: { px: { xs: 2, md: 3 }, py: 3 },
  section: { p: 2 },
  card: { p: 2 },
  header: { mb: 3 },
};

// Media queries
export const breakpoints = {
  mobile: '@media (max-width: 600px)',
  tablet: '@media (max-width: 960px)',
  desktop: '@media (min-width: 960px)',
};

export default COLORS;
