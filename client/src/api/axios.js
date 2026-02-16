// ==========================================
// AXIOS CONFIGURATION
// ==========================================
// HTTP client setup with automatic token injection
// Author: MuniSolve ZA Development Team

import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:5000/api', // Your Express Server URL
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - automatically add token to requests
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor - handle common errors
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    // Handle 401 Unauthorized - token expired or invalid
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      // Optionally redirect to login
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    
    return Promise.reject(error);
  }
);

export default api;
