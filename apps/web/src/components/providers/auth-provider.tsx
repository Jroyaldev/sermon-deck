'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import axios from 'axios';
import { jwtDecode } from 'jwt-decode';
import { 
  UserProfile, 
  UserRole, 
  LoginRequest, 
  RegisterRequest,
  AuthResponse,
  JwtPayload
} from '@sermonflow/types';

// Constants
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
const AUTH_TOKEN_KEY = 'sermonflow_auth_token';
const REFRESH_TOKEN_KEY = 'sermonflow_refresh_token';
const USER_DATA_KEY = 'sermonflow_user';

// Authentication context interface
interface AuthContextType {
  user: UserProfile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;
  login: (credentials: LoginRequest) => Promise<void>;
  register: (userData: RegisterRequest) => Promise<void>;
  logout: () => void;
  refreshUserData: () => Promise<void>;
  updateUserProfile: (data: Partial<UserProfile>) => Promise<void>;
  forgotPassword: (email: string) => Promise<void>;
  resetPassword: (token: string, password: string) => Promise<void>;
  verifyEmail: (token: string) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  clearError: () => void;
}

// Create the context with a default value
const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true,
  isAuthenticated: false,
  error: null,
  login: async () => {},
  register: async () => {},
  logout: () => {},
  refreshUserData: async () => {},
  updateUserProfile: async () => {},
  forgotPassword: async () => {},
  resetPassword: async () => {},
  verifyEmail: async () => {},
  changePassword: async () => {},
  clearError: () => {},
});

// Setup axios instance for auth requests
const authApi = axios.create({
  baseURL: `${API_URL}/api/v1/auth`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add request interceptor to include auth token
authApi.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Add response interceptor to handle token refresh
authApi.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    // If the error is 401 and we haven't already tried to refresh
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      try {
        // Try to refresh the token
        const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
        if (!refreshToken) {
          throw new Error('No refresh token available');
        }
        
        const response = await axios.post(`${API_URL}/api/v1/auth/refresh`, {
          refreshToken,
        });
        
        const { accessToken, refreshToken: newRefreshToken } = response.data.data;
        
        // Store the new tokens
        localStorage.setItem(AUTH_TOKEN_KEY, accessToken);
        localStorage.setItem(REFRESH_TOKEN_KEY, newRefreshToken);
        
        // Update the Authorization header
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        
        // Retry the original request
        return authApi(originalRequest);
      } catch (refreshError) {
        // If refresh fails, log out the user
        localStorage.removeItem(AUTH_TOKEN_KEY);
        localStorage.removeItem(REFRESH_TOKEN_KEY);
        localStorage.removeItem(USER_DATA_KEY);
        
        // Force redirect to login page
        window.location.href = '/auth/login';
        return Promise.reject(refreshError);
      }
    }
    
    return Promise.reject(error);
  }
);

/**
 * AuthProvider component
 * 
 * Provides authentication context to the application with user state,
 * authentication methods, and token management.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const pathname = usePathname();

  // Check if user is authenticated
  const isAuthenticated = !!user;

  // Clear error message
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Initialize auth state from local storage
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        setIsLoading(true);
        
        // Check for existing token and user data
        const token = localStorage.getItem(AUTH_TOKEN_KEY);
        const userData = localStorage.getItem(USER_DATA_KEY);
        
        if (!token || !userData) {
          // No stored credentials, user is not logged in
          setIsLoading(false);
          return;
        }
        
        // Check if token is expired
        try {
          const decoded = jwtDecode<JwtPayload>(token);
          const currentTime = Date.now() / 1000;
          
          if (decoded.exp && decoded.exp < currentTime) {
            // Token is expired, try to refresh
            await refreshToken();
          } else {
            // Token is valid, set user data
            setUser(JSON.parse(userData));
          }
        } catch (e) {
          // Invalid token, clear storage
          localStorage.removeItem(AUTH_TOKEN_KEY);
          localStorage.removeItem(REFRESH_TOKEN_KEY);
          localStorage.removeItem(USER_DATA_KEY);
        }
      } catch (err) {
        console.error('Auth initialization error:', err);
        setError('Failed to initialize authentication');
      } finally {
        setIsLoading(false);
      }
    };
    
    initializeAuth();
  }, []);

  // Refresh token function
  const refreshToken = async () => {
    try {
      const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
      
      if (!refreshToken) {
        throw new Error('No refresh token available');
      }
      
      const response = await axios.post(`${API_URL}/api/v1/auth/refresh`, {
        refreshToken,
      });
      
      const { accessToken, refreshToken: newRefreshToken, user } = response.data.data;
      
      // Store the new tokens and user data
      localStorage.setItem(AUTH_TOKEN_KEY, accessToken);
      localStorage.setItem(REFRESH_TOKEN_KEY, newRefreshToken);
      localStorage.setItem(USER_DATA_KEY, JSON.stringify(user));
      
      setUser(user);
      return true;
    } catch (err) {
      // If refresh fails, log out the user
      localStorage.removeItem(AUTH_TOKEN_KEY);
      localStorage.removeItem(REFRESH_TOKEN_KEY);
      localStorage.removeItem(USER_DATA_KEY);
      setUser(null);
      
      return false;
    }
  };

  // Set up automatic token refresh
  useEffect(() => {
    if (!isAuthenticated) return;
    
    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    if (!token) return;
    
    try {
      const decoded = jwtDecode<JwtPayload>(token);
      
      if (!decoded.exp) return;
      
      // Calculate time until token expires (in ms)
      const currentTime = Date.now() / 1000;
      const timeUntilExpiry = (decoded.exp - currentTime) * 1000;
      
      // Set up refresh 5 minutes before expiry
      const refreshTime = Math.max(timeUntilExpiry - 5 * 60 * 1000, 0);
      
      const refreshTimerId = setTimeout(() => {
        refreshToken();
      }, refreshTime);
      
      return () => clearTimeout(refreshTimerId);
    } catch (err) {
      console.error('Token refresh setup error:', err);
    }
  }, [isAuthenticated, user]);

  // Login function
  const login = async (credentials: LoginRequest) => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await authApi.post<{ success: boolean; data: AuthResponse }>('/login', credentials);
      const { accessToken, refreshToken, user } = response.data.data;
      
      // Store tokens and user data
      localStorage.setItem(AUTH_TOKEN_KEY, accessToken);
      localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
      localStorage.setItem(USER_DATA_KEY, JSON.stringify(user));
      
      setUser(user);
      
      // Redirect to dashboard
      router.push('/dashboard');
    } catch (err) {
      console.error('Login error:', err);
      
      if (axios.isAxiosError(err) && err.response) {
        setError(err.response.data.error?.message || 'Invalid email or password');
      } else {
        setError('An unexpected error occurred. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Register function
  const register = async (userData: RegisterRequest) => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await authApi.post<{ success: boolean; data: AuthResponse }>('/signup', userData);
      const { accessToken, refreshToken, user } = response.data.data;
      
      // Store tokens and user data
      localStorage.setItem(AUTH_TOKEN_KEY, accessToken);
      localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
      localStorage.setItem(USER_DATA_KEY, JSON.stringify(user));
      
      setUser(user);
      
      // Redirect to dashboard
      router.push('/dashboard');
    } catch (err) {
      console.error('Registration error:', err);
      
      if (axios.isAxiosError(err) && err.response) {
        setError(err.response.data.error?.message || 'Registration failed');
      } else {
        setError('An unexpected error occurred. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Logout function
  const logout = useCallback(async () => {
    try {
      setIsLoading(true);
      
      // Call logout endpoint to invalidate refresh token
      const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
      if (refreshToken) {
        await authApi.post('/logout', { refreshToken });
      }
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      // Clear local storage regardless of API response
      localStorage.removeItem(AUTH_TOKEN_KEY);
      localStorage.removeItem(REFRESH_TOKEN_KEY);
      localStorage.removeItem(USER_DATA_KEY);
      
      setUser(null);
      setIsLoading(false);
      
      // Redirect to login page
      router.push('/auth/login');
    }
  }, [router]);

  // Refresh user data
  const refreshUserData = async () => {
    try {
      setIsLoading(true);
      
      const response = await authApi.get('/me');
      const userData = response.data.data.user;
      
      localStorage.setItem(USER_DATA_KEY, JSON.stringify(userData));
      setUser(userData);
    } catch (err) {
      console.error('Error refreshing user data:', err);
      
      if (axios.isAxiosError(err) && err.response?.status === 401) {
        // Token might be invalid, try to refresh
        const refreshSuccessful = await refreshToken();
        if (!refreshSuccessful) {
          logout();
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Update user profile
  const updateUserProfile = async (data: Partial<UserProfile>) => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await authApi.put('/me', data);
      const updatedUser = response.data.data.user;
      
      localStorage.setItem(USER_DATA_KEY, JSON.stringify(updatedUser));
      setUser(updatedUser);
    } catch (err) {
      console.error('Profile update error:', err);
      
      if (axios.isAxiosError(err) && err.response) {
        setError(err.response.data.error?.message || 'Failed to update profile');
      } else {
        setError('An unexpected error occurred. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Forgot password
  const forgotPassword = async (email: string) => {
    try {
      setIsLoading(true);
      setError(null);
      
      await authApi.post('/forgot-password', { email });
    } catch (err) {
      console.error('Forgot password error:', err);
      
      if (axios.isAxiosError(err) && err.response) {
        setError(err.response.data.error?.message || 'Failed to process request');
      } else {
        setError('An unexpected error occurred. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Reset password
  const resetPassword = async (token: string, password: string) => {
    try {
      setIsLoading(true);
      setError(null);
      
      await authApi.post('/reset-password', { token, password });
      
      // Redirect to login page
      router.push('/auth/login?reset=success');
    } catch (err) {
      console.error('Reset password error:', err);
      
      if (axios.isAxiosError(err) && err.response) {
        setError(err.response.data.error?.message || 'Failed to reset password');
      } else {
        setError('An unexpected error occurred. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Verify email
  const verifyEmail = async (token: string) => {
    try {
      setIsLoading(true);
      setError(null);
      
      await authApi.post('/verify-email', { token });
      
      // If user is logged in, refresh their data to update verification status
      if (user) {
        await refreshUserData();
      }
      
      // Redirect to login page or dashboard
      if (user) {
        router.push('/dashboard?verified=success');
      } else {
        router.push('/auth/login?verified=success');
      }
    } catch (err) {
      console.error('Email verification error:', err);
      
      if (axios.isAxiosError(err) && err.response) {
        setError(err.response.data.error?.message || 'Failed to verify email');
      } else {
        setError('An unexpected error occurred. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Change password
  const changePassword = async (currentPassword: string, newPassword: string) => {
    try {
      setIsLoading(true);
      setError(null);
      
      await authApi.post('/change-password', { currentPassword, newPassword });
    } catch (err) {
      console.error('Change password error:', err);
      
      if (axios.isAxiosError(err) && err.response) {
        setError(err.response.data.error?.message || 'Failed to change password');
      } else {
        setError('An unexpected error occurred. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Redirect unauthenticated users away from protected routes
  useEffect(() => {
    // Skip during server-side rendering or loading
    if (typeof window === 'undefined' || isLoading) return;
    
    // Define protected routes that require authentication
    const protectedRoutes = [
      '/dashboard',
      '/sermons',
      '/series',
      '/templates',
      '/settings',
    ];
    
    // Define routes that should redirect authenticated users
    const authRoutes = [
      '/auth/login',
      '/auth/signup',
      '/auth/forgot-password',
      '/auth/reset-password',
    ];
    
    // Check if current path is a protected route
    const isProtectedRoute = protectedRoutes.some(route => 
      pathname?.startsWith(route)
    );
    
    // Check if current path is an auth route
    const isAuthRoute = authRoutes.some(route => 
      pathname?.startsWith(route)
    );
    
    // Redirect logic
    if (isProtectedRoute && !isAuthenticated) {
      // Redirect unauthenticated users to login
      router.push(`/auth/login?redirect=${encodeURIComponent(pathname || '/dashboard')}`);
    } else if (isAuthRoute && isAuthenticated) {
      // Redirect authenticated users to dashboard
      router.push('/dashboard');
    }
  }, [isAuthenticated, isLoading, pathname, router]);

  // Provide the auth context to children
  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated,
        error,
        login,
        register,
        logout,
        refreshUserData,
        updateUserProfile,
        forgotPassword,
        resetPassword,
        verifyEmail,
        changePassword,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Custom hook to use the auth context
 * 
 * @returns AuthContextType
 * @throws Error if used outside of AuthProvider
 */
export const useAuth = () => {
  const context = useContext(AuthContext);
  
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  
  return context;
};

/**
 * Higher-order component to protect routes that require authentication
 * 
 * @param Component The component to protect
 * @returns Protected component that redirects unauthenticated users
 */
export function withAuth<P extends object>(Component: React.ComponentType<P>) {
  return function ProtectedRoute(props: P) {
    const { isAuthenticated, isLoading } = useAuth();
    const router = useRouter();
    
    useEffect(() => {
      if (!isLoading && !isAuthenticated) {
        router.push('/auth/login');
      }
    }, [isAuthenticated, isLoading, router]);
    
    if (isLoading) {
      return <div>Loading...</div>; // Replace with your loading component
    }
    
    return isAuthenticated ? <Component {...props} /> : null;
  };
}
