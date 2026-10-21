import React, { useState } from 'react';
import {
  Paper,
  TextField,
  Button,
  Box,
  Typography,
  CircularProgress,
  InputAdornment,
  IconButton,
  Divider,
  Chip,
} from '@mui/material';
import { Search, TrendingUp, PersonAdd, Delete } from '@mui/icons-material';

interface Attendee {
  name: string;
  email: string;
  role: string;
}

interface CompanySearchFormProps {
  onSearch: (companyName: string, purposeOfMeeting: string, meetingContext: string, attendees: Attendee[]) => void;
  loading: boolean;
  onNewSearch?: () => void;
}

const CompanySearchForm: React.FC<CompanySearchFormProps> = ({ onSearch, loading }) => {
  const [companyName, setCompanyName] = useState('');
  const [purposeOfMeeting, setPurposeOfMeeting] = useState('');
  const [meetingContext, setMeetingContext] = useState('');
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [currentAttendee, setCurrentAttendee] = useState<Attendee>({
    name: '',
    email: '',
    role: ''
  });

  const handleAddAttendee = () => {
    if (currentAttendee.name.trim() && currentAttendee.email.trim()) {
      setAttendees([...attendees, currentAttendee]);
      setCurrentAttendee({ name: '', email: '', role: '' });
    }
  };

  const handleRemoveAttendee = (index: number) => {
    setAttendees(attendees.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (companyName.trim()) {
      onSearch(
        companyName.trim(),
        purposeOfMeeting.trim() || 'General business discussion',
        meetingContext.trim(),
        attendees
      );
    }
  };

  return (
    <Paper
      elevation={3}
      sx={{
        p: 4,
        background: 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)',
        borderRadius: 3,
      }}
    >
      <Box sx={{ textAlign: 'center', mb: 3 }}>
        <TrendingUp sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
        <Typography variant="h5" gutterBottom sx={{ color: 'text.primary', fontWeight: 'bold' }}>
          Company Intelligence Research
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Enter a company name to generate comprehensive sales intelligence including market analysis,
          case study recommendations, and strategic insights.
        </Typography>
      </Box>

      <form onSubmit={handleSubmit}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            fullWidth
            label="Company Name"
            variant="outlined"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            placeholder="e.g., Microsoft, Apple, Tesla"
            disabled={loading}
            required
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search color="action" />
                </InputAdornment>
              ),
            }}
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: 2,
              },
            }}
          />

          <TextField
            fullWidth
            label="Purpose of Meeting"
            variant="outlined"
            value={purposeOfMeeting}
            onChange={(e) => setPurposeOfMeeting(e.target.value)}
            placeholder="e.g., Discuss digital transformation opportunities"
            disabled={loading}
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: 2,
              },
            }}
          />

          <TextField
            fullWidth
            label="Meeting Context (Optional)"
            variant="outlined"
            multiline
            rows={3}
            value={meetingContext}
            onChange={(e) => setMeetingContext(e.target.value)}
            placeholder="e.g., Focus on AI/ML advancements, CRM integrations, cloud migration, etc."
            disabled={loading}
            helperText="Add specific topics you want to discuss during the meeting"
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: 2,
              },
            }}
          />

          <Divider sx={{ my: 2 }}>
            <Typography variant="caption" sx={{ color: 'text.secondary', px: 2 }}>
              Meeting Attendees (Optional)
            </Typography>
          </Divider>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, p: 2, bgcolor: 'grey.50', borderRadius: 2 }}>
            <Typography variant="body2" color="text.secondary">
              Add attendees to research their backgrounds and generate personalized engagement strategies
            </Typography>

            <Box sx={{ display: 'flex', gap: 1 }}>
              <TextField
                size="small"
                label="Name"
                value={currentAttendee.name}
                onChange={(e) => setCurrentAttendee({ ...currentAttendee, name: e.target.value })}
                placeholder="John Doe"
                disabled={loading}
                sx={{ flex: 2 }}
              />
              <TextField
                size="small"
                label="Email"
                type="email"
                value={currentAttendee.email}
                onChange={(e) => setCurrentAttendee({ ...currentAttendee, email: e.target.value })}
                placeholder="john@company.com"
                disabled={loading}
                sx={{ flex: 2 }}
              />
              <TextField
                size="small"
                label="Role"
                value={currentAttendee.role}
                onChange={(e) => setCurrentAttendee({ ...currentAttendee, role: e.target.value })}
                placeholder="CTO"
                disabled={loading}
                sx={{ flex: 1 }}
              />
              <IconButton
                color="primary"
                onClick={handleAddAttendee}
                disabled={loading || !currentAttendee.name.trim() || !currentAttendee.email.trim()}
                sx={{
                  bgcolor: 'primary.main',
                  color: 'white',
                  '&:hover': { bgcolor: 'primary.dark' },
                  '&:disabled': { bgcolor: 'grey.300' }
                }}
              >
                <PersonAdd />
              </IconButton>
            </Box>

            {attendees.length > 0 && (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
                {attendees.map((attendee, index) => (
                  <Chip
                    key={index}
                    label={`${attendee.name} (${attendee.role || 'Role not specified'})`}
                    onDelete={() => handleRemoveAttendee(index)}
                    deleteIcon={<Delete />}
                    sx={{
                      bgcolor: 'background.paper',
                      border: 1,
                      borderColor: 'primary.main',
                      '& .MuiChip-deleteIcon': {
                        color: 'error.main',
                        '&:hover': { color: 'error.dark' }
                      }
                    }}
                  />
                ))}
              </Box>
            )}
          </Box>

          <Button
            type="submit"
            variant="contained"
            size="large"
            disabled={loading || !companyName.trim()}
            sx={{
              height: 56,
              borderRadius: 2,
              background: 'linear-gradient(45deg, #1976d2 30%, #42a5f5 90%)',
              '&:hover': {
                background: 'linear-gradient(45deg, #1565c0 30%, #2196f3 90%)',
              },
            }}
          >
            {loading ? (
              <CircularProgress size={24} sx={{ color: 'white' }} />
            ) : (
              'Analyze'
            )}
          </Button>
        </Box>
      </form>
    </Paper>
  );
};

export default CompanySearchForm;