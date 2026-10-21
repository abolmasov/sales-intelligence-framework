import React, { useState } from 'react';
import { Box, Tabs, Tab, Paper, IconButton, Tooltip } from '@mui/material';
import { Hub, Build, People, Business, Edit as EditIcon, Close as CloseIcon } from '@mui/icons-material';
import AtlassianKnowledgeGraph from './AtlassianKnowledgeGraph';
import ServiceNowKnowledgeGraph from './ServiceNowKnowledgeGraph';
import IntegratorKnowledgeGraph from './IntegratorKnowledgeGraph';
import IntegratorSalesTeamsGraph from './IntegratorSalesTeamsGraph';
import GraphDataEditor from './GraphDataEditor';

/**
 * Configuration array for knowledge graphs
 * Add/remove/modify graphs here to easily customize the Knowledge Graphs view
 */
const KNOWLEDGE_GRAPHS = [
  {
    id: 'enterprise',
    label: 'Northstar Integrators Cases',
    icon: Business,
    component: IntegratorKnowledgeGraph,
    description: 'Northstar Integrators customer cases and success stories'
  },
  {
    id: 'sales-teams',
    label: 'Sales Teams',
    icon: People,
    component: IntegratorSalesTeamsGraph,
    description: 'Northstar Integrators sales team structure and relationships'
  },
  {
    id: 'atlassian',
    label: 'Atlassian',
    icon: Hub,
    component: AtlassianKnowledgeGraph,
    description: 'Atlassian product ecosystem and integrations'
  },
  {
    id: 'servicenow',
    label: 'ServiceNow',
    icon: Build,
    component: ServiceNowKnowledgeGraph,
    description: 'ServiceNow platform and modules'
  }
];

const KnowledgeGraphsView: React.FC = () => {
  const [activeTab, setActiveTab] = useState(0);
  const [showEditor, setShowEditor] = useState(false);
  const [graphData, setGraphData] = useState<any>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
    setShowEditor(false); // Close editor when switching tabs
  };

  const handleDataChange = (newData: any) => {
    setGraphData(newData);
    setRefreshKey(prev => prev + 1); // Force graph to re-render
  };

  const currentGraph = KNOWLEDGE_GRAPHS[activeTab];

  return (
    <Box>
      <Paper sx={{ mb: 3, bgcolor: 'rgba(30, 35, 50, 0.95)', borderRadius: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pr: 2 }}>
          <Tabs
            value={activeTab}
            onChange={handleTabChange}
            variant="scrollable"
            scrollButtons="auto"
            sx={{
              flex: 1,
              '& .MuiTab-root': {
                color: 'text.disabled',
                fontWeight: 600,
                fontSize: '0.875rem',
                textTransform: 'none',
                minHeight: 56,
                '&.Mui-selected': {
                  color: 'secondary.main',
                },
              },
              '& .MuiTabs-indicator': {
                backgroundColor: '#3b82f6',
                height: 3,
              },
              borderBottom: '1px solid #334155',
            }}
          >
            {KNOWLEDGE_GRAPHS.map((graph) => {
              const IconComponent = graph.icon;
              return (
                <Tab
                  key={graph.id}
                  icon={<IconComponent sx={{ fontSize: 20 }} />}
                  iconPosition="start"
                  label={graph.label}
                  sx={{ px: 3 }}
                  title={graph.description}
                />
              );
            })}
          </Tabs>
          <Tooltip title={showEditor ? 'Hide Editor' : 'Show Data Editor'}>
            <IconButton
              onClick={() => setShowEditor(!showEditor)}
              sx={{
                color: showEditor ? '#3b82f6' : '#94a3b8',
                '&:hover': {
                  color: 'secondary.main',
                },
              }}
            >
              {showEditor ? <CloseIcon /> : <EditIcon />}
            </IconButton>
          </Tooltip>
        </Box>
      </Paper>

      <Box sx={{ display: 'flex', gap: 3, alignItems: 'flex-start' }}>
        {/* Graph Visualization */}
        <Box sx={{ flex: showEditor ? '1 1 66%' : '1 1 100%' }}>
          {KNOWLEDGE_GRAPHS.map((graph, index) => {
            const GraphComponent = graph.component;
            return (
              <Box key={graph.id} sx={{ display: activeTab === index ? 'block' : 'none' }}>
                <GraphComponent key={refreshKey} />
              </Box>
            );
          })}
        </Box>

        {/* Data Editor Panel */}
        {showEditor && (
          <Box sx={{ flex: '0 0 33%', minWidth: 0 }}>
            <Paper
              sx={{
                p: 3,
                bgcolor: 'rgba(30, 35, 50, 0.95)',
                height: '800px',
                overflow: 'hidden',
              }}
            >
              <GraphDataEditor
                graphId={currentGraph.id}
                initialData={{
                  nodes: [],
                  links: [],
                  // Add default structure here
                }}
                onDataChange={handleDataChange}
              />
            </Paper>
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default KnowledgeGraphsView;
