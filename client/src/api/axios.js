// ==========================================
// AXIOS CONFIGURATION
// ==========================================
// Token injection, 401 handling and a single normalised error type.

import axios from 'axios';
import { normalizeApiError } from './errors';

const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const PROTECTED_PREFIXES = ['/dashboard', '/report', '/map', '/admin', '/supervisor', '/reports/'];

const api = axios.create({
  baseURL: baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(normalizeApiError(error)),
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.dispatchEvent(new Event('munisolve:auth-expired'));

      const path = window.location.pathname;
      const onProtectedPage = PROTECTED_PREFIXES.some(
        (prefix) => path === prefix || path.startsWith(prefix),
      );
      if (onProtectedPage && path !== '/login') {
        window.location.assign('/login');
      }
    }

    return Promise.reject(normalizeApiError(error));
  },
);

export { ApiError } from './errors';
export default api;
