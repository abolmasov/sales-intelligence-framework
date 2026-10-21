import {
  Box,
  Button,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Paper,
  Stack,
  Typography,
  Fade,
  alpha,
} from '@mui/material';
import ResponsiveGrid from '../components/layout/ResponsiveGrid';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import FeedbackIcon from '@mui/icons-material/Feedback';
import CloudSyncIcon from '@mui/icons-material/CloudSync';
import ShieldIcon from '@mui/icons-material/Shield';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import { COLORS } from '../styles/pageStyles';

const HelpSettingsPage = () => {
  return (
    <Fade in timeout={400}>
      <Box sx={{ px: { xs: 2, md: 4 }, py: 4 }}>
        {/* Hero Header */}
        <Paper
          elevation={0}
          sx={{
            p: 4,
            mb: 4,
            borderRadius: 4,
            background: COLORS.gradient,
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              right: 0,
              width: '50%',
              height: '100%',
              opacity: 0.1,
              background: 'radial-gradient(circle at 50% 50%, white 0%, transparent 70%)',
            }}
          />
          <Stack direction="row" spacing={3} alignItems="center">
            <Box
              sx={{
                width: 64,
                height: 64,
                borderRadius: 3,
                bgcolor: alpha('#fff', 0.15),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <HelpOutlineIcon sx={{ fontSize: 32, color: 'white' }} />
            </Box>
            <Box>
              <Typography variant="h4" sx={{ color: 'white', fontWeight: 700, mb: 0.5 }}>
                Help & Settings
              </Typography>
              <Typography variant="body1" sx={{ color: alpha('#fff', 0.85) }}>
                Manage integrations, review retention policy, and understand how the AI system works
              </Typography>
            </Box>
          </Stack>
        </Paper>

        <ResponsiveGrid container spacing={3}>
          <ResponsiveGrid xs={12} md={6}>
            <Paper
              elevation={0}
              sx={{
                p: 3,
                borderRadius: 3,
                border: 1,
                borderColor: alpha(COLORS.secondary, 0.08),
                height: '100%',
                transition: 'all 0.2s',
                '&:hover': {
                  boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
                },
              }}
            >
              <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                <Stack direction="row" spacing={2} alignItems="center">
                  <Box
                    sx={{
                      width: 48,
                      height: 48,
                      borderRadius: 2,
                      bgcolor: alpha(COLORS.success, 0.1),
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <CloudSyncIcon sx={{ fontSize: 24, color: COLORS.success }} />
                  </Box>
                  <Box>
                    <Typography variant="h6" sx={{ fontWeight: 700, color: COLORS.secondary }}>
                      Calendar & Email Integration
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Connect Outlook or Google Workspace to auto-sync meetings
                    </Typography>
                  </Box>
                </Stack>
                <ChipWithIcon label="Connected" icon={<CheckCircleIcon sx={{ color: COLORS.success }} />} />
              </Stack>
              <Stack direction="row" spacing={1.5} sx={{ mt: 3 }}>
                <Button
                  variant="contained"
                  sx={{
                    background: COLORS.gradient,
                    fontWeight: 600,
                    borderRadius: 2,
                    boxShadow: `0 4px 16px ${alpha(COLORS.primary, 0.3)}`,
                  }}
                >
                  Manage connection
                </Button>
                <Button
                  variant="text"
                  sx={{ color: 'text.secondary', fontWeight: 600 }}
                >
                  Troubleshoot
                </Button>
              </Stack>
            </Paper>
          </ResponsiveGrid>

          <ResponsiveGrid xs={12} md={6}>
            <Paper
              elevation={0}
              sx={{
                p: 3,
                borderRadius: 3,
                border: 1,
                borderColor: alpha(COLORS.secondary, 0.08),
                height: '100%',
                transition: 'all 0.2s',
                '&:hover': {
                  boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
                },
              }}
            >
              <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
                <Box
                  sx={{
                    width: 48,
                    height: 48,
                    borderRadius: 2,
                    bgcolor: alpha(COLORS.info, 0.1),
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <ShieldIcon sx={{ fontSize: 24, color: COLORS.info }} />
                </Box>
                <Typography variant="h6" sx={{ fontWeight: 700, color: COLORS.secondary }}>
                  Data & Retention
                </Typography>
              </Stack>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Generated research, transcripts, and proposals are retained for 30 days. Export to SharePoint or CRM to keep records longer.
              </Typography>
              <Stack direction="row" spacing={1.5}>
                <Button
                  variant="outlined"
                  startIcon={<CloudSyncIcon />}
                  sx={{
                    borderColor: COLORS.primary,
                    color: COLORS.primary,
                    fontWeight: 600,
                    borderRadius: 2,
                    '&:hover': {
                      borderColor: COLORS.primary,
                      bgcolor: alpha(COLORS.primary, 0.08),
                    },
                  }}
                >
                  Export guidance
                </Button>
                <Button
                  variant="text"
                  startIcon={<ShieldIcon />}
                  sx={{ color: 'text.secondary', fontWeight: 600 }}
                >
                  Security overview
                </Button>
              </Stack>
            </Paper>
          </ResponsiveGrid>

          <ResponsiveGrid xs={12} md={6}>
            <Card
              elevation={0}
              sx={{
                borderRadius: 3,
                border: 1,
                borderColor: alpha(COLORS.secondary, 0.08),
                height: '100%',
                transition: 'all 0.2s',
                '&:hover': {
                  boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
                },
              }}
            >
              <CardContent sx={{ p: 3 }}>
                <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
                  <Box
                    sx={{
                      width: 48,
                      height: 48,
                      borderRadius: 2,
                      bgcolor: alpha(COLORS.purple, 0.1),
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <InfoOutlinedIcon sx={{ fontSize: 24, color: COLORS.purple }} />
                  </Box>
                  <Typography variant="h6" sx={{ fontWeight: 700, color: COLORS.secondary }}>
                    How the AI Works
                  </Typography>
                </Stack>
                <List dense sx={{ '& .MuiListItem-root': { px: 0 } }}>
                  <ListItem>
                    <ListItemIcon sx={{ minWidth: 40 }}>
                      <InfoOutlinedIcon sx={{ color: COLORS.primary }} />
                    </ListItemIcon>
                    <ListItemText
                      primary={<Typography variant="body2" sx={{ fontWeight: 600, color: COLORS.secondary }}>Signals ingested</Typography>}
                      secondary="Calendar metadata, CRM context, transcript uploads, internal knowledge base."
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemIcon sx={{ minWidth: 40 }}>
                      <InfoOutlinedIcon sx={{ color: COLORS.primary }} />
                    </ListItemIcon>
                    <ListItemText
                      primary={<Typography variant="body2" sx={{ fontWeight: 600, color: COLORS.secondary }}>Processing</Typography>}
                      secondary="Normalization layer → Retrieval augmented generation → Safety checker."
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemIcon sx={{ minWidth: 40 }}>
                      <InfoOutlinedIcon sx={{ color: COLORS.primary }} />
                    </ListItemIcon>
                    <ListItemText
                      primary={<Typography variant="body2" sx={{ fontWeight: 600, color: COLORS.secondary }}>Outputs</Typography>}
                      secondary="Pre-call brief, post-call pursuit brief, proposal, exec deck."
                    />
                  </ListItem>
                </List>
              </CardContent>
            </Card>
          </ResponsiveGrid>

          <ResponsiveGrid xs={12} md={6}>
            <Card
              elevation={0}
              sx={{
                borderRadius: 3,
                border: 1,
                borderColor: alpha(COLORS.secondary, 0.08),
                height: '100%',
                transition: 'all 0.2s',
                '&:hover': {
                  boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
                },
              }}
            >
              <CardContent sx={{ p: 3 }}>
                <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
                  <Box
                    sx={{
                      width: 48,
                      height: 48,
                      borderRadius: 2,
                      bgcolor: alpha(COLORS.warning, 0.1),
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <FeedbackIcon sx={{ fontSize: 24, color: COLORS.warning }} />
                  </Box>
                  <Typography variant="h6" sx={{ fontWeight: 700, color: COLORS.secondary }}>
                    Feedback
                  </Typography>
                </Stack>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                  Share product feedback, report an issue, or request a dataset refresh.
                </Typography>
                <Stack direction="row" spacing={1.5}>
                  <Button
                    variant="contained"
                    startIcon={<FeedbackIcon />}
                    sx={{
                      background: COLORS.gradient,
                      fontWeight: 600,
                      borderRadius: 2,
                      boxShadow: `0 4px 16px ${alpha(COLORS.primary, 0.3)}`,
                    }}
                  >
                    Send feedback
                  </Button>
                  <Button
                    variant="text"
                    sx={{ color: 'text.secondary', fontWeight: 600 }}
                  >
                    View release notes
                  </Button>
                </Stack>
              </CardContent>
            </Card>
          </ResponsiveGrid>
        </ResponsiveGrid>
      </Box>
    </Fade>
  );
};

const ChipWithIcon = ({ label, icon }: { label: string; icon: React.ReactNode }) => (
  <Stack
    direction="row"
    spacing={0.5}
    alignItems="center"
    sx={{
      px: 1.5,
      py: 0.5,
      borderRadius: 2,
      bgcolor: alpha(COLORS.success, 0.1),
    }}
  >
    {icon}
    <Typography variant="body2" sx={{ fontWeight: 600, color: COLORS.success }}>
      {label}
    </Typography>
  </Stack>
);

export default HelpSettingsPage;
