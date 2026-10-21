import React, { useState, useMemo } from 'react';
import {
  Box,
  Paper,
  Typography,
  Stack,
  Card,
  CardContent,
  Chip,
  Button,
  Alert,
  Collapse,
  IconButton,
  Tooltip,
  LinearProgress,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  AccountTree,
  AutoAwesome,
  TrendingUp,
  Lightbulb,
  CheckCircle,
  Warning,
  PlayArrow,
  ExpandMore,
  ExpandLess,
  Close,
  QuestionAnswer,
  AttachMoney,
  Timeline,
  CloudQueue,
  Storage,
  Support,
  School,
} from '@mui/icons-material';
import SalesPlaybookWizard from './SalesPlaybookWizard';
import {
  OutcomeType,
  getOutcomeDetails,
  getServiceValueEstimate,
} from '../types/atlassianDecisionFlow';

interface DealPlaybookAutomationProps {
  dealId: string;
  companyName: string;
  dealStage: string;
  dealValue?: number;
  products?: string[];
  deploymentType?: 'cloud' | 'datacenter' | 'server' | 'hybrid' | 'unknown';
  renewalDate?: Date;
  onRecommendationApplied?: (recommendation: PlaybookRecommendation) => void;
}

interface PlaybookRecommendation {
  type: OutcomeType;
  title: string;
  description: string;
  services: string[];
  talkingPoints: string[];
  estimatedValue: string;
  urgency: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
  reason: string;
}

/**
 * Auto-suggests playbook recommendations based on deal data
 */
const generateAutoRecommendation = (
  dealStage: string,
  deploymentType: string,
  products: string[],
  renewalDate?: Date
): PlaybookRecommendation | null => {
  const lowerStage = dealStage.toLowerCase();
  const hasAtlassian = products?.some(p =>
    ['jira', 'confluence', 'jsm', 'bitbucket', 'atlassian'].some(a => p.toLowerCase().includes(a))
  );

  // Calculate days to renewal
  const daysToRenewal = renewalDate
    ? Math.ceil((renewalDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  // Auto-suggest based on deal stage and deployment type
  if (hasAtlassian || true) { // Always show for Atlassian-relevant deals
    // Renewal urgency scenarios
    if (daysToRenewal !== null && daysToRenewal < 90 && deploymentType === 'datacenter') {
      return {
        type: 'cloud_migration_assessment',
        title: 'Urgent Cloud Migration Assessment',
        description: 'DC license renewal approaching - perfect time to discuss Cloud migration',
        services: ['Cloud Migration Assessment', 'Expedited Migration Planning', 'Temporary DC Renewal'],
        talkingPoints: [
          `License renewal in ${daysToRenewal} days - key decision point`,
          'Cloud eliminates future upgrade projects and infrastructure costs',
          'We can complete assessment in 2 weeks and migration in 4-8 weeks',
        ],
        estimatedValue: '$25,000 - $50,000',
        urgency: daysToRenewal < 30 ? 'critical' : 'high',
        confidence: 85,
        reason: `DC renewal in ${daysToRenewal} days is a prime opportunity for cloud migration discussion`,
      };
    }

    // Early stage - discovery
    if (lowerStage.includes('prospect') || lowerStage.includes('discovery') || lowerStage.includes('qualification')) {
      if (deploymentType === 'datacenter' || deploymentType === 'server') {
        return {
          type: 'cloud_migration_assessment',
          title: 'Cloud Readiness Assessment',
          description: 'Assess the customer\'s readiness for Cloud migration',
          services: ['Cloud Readiness Assessment', 'Environment Analysis', 'Migration Complexity Report'],
          talkingPoints: [
            'Start with a no-commitment assessment to understand their environment',
            'Identify apps, customizations, and potential migration challenges',
            'Provide clear migration plan with timeline and cost estimates',
          ],
          estimatedValue: '$15,000 - $25,000',
          urgency: 'medium',
          confidence: 70,
          reason: 'Early stage DC/Server customer - perfect for cloud assessment lead-in',
        };
      } else if (deploymentType === 'cloud') {
        return {
          type: 'training_engagement',
          title: 'Training & Expansion Discovery',
          description: 'Identify training needs and expansion opportunities',
          services: ['Training Needs Assessment', 'User Adoption Review', 'Expansion Planning'],
          talkingPoints: [
            'Understand how they\'re using Cloud today',
            'Identify adoption challenges and training gaps',
            'Look for product expansion opportunities (JSM, Confluence, etc.)',
          ],
          estimatedValue: '$10,000 - $20,000',
          urgency: 'low',
          confidence: 60,
          reason: 'Cloud customer in discovery - focus on adoption and expansion',
        };
      }
    }

    // Mid-stage - solution design
    if (lowerStage.includes('solution') || lowerStage.includes('proposal') || lowerStage.includes('demo')) {
      return {
        type: 'strategic_consulting',
        title: 'Solution Design & Proposal',
        description: 'Design comprehensive solution based on validated requirements',
        services: ['Solution Architecture', 'Implementation Planning', 'ROI Analysis'],
        talkingPoints: [
          'Present tailored solution addressing specific pain points',
          'Include clear implementation roadmap with milestones',
          'Demonstrate ROI with relevant case studies',
        ],
        estimatedValue: getServiceValueEstimate(['Solution Architecture', 'Implementation Planning']),
        urgency: 'high',
        confidence: 75,
        reason: 'Solution stage - time to present compelling proposal',
      };
    }

    // Negotiation stage
    if (lowerStage.includes('negotiat') || lowerStage.includes('contract')) {
      return {
        type: 'strategic_consulting',
        title: 'Deal Closing Strategy',
        description: 'Navigate final objections and close the deal',
        services: ['Contract Negotiation Support', 'Implementation Quick-Start', 'Success Planning'],
        talkingPoints: [
          'Address final concerns with specific evidence',
          'Offer implementation quick-start to accelerate time-to-value',
          'Include success metrics and governance plan',
        ],
        estimatedValue: 'Variable based on deal size',
        urgency: 'high',
        confidence: 80,
        reason: 'Negotiation stage - focus on closing and value delivery',
      };
    }
  }

  return null;
};

const DealPlaybookAutomation: React.FC<DealPlaybookAutomationProps> = ({
  dealId,
  companyName,
  dealStage,
  dealValue,
  products = [],
  deploymentType = 'unknown',
  renewalDate,
  onRecommendationApplied,
}) => {
  const [expanded, setExpanded] = useState(false);
  const [showPlaybook, setShowPlaybook] = useState(false);
  const [recommendationApplied, setRecommendationApplied] = useState(false);

  // Auto-generate recommendation based on deal data
  const recommendation = useMemo(() =>
    generateAutoRecommendation(dealStage, deploymentType, products, renewalDate),
    [dealStage, deploymentType, products, renewalDate]
  );

  if (!recommendation) {
    return null; // No recommendation for this deal
  }

  const handleApplyRecommendation = () => {
    setRecommendationApplied(true);
    if (onRecommendationApplied) {
      onRecommendationApplied(recommendation);
    }
  };

  const handleOpenPlaybook = () => {
    setShowPlaybook(true);
  };

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'critical': return 'error';
      case 'high': return 'warning';
      case 'medium': return 'info';
      default: return 'default';
    }
  };

  const getServiceIcon = (service: string) => {
    const lowerService = service.toLowerCase();
    if (lowerService.includes('cloud') || lowerService.includes('migration')) return <CloudQueue />;
    if (lowerService.includes('managed') || lowerService.includes('support')) return <Support />;
    if (lowerService.includes('training')) return <School />;
    if (lowerService.includes('dc') || lowerService.includes('data center')) return <Storage />;
    return <AutoAwesome />;
  };

  return (
    <>
      <Paper
        elevation={0}
        sx={{
          border: '1px solid rgba(0, 164, 140, 0.3)',
          borderRadius: 2,
          overflow: 'hidden',
          bgcolor: 'rgba(0, 164, 140, 0.03)',
        }}
      >
        {/* Header */}
        <Box
          onClick={() => setExpanded(!expanded)}
          sx={{
            p: 2,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            '&:hover': {
              bgcolor: 'rgba(0, 164, 140, 0.05)',
            },
          }}
        >
          <Stack direction="row" spacing={2} alignItems="center">
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                bgcolor: 'rgba(0, 164, 140, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#00A48C',
              }}
            >
              <AutoAwesome />
            </Box>
            <Box>
              <Stack direction="row" spacing={1} alignItems="center">
                <Typography variant="subtitle1" fontWeight={600} sx={{ color: 'text.primary' }}>
                  AI Playbook Suggestion
                </Typography>
                <Chip
                  label={`${recommendation.confidence}% match`}
                  size="small"
                  sx={{
                    height: 20,
                    fontSize: '0.7rem',
                    bgcolor: 'rgba(0, 164, 140, 0.1)',
                    color: '#00A48C',
                  }}
                />
              </Stack>
              <Typography variant="body2" color="text.secondary">
                {recommendation.title}
              </Typography>
            </Box>
          </Stack>
          <Stack direction="row" spacing={1} alignItems="center">
            <Chip
              label={recommendation.urgency}
              size="small"
              color={getUrgencyColor(recommendation.urgency) as any}
            />
            {expanded ? <ExpandLess /> : <ExpandMore />}
          </Stack>
        </Box>

        {/* Expanded Content */}
        <Collapse in={expanded}>
          <Box sx={{ p: 2, pt: 0 }}>
            <Divider sx={{ mb: 2 }} />

            {/* Reason for suggestion */}
            <Alert
              severity="info"
              icon={<Lightbulb />}
              sx={{ mb: 2, borderRadius: 1.5 }}
            >
              <Typography variant="body2">
                <strong>Why this recommendation:</strong> {recommendation.reason}
              </Typography>
            </Alert>

            {/* Services */}
            <Typography variant="subtitle2" sx={{ mb: 1, color: 'text.primary' }}>
              Recommended Services
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 2 }}>
              {recommendation.services.map((service, idx) => (
                <Chip
                  key={idx}
                  icon={getServiceIcon(service)}
                  label={service}
                  size="small"
                  variant="outlined"
                  sx={{ borderColor: '#00A48C', color: '#00A48C' }}
                />
              ))}
            </Stack>

            {/* Estimated Value */}
            <Card variant="outlined" sx={{ mb: 2, borderRadius: 1.5 }}>
              <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                <Stack direction="row" alignItems="center" justifyContent="space-between">
                  <Stack direction="row" spacing={1} alignItems="center">
                    <AttachMoney sx={{ color: 'success.main' }} />
                    <Typography variant="body2">Estimated Engagement Value</Typography>
                  </Stack>
                  <Typography variant="h6" color="success.main" fontWeight={600}>
                    {recommendation.estimatedValue}
                  </Typography>
                </Stack>
              </CardContent>
            </Card>

            {/* Talking Points */}
            <Typography variant="subtitle2" sx={{ mb: 1, color: 'text.primary' }}>
              Key Talking Points
            </Typography>
            <Stack spacing={0.5} sx={{ mb: 3 }}>
              {recommendation.talkingPoints.map((point, idx) => (
                <Stack key={idx} direction="row" spacing={1} alignItems="flex-start">
                  <QuestionAnswer sx={{ fontSize: 16, color: '#00A48C', mt: 0.25 }} />
                  <Typography variant="body2">{point}</Typography>
                </Stack>
              ))}
            </Stack>

            {/* Action Buttons */}
            <Stack direction="row" spacing={2}>
              <Button
                variant="outlined"
                startIcon={<AccountTree />}
                onClick={handleOpenPlaybook}
                sx={{ borderColor: '#00A48C', color: '#00A48C' }}
              >
                Open Sales Playbook
              </Button>
              <Button
                variant="contained"
                startIcon={recommendationApplied ? <CheckCircle /> : <PlayArrow />}
                onClick={handleApplyRecommendation}
                disabled={recommendationApplied}
                sx={{ bgcolor: '#00A48C', '&:hover': { bgcolor: '#008770' } }}
              >
                {recommendationApplied ? 'Applied to Deal' : 'Apply Recommendation'}
              </Button>
            </Stack>
          </Box>
        </Collapse>
      </Paper>

      {/* Playbook Dialog */}
      <Dialog
        open={showPlaybook}
        onClose={() => setShowPlaybook(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Stack direction="row" spacing={1} alignItems="center">
              <AccountTree sx={{ color: '#00A48C' }} />
              <Typography variant="h6">Atlassian Sales Playbook</Typography>
            </Stack>
            <IconButton size="small" onClick={() => setShowPlaybook(false)}>
              <Close />
            </IconButton>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <SalesPlaybookWizard
            companyName={companyName}
            dealId={dealId}
            onComplete={(outcome) => {
              setShowPlaybook(false);
              if (onRecommendationApplied) {
                onRecommendationApplied({
                  ...recommendation,
                  ...outcome,
                });
              }
            }}
            embedded
          />
        </DialogContent>
      </Dialog>
    </>
  );
};

export default DealPlaybookAutomation;
