import Box, { BoxProps } from '@mui/material/Box';
import { useTheme } from '@mui/material/styles';
import { SxProps, Theme } from '@mui/material';
import React from 'react';

type Breakpoint = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

interface ResponsiveGridProps extends BoxProps {
  container?: boolean;
  spacing?: number;
  xs?: number;
  sm?: number;
  md?: number;
  lg?: number;
  xl?: number;
}

const columns = 12;
const percent = (value?: number) =>
  typeof value === 'number' ? `${(value / columns) * 100}%` : undefined;

const buildItemSx = (
  theme: Theme,
  { xs, sm, md, lg, xl }: Pick<ResponsiveGridProps, Breakpoint>,
  gap: string
): Record<string, any> => {
  const calcWidth = (value?: number) => {
    const pct = percent(value);
    if (!pct) return undefined;
    if (!value || value >= columns || gap === '0px') return pct;
    return `calc(${pct} - ${gap})`;
  };

  const base = calcWidth(xs ?? 12) ?? '100%';
  const styles: Record<string, any> = {
    flexGrow: 1,
    flexBasis: base,
    maxWidth: base,
    minWidth: 0,
    width: base,
  };

  const apply = (bp: Breakpoint, value?: string) => {
    if (!value) return;
    styles[theme.breakpoints.up(bp)] = {
      flexBasis: value,
      maxWidth: value,
      width: value,
    };
  };

  apply('sm', calcWidth(sm));
  apply('md', calcWidth(md));
  apply('lg', calcWidth(lg));
  apply('xl', calcWidth(xl));

  return styles;
};

const ResponsiveGrid: React.FC<ResponsiveGridProps> = ({
  container,
  spacing = 2,
  xs,
  sm,
  md,
  lg,
  xl,
  sx,
  children,
  ...rest
}) => {
  const theme = useTheme();

  const spacingValue = theme.spacing(spacing);

  const containerStyles: SxProps<Theme> = {
    display: 'flex',
    flexWrap: 'wrap',
    gap: spacingValue,
  };

  const itemStyles = buildItemSx(theme, { xs, sm, md, lg, xl }, spacingValue);

  const composedSx: SxProps<Theme> = Array.isArray(sx)
    ? [container ? containerStyles : itemStyles, ...sx]
    : [container ? containerStyles : itemStyles, sx];

  return (
    <Box sx={composedSx} {...rest}>
      {children}
    </Box>
  );
};

export default ResponsiveGrid;
