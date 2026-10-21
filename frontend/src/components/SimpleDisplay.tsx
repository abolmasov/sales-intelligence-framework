import React from 'react';
import {
  Box,
  Typography,
  Paper,
  Chip,
  Card,
  CardContent,
  Avatar,
  Link,
  Alert,
} from '@mui/material';
import {
  TrendingUp,
  Business,
  People,
  Assignment,
  Warning,
  Lightbulb,
  Star,
  Launch,
  Description,
  InsertDriveFile,
} from '@mui/icons-material';
import { SalesIntelligenceData } from '../types';

interface SimpleDisplayProps {
  data: SalesIntelligenceData;
}

const SimpleDisplay: React.FC<SimpleDisplayProps> = ({ data }) => {
  return (
    <Box>
      {/* Header */}
      <Paper
        elevation={2}
        sx={{
          p: 3,
          mb: 3,
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
          borderRadius: 3,
        }}
      >
        <Typography variant="h4" gutterBottom sx={{ fontWeight: 'bold' }}>
          {data.companyName} Intelligence Report
        </Typography>
        <Typography variant="h6" sx={{ opacity: 0.9 }}>
          {data.executiveSummary}
        </Typography>
      </Paper>

      {/* Main Content in Flex Layout */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>

        {/* InternalKnowledge Documents and Leadership Row */}
        <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
          <Card sx={{ flex: 1, minWidth: 300, borderRadius: 2 }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Description sx={{ color: 'primary.main', mr: 1 }} />
                <Typography variant="h6" fontWeight="bold">
                  Relevant Client Information from InternalKnowledge
                </Typography>
              </Box>
              {data.sharepointDocuments && data.sharepointDocuments.length > 0 ? (
                <Box>
                  {data.sharepointDocuments.map((doc, index) => (
                    <Box key={doc.id} sx={{ mb: 2, pb: 2, borderBottom: index < data.sharepointDocuments!.length - 1 ? '1px solid #eee' : 'none' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                        <InsertDriveFile sx={{ color: 'primary.main', mr: 1, fontSize: 20 }} />
                        <Link href={doc.webUrl} target="_blank" sx={{ fontWeight: 'bold', display: 'flex', alignItems: 'center' }}>
                          {doc.name}
                          <Launch sx={{ ml: 0.5, fontSize: 16 }} />
                        </Link>
                      </Box>
                      {doc.relevanceScore && (
                        <Chip
                          label={`${Math.round(doc.relevanceScore * 100 / 3)}% relevance`}
                          size="small"
                          color="primary"
                          variant="outlined"
                          sx={{ mb: 1 }}
                        />
                      )}
                      <Typography variant="caption" color="text.secondary" display="block">
                        Path: {doc.path}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" display="block">
                        Modified: {new Date(doc.lastModifiedDateTime).toLocaleDateString()}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              ) : (
                <Alert severity="info" sx={{ borderRadius: 2 }}>
                  No relevant client documents found in InternalKnowledge for this company. InternalKnowledge integration may not be configured or no matching documents exist.
                </Alert>
              )}
            </CardContent>
          </Card>

          <Card sx={{ flex: 1, minWidth: 300, borderRadius: 2 }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <People sx={{ color: 'primary.main', mr: 1 }} />
                <Typography variant="h6" fontWeight="bold">
                  Leadership & Organization
                </Typography>
              </Box>
              <Typography variant="body1">{data.leadershipOrganization}</Typography>
            </CardContent>
          </Card>
        </Box>

        {/* Strategic and Market Row */}
        <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
          <Card sx={{ flex: 1, minWidth: 300, borderRadius: 2 }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Assignment sx={{ color: 'primary.main', mr: 1 }} />
                <Typography variant="h6" fontWeight="bold">
                  Strategic Initiatives
                </Typography>
              </Box>
              <Typography variant="body1">{data.strategicInitiatives}</Typography>
            </CardContent>
          </Card>

          <Card sx={{ flex: 1, minWidth: 300, borderRadius: 2 }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Business sx={{ color: 'primary.main', mr: 1 }} />
                <Typography variant="h6" fontWeight="bold">
                  Market Position
                </Typography>
              </Box>
              <Typography variant="body1">{data.marketPosition}</Typography>
            </CardContent>
          </Card>
        </Box>

        {/* Sales Opportunities */}
        <Card sx={{ borderRadius: 2, border: '2px solid', borderColor: 'success.main' }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <Lightbulb sx={{ color: 'success.main', mr: 1 }} />
              <Typography variant="h6" fontWeight="bold" color="success.main">
                Sales Opportunities
              </Typography>
            </Box>
            <Typography variant="body1">{data.salesOpportunities}</Typography>
            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                Recommended Approach:
              </Typography>
              <Alert severity="info" sx={{ borderRadius: 2 }}>
                {data.recommendedApproach}
              </Alert>
            </Box>
          </CardContent>
        </Card>

        {/* Challenges and Risks Row */}
        <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
          <Card sx={{ flex: 1, minWidth: 300, borderRadius: 2 }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Warning sx={{ color: 'warning.main', mr: 1 }} />
                <Typography variant="h6" fontWeight="bold">
                  Challenges & Pain Points
                </Typography>
              </Box>
              <Typography variant="body1">{data.challengesPainPoints}</Typography>
            </CardContent>
          </Card>

          <Card sx={{ flex: 1, minWidth: 300, borderRadius: 2 }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Warning sx={{ color: 'error.main', mr: 1 }} />
                <Typography variant="h6" fontWeight="bold">
                  Risk Factors
                </Typography>
              </Box>
              <Typography variant="body1">{data.riskFactors}</Typography>
            </CardContent>
          </Card>
        </Box>

        {/* Key Stakeholders */}
        <Card sx={{ borderRadius: 2 }}>
          <CardContent>
            <Typography variant="h6" fontWeight="bold" gutterBottom>
              Key Stakeholders
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              {data.keyStakeholders.map((stakeholder, index) => (
                <Paper
                  key={index}
                  sx={{
                    p: 2,
                    display: 'flex',
                    alignItems: 'center',
                    background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
                    borderRadius: 2,
                    minWidth: 250,
                  }}
                >
                  <Avatar sx={{ bgcolor: 'primary.main', mr: 2 }}>
                    {stakeholder.name.charAt(0)}
                  </Avatar>
                  <Box>
                    <Typography variant="subtitle1" fontWeight="bold">
                      {stakeholder.name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {stakeholder.title}
                    </Typography>
                    <Typography variant="caption" color="primary">
                      {stakeholder.focusArea}
                    </Typography>
                  </Box>
                </Paper>
              ))}
            </Box>
          </CardContent>
        </Card>

        {/* Case Studies Row */}
        <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
          {/* Northstar Integrators Case Studies */}
          <Card sx={{ flex: 1, minWidth: 400, borderRadius: 2 }}>
            <CardContent>
              <Typography variant="h6" fontWeight="bold" gutterBottom>
                Relevant Northstar Integrators Case Studies
              </Typography>
              {data.integratorCaseStudies.map((caseStudy, index) => (
                <Box key={index} sx={{ mb: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <Star sx={{ color: 'gold', mr: 1, fontSize: 16 }} />
                    <Chip
                      label={`${Math.round(caseStudy.relevanceScore)}% match`}
                      size="small"
                      color="primary"
                      variant="outlined"
                    />
                  </Box>
                  <Typography variant="subtitle2" fontWeight="bold">
                    {caseStudy.title}
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    {caseStudy.description}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1, mb: 1, flexWrap: 'wrap' }}>
                    {caseStudy.technologies.map((tech, techIndex) => (
                      <Chip key={techIndex} label={tech} size="small" />
                    ))}
                  </Box>
                  <Link href={caseStudy.url} target="_blank" sx={{ display: 'flex', alignItems: 'center' }}>
                    View Case Study <Launch sx={{ ml: 1, fontSize: 16 }} />
                  </Link>
                </Box>
              ))}
            </CardContent>
          </Card>

          {/* Northstar library Case Studies */}
          <Card sx={{ flex: 1, minWidth: 400, borderRadius: 2 }}>
            <CardContent>
              <Typography variant="h6" fontWeight="bold" gutterBottom>
                Relevant Northstar library Case Studies
              </Typography>
              {data.libraryCaseStudies.map((caseStudy, index) => (
                <Box key={index} sx={{ mb: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <Star sx={{ color: 'gold', mr: 1, fontSize: 16 }} />
                    <Chip
                      label={`${Math.round(caseStudy.relevanceScore)}% match`}
                      size="small"
                      color="secondary"
                      variant="outlined"
                    />
                  </Box>
                  <Typography variant="subtitle2" fontWeight="bold">
                    {caseStudy.title}
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    {caseStudy.description}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1, mb: 1, flexWrap: 'wrap' }}>
                    {caseStudy.technologies.map((tech, techIndex) => (
                      <Chip key={techIndex} label={tech} size="small" />
                    ))}
                  </Box>
                  <Link href={caseStudy.url} target="_blank" sx={{ display: 'flex', alignItems: 'center' }}>
                    View Case Study <Launch sx={{ ml: 1, fontSize: 16 }} />
                  </Link>
                </Box>
              ))}
            </CardContent>
          </Card>
        </Box>
      </Box>
    </Box>
  );
};

export default SimpleDisplay;
