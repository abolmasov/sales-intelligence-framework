import React from 'react';
import { Box, Container } from '@mui/material';
import MetricsDashboard from '../components/MetricsDashboard';

const MetricsPage: React.FC = () => {
  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <MetricsDashboard />
    </Container>
  );
};

export default MetricsPage;
