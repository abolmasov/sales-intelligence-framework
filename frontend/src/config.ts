if (!process.env.REACT_APP_API_URL && process.env.NODE_ENV === 'production') {
  throw new Error('REACT_APP_API_URL is required in production');
}

const rawApiBaseUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001';
export const API_BASE_URL = /^https?:\/\//i.test(rawApiBaseUrl)
  ? rawApiBaseUrl
  : `http://${rawApiBaseUrl}`;

export const apiUrl = (path: string) => {
  if (!path.startsWith('/')) {
    return `${API_BASE_URL}/${path}`;
  }
  return `${API_BASE_URL}${path}`;
};