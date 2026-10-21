/**
 * DataTableWidget
 * Compact inline data table rendered in chat messages
 */

import React from 'react';
import {
  Box,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { DataTableWidgetData } from '../../../types/aiChat';

interface DataTableWidgetProps {
  data: DataTableWidgetData;
  onRowClick?: (row: Record<string, any>) => void;
}

function formatDate(value: any): string {
  if (!value) return '-';
  const d = new Date(value);
  return isNaN(d.getTime()) ? String(value) : d.toLocaleDateString();
}

function formatCurrency(value: any): string {
  if (value == null) return '-';
  const num = typeof value === 'number' ? value : parseFloat(value);
  if (isNaN(num)) return String(value);
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(num);
}

const cellSx = {
  fontSize: '0.75rem',
  py: 0.75,
  px: 1,
  borderColor: '#f5f5f5',
  color: 'text.primary',
};

const DataTableWidget: React.FC<DataTableWidgetProps> = ({ data, onRowClick }) => {
  const { columns, rows, title } = data;

  if (!rows || rows.length === 0) return null;

  return (
    <Box sx={{ mt: 1 }}>
      {title && (
        <Typography variant="caption" fontWeight={600} color="#171717" sx={{ mb: 0.5, display: 'block' }}>
          {title}
        </Typography>
      )}
      <TableContainer sx={{ maxHeight: 200, borderWidth: 1, borderStyle: 'solid', borderColor: 'divider', borderRadius: 1 }}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              {columns.map((col) => (
                <TableCell
                  key={col.key}
                  sx={{
                    ...cellSx,
                    fontWeight: 600,
                    bgcolor: 'background.default',
                    color: 'text.disabled',
                    fontSize: '0.7rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.03em',
                  }}
                >
                  {col.label}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row, rowIdx) => (
              <TableRow
                key={rowIdx}
                hover={!!onRowClick}
                onClick={() => onRowClick?.(row)}
                sx={{
                  cursor: onRowClick ? 'pointer' : 'default',
                  '&:last-child td': { borderBottom: 0 },
                }}
              >
                {columns.map((col) => (
                  <TableCell key={col.key} sx={cellSx}>
                    <CellValue type={col.type} value={row[col.key]} />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

const CellValue: React.FC<{ type?: string; value: any }> = ({ type, value }) => {
  switch (type) {
    case 'chip':
      return <Chip label={String(value ?? '')} size="small" sx={{ height: 20, fontSize: '0.65rem' }} />;
    case 'date':
      return <>{formatDate(value)}</>;
    case 'currency':
      return <>{formatCurrency(value)}</>;
    default:
      return <>{value != null ? String(value) : '-'}</>;
  }
};

export default DataTableWidget;
