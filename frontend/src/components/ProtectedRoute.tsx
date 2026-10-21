import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Box, CircularProgress } from '@mui/material';
import { apiCall } from '../utils/api';
import { getAuthToken, clearAuthToken } from '../utils/authToken';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const location = useLocation();
  const [checking, setChecking] = useState(true);
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    const token = getAuthToken();
    if (!token) {
      setAuthorized(false);
      setChecking(false);
      return;
    }

    let isMounted = true;
    const verify = async () => {
      try {
        const response = await apiCall('/auth/me');
        if (!isMounted) return;
        setAuthorized(response.ok);
      } catch (error) {
        console.error('Auth verification failed:', error);
        clearAuthToken();
        if (isMounted) {
          setAuthorized(false);
        }
      } finally {
        if (isMounted) {
          setChecking(false);
        }
      }
    };

    verify();
    return () => {
      isMounted = false;
    };
  }, []);

  if (checking) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: 'text.primary',
        }}
      >
        <CircularProgress sx={{ color: 'secondary.main' }} />
      </Box>
    );
  }

  if (!authorized) {
    return <Navigate to="/" replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
