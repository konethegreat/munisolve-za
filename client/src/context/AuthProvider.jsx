// ==========================================
// AUTHENTICATION CONTEXT
// ==========================================
// Global state management for user authentication
// Author: MuniSolve ZA Development Team

// client/src/context/AuthContext.jsx
import { useState, useEffect } from 'react';
import api from '../api/axios';
import { AuthContext } from './AuthContext'; // Import the bucket



export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);

  // Load user data when app starts
  useEffect(() => {
    const loadUser = async () => {
      const savedToken = localStorage.getItem('token');
      
      if (!savedToken) {
        setLoading(false);
        return;
      }

      try {
        // Get current user from backend
        const { data } = await api.get('/auth/me', {
          headers: { Authorization: `Bearer ${savedToken}` }
        });
        
        if (data.success) {
          setUser(data.data);
          setToken(savedToken);
        } else {
          // Invalid token
          localStorage.removeItem('token');
          setToken(null);
          setUser(null);
        }
      } catch (error) {
        console.error('Failed to load user:', error);
        // Token expired or invalid
        localStorage.removeItem('token');
        setToken(null);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    loadUser();
  }, []);

  // Login function
  const login = async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    
    if (data.success) {
      const newToken = data.data.token;
      const userData = data.data.user;
      
      // Save to state and localStorage
      setToken(newToken);
      setUser(userData);
      localStorage.setItem('token', newToken);
      
      return { success: true };
    }
    
    throw new Error(data.message || 'Login failed');
  };

  // Register function
  const register = async (userData) => {
    const { data } = await api.post('/auth/register', userData);
    
    if (data.success) {
      const newToken = data.data.token;
      const user = data.data.user;
      
      // Auto-login after registration
      setToken(newToken);
      setUser(user);
      localStorage.setItem('token', newToken);
      
      return { success: true };
    }
    
    throw new Error(data.message || 'Registration failed');
  };

  // Logout function
  const logout = async () => {
    try {
      // Call backend logout endpoint (logs the activity)
      if (token) {
        await api.post('/auth/logout', {}, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Clear state and localStorage
      setToken(null);
      setUser(null);
      localStorage.removeItem('token');
    }
  };

  // Check if user is authenticated
  const isAuthenticated = !!token && !!user;

  const value = {
    user,
    token,
    loading,
    isAuthenticated,
    login,
    register,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
