import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { apiPost } from '../utils/api';

// Session ID persists across navigation but resets on page reload
const SESSION_ID = `session_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

/**
 * Track a page view (call from useAnalytics hook, not directly)
 */
const trackPageView = (path: string) => {
  apiPost('/api/metrics/page-view', {
    page: path,
    sessionId: SESSION_ID,
  }).catch(() => {});
};

/**
 * Track a feature usage event
 */
export const trackFeature = (
  feature: string,
  action: string,
  metadata?: Record<string, any>
) => {
  apiPost('/api/metrics/feature', {
    feature,
    action,
    metadata: { ...metadata, sessionId: SESSION_ID },
  }).catch(() => {});
};

/**
 * Track an export action
 */
export const trackExport = (format: string, itemCount: number, context?: string) => {
  apiPost('/api/metrics/export', {
    format,
    itemCount,
    context,
  }).catch(() => {});
};

/**
 * Hook that automatically tracks page views on route changes
 * Place this once in your App or Layout component
 */
export function useAnalytics() {
  const location = useLocation();
  const lastPath = useRef<string>('');

  useEffect(() => {
    // Only track if the path actually changed
    if (location.pathname !== lastPath.current) {
      lastPath.current = location.pathname;
      trackPageView(location.pathname);
    }
  }, [location.pathname]);
}

export default useAnalytics;
