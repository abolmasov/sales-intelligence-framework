import React from 'react';
import { Breadcrumbs, Link, Typography, Box } from '@mui/material';
import { NavigateNext, Home } from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';

export interface BreadcrumbItem {
  label: string;
  path?: string;
  icon?: React.ReactNode;
}

interface PageBreadcrumbsProps {
  items: BreadcrumbItem[];
  currentPage: string;
}

/**
 * PageBreadcrumbs - Contextual navigation breadcrumbs for detail pages
 *
 * Usage:
 * <PageBreadcrumbs
 *   items={[
 *     { label: 'Calendar', path: '/app/calendar' },
 *     { label: 'Acme Corp', path: '/app/accounts/123' },
 *   ]}
 *   currentPage="Meeting Details"
 * />
 */
const PageBreadcrumbs: React.FC<PageBreadcrumbsProps> = ({ items, currentPage }) => {
  const navigate = useNavigate();
  const location = useLocation();

  // Check if we came from a specific page via location state
  const fromMeetingId = (location.state as any)?.meetingId;
  const fromDealId = (location.state as any)?.dealId;
  const fromAccountId = (location.state as any)?.accountId;

  const handleClick = (path: string | undefined) => (event: React.MouseEvent) => {
    event.preventDefault();
    if (path) {
      navigate(path);
    }
  };

  return (
    <Box sx={{ mb: 2 }}>
      <Breadcrumbs
        separator={<NavigateNext fontSize="small" sx={{ color: 'text.disabled' }} />}
        aria-label="breadcrumb"
        sx={{
          '& .MuiBreadcrumbs-ol': {
            flexWrap: 'nowrap',
          },
          '& .MuiBreadcrumbs-li': {
            whiteSpace: 'nowrap',
          },
        }}
      >
        {/* Home link */}
        <Link
          component="button"
          underline="hover"
          color="text.secondary"
          onClick={handleClick('/app/calendar')}
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
            fontSize: '0.875rem',
            cursor: 'pointer',
            '&:hover': {
              color: 'primary.main',
            },
          }}
        >
          <Home sx={{ fontSize: 18 }} />
          Home
        </Link>

        {/* Intermediate breadcrumb items */}
        {items.map((item, index) => (
          <Link
            key={index}
            component="button"
            underline="hover"
            color="text.secondary"
            onClick={handleClick(item.path)}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
              fontSize: '0.875rem',
              cursor: item.path ? 'pointer' : 'default',
              maxWidth: 200,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              '&:hover': item.path ? {
                color: 'primary.main',
              } : {},
            }}
          >
            {item.icon}
            {item.label}
          </Link>
        ))}

        {/* Current page (not clickable) */}
        <Typography
          color="text.primary"
          sx={{
            fontSize: '0.875rem',
            fontWeight: 500,
            maxWidth: 250,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {currentPage}
        </Typography>
      </Breadcrumbs>
    </Box>
  );
};

export default PageBreadcrumbs;
