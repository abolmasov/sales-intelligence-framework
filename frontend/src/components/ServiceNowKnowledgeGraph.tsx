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
const serviceNowData = {
  title: 'ServiceNow Services',
  subtitle: 'Elite Partner | Northstar library Acquisition 2024 | Goldman Sachs Backed',
  children: [
    {
      title: 'Consulting Services',
      color: 'success.main',
      children: [
        { title: 'Strategic Planning & Roadmapping' },
        { title: 'Operating Model Design & Optimization' },
        { title: 'Technology Assessment & Gap Analysis' },
        { title: 'Business Process Analysis' },
        { title: 'ServiceNow Platform Evaluation' },
        { title: 'ROI & Business Case Development' },
      ],
    },
    {
      title: 'Implementation Services',
      color: '#06b6d4',
      children: [
        { title: 'End-to-End Platform Deployment' },
        { title: 'Workflow Automation & Configuration' },
        { title: 'Custom Application Development' },
        { title: 'Integration Setup (APIs, Middleware)' },
        { title: 'Data Migration & Transformation' },
        { title: 'Testing & Quality Assurance' },
      ],
    },
    {
      title: 'Managed Services',
      color: '#8b5cf6',
      children: [
        { title: 'Platform Administration & Maintenance' },
        { title: 'Continuous Improvement Programs' },
        { title: '24/7 Support & Incident Management' },
        { title: 'Performance Monitoring & Optimization' },
        { title: 'Capacity Planning & Scaling' },
        { title: 'Regular Health Checks & Audits' },
      ],
    },
    {
      title: 'Operating Model Transformation',
      color: 'warning.main',
      children: [
        { title: 'AI-Native Transformation Strategy' },
        { title: 'Process Innovation & Redesign' },
        { title: 'Organizational Change Management' },
        { title: 'Culture & Adoption Programs' },
        { title: 'Training & Knowledge Transfer' },
      ],
    },
    {
      title: 'Employee Experience',
      color: 'success.main',
      children: [
        { title: 'HR Service Delivery (HRSD)' },
        { title: 'Employee Onboarding & Offboarding' },
        { title: 'Employee Center & Self-Service Portal' },
        { title: 'Workplace Service Delivery' },
        { title: 'Case & Knowledge Management' },
        { title: 'Employee Lifecycle Management' },
      ],
    },
    {
      title: 'Technology Excellence',
      color: '#06b6d4',
      children: [
        {
          title: 'IT Service Management (ITSM)',
          children: [
            { title: 'Incident Management' },
            { title: 'Problem Management' },
            { title: 'Change Management' },
            { title: 'Service Catalog' },
          ],
        },
        {
          title: 'IT Operations Management (ITOM)',
          children: [
            { title: 'Event Management' },
            { title: 'Discovery & Service Mapping' },
            { title: 'Cloud Management' },
          ],
        },
        { title: 'Strategic Portfolio Management (SPM)' },
        { title: 'IT Asset Management (ITAM)' },
        { title: 'Enterprise Asset Management (EAM)' },
        { title: 'Configuration Management Database (CMDB)' },
      ],
    },
    {
      title: 'Customer Excellence',
      color: '#ec4899',
      children: [
        { title: 'Customer Service Management (CSM)' },
        { title: 'Field Service Management (FSM)' },
        { title: 'Omnichannel Support Integration' },
        { title: 'Customer Engagement & Analytics' },
        { title: 'SLA Management & Reporting' },
      ],
    },
    {
      title: 'Hyper Automation',
      color: '#8b5cf6',
      children: [
        { title: 'Low-Code App Development (App Engine)' },
        { title: 'Process Mining & Optimization' },
        { title: 'RPA Integration (UiPath, Automation Anywhere)' },
        { title: 'Intelligent Workflow Automation' },
        { title: 'Business Rules & Decision Engines' },
      ],
    },
    {
      title: 'Industry Expertise',
      color: 'text.secondary',
      children: [
        { title: 'Healthcare (50+ Clients)' },
        { title: 'Financial Services (75+ Clients)' },
        { title: 'Public Sector (40+ Clients)' },
        { title: 'Retail (30+ Clients)' },
        { title: 'Manufacturing (60+ Clients)' },
      ],
    },
    {
      title: 'AI-Powered Capabilities',
      color: '#a78bfa',
      children: [
        { title: 'Agentic AI - Autonomous AI agents for automated task execution' },
        { title: 'AI Control Tower - Centralized AI governance and oversight' },
        { title: 'AI Agent Fabric - Framework for building custom AI agents' },
        { title: 'Machine Learning - Predictive analytics and intelligent insights' },
      ],
    },
    {
      title: 'Business Outcomes',
      color: 'success.main',
      children: [
        { title: 'Days to Minutes - Reduction in process execution time' },
        { title: '19% Project Yield Increase' },
        { title: 'Enhanced ROI - Significant return on ServiceNow investment' },
        { title: 'Operational Efficiency - Streamlined workflows and automation' },
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

const ServiceNowKnowledgeGraph: React.FC = () => {
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
          {serviceNowData.title}
        </Typography>
        <Typography
          variant="body2"
          sx={{
            color: 'text.secondary',
            fontWeight: 500,
          }}
        >
          {serviceNowData.subtitle}
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
        {serviceNowData.children.map((node, index) => (
          <Box
            key={index}
            sx={{
              borderBottom: index < serviceNowData.children.length - 1 ? '1px solid #f1f5f9' : 'none',
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
          }}>serviceNowData</code> object at the top of this component.
        </Typography>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          Add/remove items in the children arrays. Set color for category highlights.
        </Typography>
      </Paper>
    </Box>
  );
};

export default ServiceNowKnowledgeGraph;
