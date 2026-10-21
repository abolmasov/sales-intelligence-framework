import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Chip,
} from '@mui/material';
import {
  ChevronRight,
  FiberManualRecord,
} from '@mui/icons-material';

// Easy to modify data structure
const atlassianData = {
  title: 'Atlassian Services',
  subtitle: 'Platinum Solution Partner | 6x Partner of the Year | 25+ Years Experience',
  children: [
    {
      title: 'Implementation & Deployment',
      color: 'secondary.main',
      children: [
        { title: 'Jira Software & Work Management' },
        { title: 'Confluence Spaces & Documentation' },
        { title: 'Jira Service Management (ITSM)' },
        { title: 'Bitbucket & Source Control' },
        { title: 'Jira Align (Enterprise Agile Planning)' },
        { title: 'Workflow Configuration & Automation' },
        { title: 'Process Optimization & Best Practices' },
      ],
    },
    {
      title: 'Migration Services',
      color: '#06b6d4',
      children: [
        { title: 'Cloud Migration (Server to Cloud)' },
        { title: 'Server to Data Center Upgrade' },
        { title: 'Instance Consolidation & Cleanup' },
        { title: 'Cross-platform Data Migration' },
        { title: 'Zero-downtime Migration Strategy' },
      ],
    },
    {
      title: 'Managed Services',
      color: 'success.main',
      children: [
        { title: 'Technical Administration & Maintenance' },
        { title: 'Functional Administration & Configuration' },
        { title: '24/7 Support & Monitoring' },
        { title: 'Performance Optimization' },
        { title: 'Capacity Planning & Scaling' },
        { title: 'Security & Compliance Management' },
      ],
    },
    {
      title: 'Support Services',
      color: 'warning.main',
      children: [
        { title: 'Emergency Support & Incident Response' },
        { title: 'Preventive Maintenance Programs' },
        { title: 'Advanced Troubleshooting' },
        { title: 'Health Checks & Platform Audits' },
        { title: 'Upgrade Planning & Execution' },
      ],
    },
    {
      title: 'Integration & Customization',
      color: '#8b5cf6',
      children: [
        { title: 'System Integration (Jira, Slack, MS Teams)' },
        { title: 'REST API Development & Integration' },
        { title: 'Custom Plugin & App Development' },
        { title: 'Automation Scripts & Workflows' },
        { title: 'Third-party Tool Connectors' },
      ],
    },
    {
      title: 'Training & Enablement',
      color: '#ec4899',
      children: [
        { title: 'End User Training Programs' },
        { title: 'Administrator Training & Certification' },
        { title: 'SAFe Certification (Leading SAFe, SSM, POPM)' },
        { title: 'Agile Methodology Training (Scrum, Kanban)' },
        { title: 'Custom Workshop Development' },
      ],
    },
    {
      title: 'Specialized Expertise',
      color: 'text.secondary',
      children: [
        {
          title: 'Agile at Scale',
          children: [
            { title: 'SAFe Framework Implementation' },
            { title: 'Jira Align for Enterprise Planning' },
            { title: 'Program Increment (PI) Planning' },
            { title: 'Portfolio & Value Stream Management' },
          ],
        },
        {
          title: 'DevOps Excellence',
          children: [
            { title: 'CI/CD Pipeline Design & Implementation' },
            { title: 'Build Automation with Bitbucket Pipelines' },
            { title: 'Deployment Automation & Orchestration' },
            { title: 'DevOps Metrics & Dashboards' },
          ],
        },
        {
          title: 'IT Service Management',
          children: [
            { title: 'Jira Service Management Setup' },
            { title: 'ITIL Process Implementation' },
            { title: 'Incident, Problem, Change Management' },
            { title: 'SLA Management & Reporting' },
          ],
        },
      ],
    },
    {
      title: 'AI & Platform 360',
      color: '#a78bfa',
      children: [
        { title: 'Intelligent Automation & Workflows' },
        { title: 'Predictive Analytics & Insights' },
        { title: '60% Developer Time Reduction' },
        { title: 'Unified Technology Stack' },
      ],
    },
  ],
};

interface TreeNode {
  title: string;
  color?: string;
  children?: TreeNode[];
}

interface TreeItemProps {
  node: TreeNode;
  level: number;
  defaultExpanded?: boolean;
}

const TreeItem: React.FC<TreeItemProps> = ({ node, level, defaultExpanded = false }) => {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const hasChildren = node.children && node.children.length > 0;

  return (
    <Box>
      <Box
        onClick={() => hasChildren && setExpanded(!expanded)}
        sx={{
          display: 'flex',
          alignItems: 'center',
          py: 1,
          px: 2,
          pl: 2 + level * 3,
          cursor: hasChildren ? 'pointer' : 'default',
          position: 'relative',
          borderLeft: level === 1 ? `3px solid ${node.color || 'transparent'}` : 'none',
          transition: 'all 0.2s ease',
          '&:hover': hasChildren ? {
            bgcolor: 'rgba(0, 0, 0, 0.03)',
            borderLeftColor: level === 1 ? node.color : 'transparent',
          } : {
            bgcolor: 'rgba(0, 0, 0, 0.01)',
          },
          '&::before': level > 1 ? {
            content: '""',
            position: 'absolute',
            left: 2 + (level - 1) * 3 + 1.2,
            top: 0,
            bottom: 0,
            width: '1px',
            bgcolor: 'rgba(0, 0, 0, 0.08)',
          } : {},
          '&::after': level > 1 ? {
            content: '""',
            position: 'absolute',
            left: 2 + (level - 1) * 3 + 1.2,
            top: '50%',
            width: `1.5rem`,
            height: '1px',
            bgcolor: 'rgba(0, 0, 0, 0.08)',
          } : {},
        }}
      >
        {hasChildren ? (
          <ChevronRight
            sx={{
              fontSize: 20,
              mr: 0.5,
              transition: 'transform 0.2s',
              transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
              color: level === 1 ? node.color : 'text.secondary',
            }}
          />
        ) : (
          <FiberManualRecord
            sx={{
              fontSize: 6,
              mr: 1.5,
              ml: 0.75,
              color: node.color || 'rgba(0, 0, 0, 0.25)',
            }}
          />
        )}

        <Typography
          variant="body2"
          sx={{
            fontWeight: level === 1 ? 600 : level === 2 ? 500 : 400,
            color: level === 1 ? 'text.primary' : level === 2 ? 'text.secondary' : '#64748b',
            fontSize: level === 1 ? '0.95rem' : '0.875rem',
            letterSpacing: level === 1 ? '-0.01em' : '0',
          }}
        >
          {node.title}
        </Typography>

        {level === 1 && node.children && (
          <Chip
            label={node.children.length}
            size="small"
            sx={{
              ml: 'auto',
              height: 22,
              fontSize: '0.7rem',
              bgcolor: 'rgba(0, 0, 0, 0.04)',
              color: node.color,
              fontWeight: 600,
              border: `1px solid ${node.color}30`,
            }}
          />
        )}
      </Box>

      {expanded && hasChildren && (
        <Box>
          {node.children!.map((child, index) => (
            <TreeItem
              key={index}
              node={child}
              level={level + 1}
              defaultExpanded={level === 1}
            />
          ))}
        </Box>
      )}
    </Box>
  );
};

const AtlassianKnowledgeGraph: React.FC = () => {
  return (
    <Box>
      {/* Header */}
      <Paper
        elevation={0}
        sx={{
          p: 3,
          mb: 3,
          background: 'linear-gradient(to right, #ffffff, #f8fafc)',
          borderColor: 'divider',
          borderRadius: 2,
        }}
      >
        <Typography
          variant="h4"
          sx={{
            fontWeight: 700,
            color: 'text.primary',
            mb: 0.5,
            letterSpacing: '-0.02em',
          }}
        >
          {atlassianData.title}
        </Typography>
        <Typography
          variant="body2"
          sx={{
            color: 'text.secondary',
            fontWeight: 500,
          }}
        >
          {atlassianData.subtitle}
        </Typography>
      </Paper>

      {/* Tree Structure */}
      <Paper
        elevation={0}
        sx={{
          borderColor: 'divider',
          borderRadius: 2,
          overflow: 'hidden',
          bgcolor: 'background.paper',
        }}
      >
        {atlassianData.children.map((node, index) => (
          <Box
            key={index}
            sx={{
              borderBottom: index < atlassianData.children.length - 1 ? '1px solid #f1f5f9' : 'none',
            }}
          >
            <TreeItem
              node={node}
              level={1}
              defaultExpanded={index === 0}
            />
          </Box>
        ))}
      </Paper>

      {/* Instructions for Modification */}
      <Paper
        elevation={0}
        sx={{
          p: 2,
          mt: 3,
          bgcolor: 'background.default',
          borderColor: 'divider',
          borderRadius: 2,
        }}
      >
        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.5, fontWeight: 500 }}>
          To modify this data: Edit the <code style={{
            backgroundColor: '#e2e8f0',
            padding: '2px 6px',
            borderRadius: '3px',
            fontSize: '0.85em',
          }}>atlassianData</code> object at the top of this component.
        </Typography>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          Add/remove items in the children arrays. Set color for category highlights.
        </Typography>
      </Paper>
    </Box>
  );
};

export default AtlassianKnowledgeGraph;
