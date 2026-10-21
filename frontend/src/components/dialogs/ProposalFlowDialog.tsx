import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  Checkbox,
  Stack,
  Step,
  StepLabel,
  Stepper,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import ResponsiveGrid from '../layout/ResponsiveGrid';
import { useEffect, useMemo, useState } from 'react';
import { AppShellContextValue, ProposalFlowPayload } from '../../context/AppShellContext';
import {
  accounts,
  findAccount,
  findPostCall,
  postCallAnalyses,
  proposalOutlineSections,
} from '../../data/pipelineData';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import SlideshowIcon from '@mui/icons-material/Slideshow';

interface ProposalFlowDialogProps {
  open: boolean;
  payload?: ProposalFlowPayload | null;
  onClose: () => void;
  notify?: AppShellContextValue['showMessage'];
}

interface OutlineSectionState {
  id: string;
  title: string;
  description: string;
  include: boolean;
  notes: string;
}

const steps = ['Select inputs', 'Outline', 'Result'];

const ProposalFlowDialog = ({ open, payload, onClose, notify }: ProposalFlowDialogProps) => {
  const [activeStep, setActiveStep] = useState(0);
  const [proposalName, setProposalName] = useState('');
  const [solutionAreas, setSolutionAreas] = useState('AI Copilot, Automation, Managed Services');
  const [selectedAnalysisId, setSelectedAnalysisId] = useState<string | undefined>(undefined);
  const [additionalAnalyses, setAdditionalAnalyses] = useState<string[]>([]);
  const [outlineSections, setOutlineSections] = useState<OutlineSectionState[]>([]);

  const account = useMemo(
    () => findAccount(payload?.accountId) ?? accounts[0],
    [payload?.accountId]
  );

  const selectedAnalysis = useMemo(
    () => findPostCall(selectedAnalysisId) ?? account?.postCallAnalyses[0],
    [selectedAnalysisId, account?.postCallAnalyses]
  );

  useEffect(() => {
    setOutlineSections(
      proposalOutlineSections.map((section) => ({
        ...section,
        include: section.recommended,
        notes: '',
      }))
    );
  }, []);

  useEffect(() => {
    if (!open) {
      setTimeout(() => {
        setActiveStep(0);
        setProposalName('');
        setSolutionAreas('AI Copilot, Automation, Managed Services');
        setSelectedAnalysisId(payload?.analysisId);
        setAdditionalAnalyses([]);
      }, 200);
      return;
    }

    setSelectedAnalysisId(payload?.analysisId ?? account?.postCallAnalyses[0]?.id);
    setProposalName(
      payload?.accountId && account
        ? `${account.name} Pursuit Proposal`
        : 'Strategic Pursuit Proposal'
    );
  }, [open, payload?.analysisId, payload?.accountId, account]);

  const handleToggleSection = (sectionId: string) => {
    setOutlineSections((prev) =>
      prev.map((section) =>
        section.id === sectionId ? { ...section, include: !section.include } : section
      )
    );
  };

  const handleSectionNotes = (sectionId: string, value: string) => {
    setOutlineSections((prev) =>
      prev.map((section) => (section.id === sectionId ? { ...section, notes: value } : section))
    );
  };

  const handleGenerate = () => {
    setActiveStep(2);
    notify?.({
      type: 'success',
      message: 'Proposal and deck will be ready in under a minute.',
    });
  };

  const handleAddAnalysis = (analysisId: string) => {
    setAdditionalAnalyses((prev) =>
      prev.includes(analysisId) ? prev.filter((id) => id !== analysisId) : [...prev, analysisId]
    );
  };

  const outlinePreview = outlineSections.filter((section) => section.include);

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle
        sx={{
          borderBottom: '1px solid',
          borderColor: 'divider',
          pb: 2,
        }}
      >
        Proposal & Deck Generator
        <Typography variant="body2" color="text.secondary">
          Auto-build proposals from Post-Call insights and research context.
        </Typography>
      </DialogTitle>
      <DialogContent sx={{ pt: 3 }}>
        <Stepper activeStep={activeStep} alternativeLabel sx={{ mb: 4 }}>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        {activeStep === 0 && (
          <ResponsiveGrid container spacing={3}>
            <ResponsiveGrid xs={12} md={6}>
              <Box
                sx={{
                  p: 3,
                  borderRadius: 2,
                  border: 1,
                  borderColor: 'divider',
                  bgcolor: 'background.paper',
                }}
              >
                <Typography variant="subtitle2" color="text.secondary">
                  Account
                </Typography>
                <Typography variant="h6">{account?.name}</Typography>
                <Typography variant="body2" color="text.secondary">
                  Owner: {account?.owner} · Industry: {account?.industry}
                </Typography>
                {selectedAnalysis && (
                  <Alert severity="info" sx={{ mt: 2 }}>
                    Using Post-Call: {selectedAnalysis.meetingTitle} ({selectedAnalysis.date})
                  </Alert>
                )}
                <TextField
                  fullWidth
                  label="Proposal name"
                  sx={{ mt: 3 }}
                  value={proposalName}
                  onChange={(event) => setProposalName(event.target.value)}
                />
                <TextField
                  fullWidth
                  label="Solution areas / product lines"
                  sx={{ mt: 2 }}
                  value={solutionAreas}
                  onChange={(event) => setSolutionAreas(event.target.value)}
                />
              </Box>
            </ResponsiveGrid>
            <ResponsiveGrid xs={12} md={6}>
              <Box
                sx={{
                  p: 3,
                  borderRadius: 2,
                  border: 1,
                  borderColor: 'divider',
                  bgcolor: 'background.paper',
                }}
              >
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Select Post-Call analyses
                </Typography>
                <ToggleButtonGroup
                  value={selectedAnalysisId}
                  exclusive
                  onChange={(_event, value) => value && setSelectedAnalysisId(value)}
                  fullWidth
                  sx={{ mb: 2, flexWrap: 'wrap', gap: 1 }}
                >
                  {(account?.postCallAnalyses ?? postCallAnalyses).map((analysis) => (
                    <ToggleButton key={analysis.id} value={analysis.id} sx={{ flex: '1 1 45%' }}>
                      <Box>
                        <Typography variant="body2">{analysis.meetingTitle}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {analysis.date}
                        </Typography>
                      </Box>
                    </ToggleButton>
                  ))}
                </ToggleButtonGroup>
                <Divider sx={{ my: 2 }} />
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Include additional analyses
                </Typography>
                <Stack spacing={1.5}>
                  {postCallAnalyses.map((analysis) => (
                    <FormControlLabel
                      key={analysis.id}
                      control={
                        <Checkbox
                          checked={
                            additionalAnalyses.includes(analysis.id) ||
                            analysis.id === selectedAnalysisId
                          }
                          onChange={() => handleAddAnalysis(analysis.id)}
                          disabled={analysis.id === selectedAnalysisId}
                        />
                      }
                      label={
                        <Box>
                          <Typography variant="body2">{analysis.meetingTitle}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            {analysis.accountName} · {analysis.date}
                          </Typography>
                        </Box>
                      }
                    />
                  ))}
                </Stack>
              </Box>
            </ResponsiveGrid>
            <ResponsiveGrid xs={12} display="flex" justifyContent="flex-end">
              <Button variant="contained" onClick={() => setActiveStep(1)}>
                Next: Outline
              </Button>
            </ResponsiveGrid>
          </ResponsiveGrid>
        )}

        {activeStep === 1 && (
          <Box>
            <Typography variant="subtitle1" gutterBottom>
              Auto-generated outline
            </Typography>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Toggle sections to include/exclude and add context for the generator.
            </Typography>
            <ResponsiveGrid container spacing={2} sx={{ mt: 1 }}>
              {outlineSections.map((section) => (
                <ResponsiveGrid xs={12} md={6} key={section.id}>
                  <Box
                    sx={{
                      p: 2.5,
                      borderRadius: 2,
                      border: 1,
                      borderColor: section.include ? 'primary.main' : 'divider',
                      bgcolor: section.include ? 'rgba(59,130,246,0.08)' : 'background.paper',
                    }}
                  >
                    <Stack direction="row" alignItems="center" justifyContent="space-between">
                      <Box>
                        <Typography variant="subtitle2">{section.title}</Typography>
                        <Typography variant="body2" color="text.secondary">
                          {section.description}
                        </Typography>
                      </Box>
                      <Chip
                        label={section.include ? 'Included' : 'Excluded'}
                        color={section.include ? 'primary' : 'default'}
                        size="small"
                        onClick={() => handleToggleSection(section.id)}
                      />
                    </Stack>
                    {section.include && (
                      <TextField
                        multiline
                        minRows={2}
                        fullWidth
                        placeholder="Optional notes for this section"
                        value={section.notes}
                        onChange={(event) => handleSectionNotes(section.id, event.target.value)}
                        sx={{ mt: 2 }}
                      />
                    )}
                  </Box>
                </ResponsiveGrid>
              ))}
            </ResponsiveGrid>
            <Stack direction="row" justifyContent="space-between" sx={{ mt: 3 }}>
              <Button onClick={() => setActiveStep(0)}>Back</Button>
              <Button variant="contained" onClick={handleGenerate}>
                Generate solution proposal & deck
              </Button>
            </Stack>
          </Box>
        )}

        {activeStep === 2 && (
          <Box
            sx={{
              textAlign: 'center',
              py: 6,
            }}
          >
            <Typography variant="h5" gutterBottom>
              Proposal ready to share
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
              Content stored for 30 days. Links open in a secure viewer.
            </Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="center">
              <Button
                variant="contained"
                startIcon={<PictureAsPdfIcon />}
                onClick={() =>
                  notify?.({
                    type: 'info',
                    message: 'Downloading proposal doc...',
                  })
                }
              >
                Download proposal document
              </Button>
              <Button
                variant="outlined"
                startIcon={<SlideshowIcon />}
                onClick={() =>
                  notify?.({
                    type: 'info',
                    message: 'Deck download starting...',
                  })
                }
              >
                Download deck
              </Button>
            </Stack>
            <Chip
              label="Also saved in Account Hub"
              color="primary"
              variant="outlined"
              sx={{ mt: 3 }}
            />
            <Button sx={{ mt: 4 }} onClick={onClose}>
              Close
            </Button>
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ProposalFlowDialog;
