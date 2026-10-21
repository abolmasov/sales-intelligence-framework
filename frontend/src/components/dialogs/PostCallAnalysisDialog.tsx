import {
  Box,
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import { useEffect, useRef, useState } from 'react';
import { PostCallFlowPayload } from '../../context/AppShellContext';
import { findAccount, findMeeting } from '../../data/pipelineData';

interface PostCallAnalysisDialogProps {
  open: boolean;
  payload?: PostCallFlowPayload | null;
  onClose: () => void;
  onRun?: (payload?: PostCallFlowPayload) => Promise<void> | void;
}

const PostCallAnalysisDialog = ({ open, payload, onClose, onRun }: PostCallAnalysisDialogProps) => {
  const [transcript, setTranscript] = useState('');
  const [analysisName, setAnalysisName] = useState('');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const account = findAccount(payload?.accountId);
  const meeting = findMeeting(payload?.meetingId);

  useEffect(() => {
    if (open) {
      setAnalysisName(
        meeting ? `${meeting.title} · ${meeting.date}` : 'Post-Call Analysis · Untitled'
      );
      setTranscript('');
      setUploadedFile(null);
    }
  }, [open, meeting]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setUploadedFile(file);
    }
  };

  const handleSubmit = () => {
    onRun?.({
      ...payload,
      meetingId: payload?.meetingId ?? meeting?.id,
      accountId: payload?.accountId ?? account?.id,
    });
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        Run Post-Call Analysis
        <Typography variant="body2" color="text.secondary">
          Paste or upload the transcript. The system enriches with CRM + research context.
        </Typography>
      </DialogTitle>
      <DialogContent dividers>
        <Box
          sx={{
            borderRadius: 2,
            border: 1,
            borderColor: 'divider',
            p: 2,
            mb: 3,
            bgcolor: 'background.paper',
          }}
        >
          <Typography variant="subtitle2" color="text.secondary">
            Context
          </Typography>
          <Typography variant="body1" fontWeight={600}>
            {account?.name ?? 'Unmapped account'}
          </Typography>
          {meeting ? (
            <Typography variant="body2" color="text.secondary">
              {meeting.title} · {meeting.date} · {meeting.start} - {meeting.end}
            </Typography>
          ) : (
            <Typography variant="body2" color="text.secondary">
              Manual upload – link to a calendar event to auto-fill metadata.
            </Typography>
          )}
        </Box>

        <Stack spacing={2.5}>
          <TextField
            label="Analysis name"
            fullWidth
            value={analysisName}
            onChange={(event) => setAnalysisName(event.target.value)}
          />
          <TextField
            multiline
            minRows={6}
            label="Transcript"
            placeholder="Paste Teams, Zoom, or Gong transcript..."
            value={transcript}
            onChange={(event) => setTranscript(event.target.value)}
          />
          <Box
            sx={{
              border: '1px dashed',
              borderColor: 'divider',
              borderRadius: 2,
              p: 3,
              textAlign: 'center',
              bgcolor: 'action.hover',
            }}
          >
            <input
              type="file"
              hidden
              ref={fileInputRef}
              accept=".txt,.docx,.pdf"
              onChange={handleFileChange}
            />
            <Button
              startIcon={<UploadFileIcon />}
              onClick={() => fileInputRef.current?.click()}
              variant="outlined"
            >
              {uploadedFile ? uploadedFile.name : 'Upload transcript file'}
            </Button>
            <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 1 }}>
              Supports TXT, DOCX, PDF. 30-day retention policy applies.
            </Typography>
          </Box>
        </Stack>
        <Stack direction="row" justifyContent="flex-end" spacing={2} sx={{ mt: 4 }}>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="contained" onClick={handleSubmit}>
            Run Post-Call Analysis
          </Button>
        </Stack>
      </DialogContent>
    </Dialog>
  );
};

export default PostCallAnalysisDialog;
