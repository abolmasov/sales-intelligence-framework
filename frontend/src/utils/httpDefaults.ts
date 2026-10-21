import axios from 'axios';
import { getAuthToken } from './authToken';

import { API_BASE_URL } from '../config';

axios.defaults.baseURL = API_BASE_URL;

axios.interceptors.request.use((config) => {
  const token = getAuthToken();
  if (token) {
    config.headers = config.headers || {};
    if (!config.headers.Authorization) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

const shouldAttachAuth = (input: RequestInfo | URL): boolean => {
  if (typeof input === 'string') {
    if (input.startsWith('http')) {
      return input.startsWith(API_BASE_URL);
    }
    return true;
  }
  if (input instanceof Request) {
    const url = input.url;
    if (url.startsWith('http')) {
      return url.startsWith(API_BASE_URL);
    }
    return true;
  }
  return false;
};

if (typeof window !== 'undefined' && window.fetch) {
  const originalFetch = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const finalInit: RequestInit = init ? { ...init } : {};
    const url = typeof input === 'string' ? input : input instanceof Request ? input.url : input.toString();

    if (shouldAttachAuth(input)) {
      const headers = new Headers(finalInit.headers || {});
      const token = getAuthToken();
      console.log('[httpDefaults] fetch to:', url, 'token present:', !!token);
      if (token && !headers.has('Authorization')) {
        headers.set('Authorization', `Bearer ${token}`);
        console.log('[httpDefaults] Authorization header set');
      }
      finalInit.headers = headers;
    }
    return originalFetch(input, finalInit);
  };
}
