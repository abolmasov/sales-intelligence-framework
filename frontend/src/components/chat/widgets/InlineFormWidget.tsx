/**
 * InlineFormWidget
 * Compact inline form rendered in chat messages
 */

import React, { useState } from 'react';
import {
  Box, Button, Checkbox, FormControlLabel,
  MenuItem, Select, Stack, TextField, Typography,
} from '@mui/material';
import { InlineFormWidgetData, InlineFormField } from '../../../types/aiChat';

interface InlineFormWidgetProps {
  data: InlineFormWidgetData;
  onSubmit: (formId: string, values: Record<string, any>) => void;
  onCancel?: () => void;
}

const inputSx = {
  '& .MuiInputBase-root': { fontSize: '0.8125rem' },
  '& .MuiInputLabel-root': { fontSize: '0.8125rem' },
  bgcolor: 'background.paper',
};

const renderField = (
  field: InlineFormField,
  value: any,
  onChange: (name: string, val: any) => void,
) => {
  if (field.type === 'select') {
    return (
      <Box key={field.name}>
        <Typography variant="caption" color="#737373" sx={{ mb: 0.25, display: 'block' }}>
          {field.label}
        </Typography>
        <Select
          size="small" fullWidth displayEmpty value={value ?? ''}
          onChange={(e) => onChange(field.name, e.target.value)}
          required={field.required} sx={{ fontSize: '0.8125rem', bgcolor: 'background.paper' }}
        >
          {field.placeholder && (
            <MenuItem value="" disabled><em>{field.placeholder}</em></MenuItem>
          )}
          {field.options?.map((o) => (
            <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
          ))}
        </Select>
      </Box>
    );
  }
  if (field.type === 'checkbox') {
    return (
      <FormControlLabel
        key={field.name}
        control={
          <Checkbox size="small" checked={!!value} onChange={(e) => onChange(field.name, e.target.checked)} />
        }
        label={<Typography variant="body2" fontSize="0.8125rem">{field.label}</Typography>}
      />
    );
  }
  const isTextarea = field.type === 'textarea';
  return (
    <TextField
      key={field.name} label={field.label} size="small" fullWidth
      type={field.type === 'number' ? 'number' : 'text'}
      multiline={isTextarea} minRows={isTextarea ? 2 : undefined} maxRows={isTextarea ? 4 : undefined}
      value={value ?? ''} onChange={(e) => onChange(field.name, e.target.value)}
      required={field.required} placeholder={field.placeholder} sx={inputSx}
    />
  );
};

const InlineFormWidget: React.FC<InlineFormWidgetProps> = ({ data, onSubmit, onCancel }) => {
  const { formId, fields, submitLabel = 'Submit', cancelLabel = 'Cancel' } = data;

  const [values, setValues] = useState<Record<string, any>>(() => {
    const d: Record<string, any> = {};
    fields.forEach((f) => { d[f.name] = f.defaultValue ?? (f.type === 'checkbox' ? false : ''); });
    return d;
  });

  const handleChange = (name: string, val: any) => setValues((p) => ({ ...p, [name]: val }));

  return (
    <Box
      component="form"
      onSubmit={(e: React.FormEvent) => { e.preventDefault(); onSubmit(formId, values); }}
      sx={{ mt: 1, p: 1.5, borderWidth: 1, borderStyle: 'solid', borderColor: 'divider', borderRadius: 1, bgcolor: 'background.default' }}
    >
      <Stack spacing={1.5}>
        {fields.map((f) => renderField(f, values[f.name], handleChange))}
        <Stack direction="row" spacing={1} justifyContent="flex-end">
          {onCancel && (
            <Button size="small" onClick={onCancel}
              sx={{ textTransform: 'none', color: 'text.disabled', fontSize: '0.8125rem' }}>
              {cancelLabel}
            </Button>
          )}
          <Button type="submit" size="small" variant="contained"
            sx={{ textTransform: 'none', bgcolor: 'text.primary', fontSize: '0.8125rem',
              boxShadow: 'none', '&:hover': { bgcolor: '#262626', boxShadow: 'none' } }}>
            {submitLabel}
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
};

export default InlineFormWidget;
