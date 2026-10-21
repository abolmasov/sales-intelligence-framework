import { clearAuthToken, getAuthToken, setAuthToken } from './authToken';
import { API_BASE_URL } from '../config';

let refreshPromise: Promise<boolean> | null = null;

const prepareHeaders = (options?: HeadersInit, isFormData?: boolean) => {
  const headers = new Headers(options || {});
  if (!isFormData && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const token = getAuthToken();
  console.log('[API] prepareHeaders - token present:', !!token);
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
    console.log('[API] Authorization header set');
  }

  return headers;
};

const handleUnauthorized = () => {
  clearAuthToken();
  if (typeof window !== 'undefined') {
    window.location.href = '/';
  }
};

const refreshSession = async (): Promise<boolean> => {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        // Include the current token in Authorization header for cross-origin refresh
        const currentToken = getAuthToken();
        const headers: HeadersInit = { 'Content-Type': 'application/json' };
        if (currentToken) {
          headers['Authorization'] = `Bearer ${currentToken}`;
        }

        console.log('[API] Attempting token refresh...');
        const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
          method: 'POST',
          credentials: 'include',
          headers,
        });
        if (!response.ok) {
          console.log('[API] Token refresh failed:', response.status);
          return false;
        }
        const data = await response.json().catch(() => ({}));
        if (data?.token) {
          console.log('[API] Token refreshed successfully');
          setAuthToken(data.token);
        }
        return true;
      } catch (error) {
        console.error('[API] Token refresh error:', error);
        return false;
      } finally {
        refreshPromise = null;
      }
    })();
  }
  return refreshPromise;
};

export const apiCall = async (
  endpoint: string,
  options?: (RequestInit & { isFormData?: boolean })
): Promise<Response> => {
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;
  const isFormData = options?.isFormData || options?.body instanceof FormData;

  // Build headers fresh each time to get current token
  const buildRequest = () => {
    const headers = prepareHeaders(options?.headers, isFormData);
    console.log('[API] apiCall to:', url);
    return fetch(url, {
      ...options,
      headers,
      credentials: 'include',
    });
  };

  let response = await buildRequest();

  if (response.status === 401) {
    const refreshed = await refreshSession();
    if (refreshed) {
      // Rebuild request with fresh headers (new token)
      response = await buildRequest();
      if (response.status !== 401) {
        return response;
      }
    }
    handleUnauthorized();
  }

  return response;
};

export const apiGet = async (endpoint: string) => {
  const response = await apiCall(endpoint);
  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }
  return response.json();
};

export const apiPost = async (endpoint: string, body: any) => {
  const response = await apiCall(endpoint, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  return response.json();
};

export const apiPostForm = async (endpoint: string, formData: FormData) => {
  const response = await apiCall(endpoint, {
    method: 'POST',
    body: formData,
    isFormData: true,
  });
  return response.json();
};

export const apiPut = async (endpoint: string, body: any) => {
  const response = await apiCall(endpoint, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
  return response.json();
};

export const apiDelete = async (endpoint: string) => {
  const response = await apiCall(endpoint, {
    method: 'DELETE',
  });
  return response.json();
};

export const apiPatch = async (endpoint: string, body: any) => {
  const response = await apiCall(endpoint, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
  return response.json();
};
