import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store';
import { User } from '@/types';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  loginWithBiometric: () => Promise<boolean>;
  logout: () => Promise<void>;
  updateUser: (userData: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_TOKEN_KEY = 'auth_token';
const USER_DATA_KEY = 'user_data';

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const isAuthenticated = user !== null;

  // Check for existing session on app start
  useEffect(() => {
    checkAuthState();
  }, []);

  const checkAuthState = async () => {
    try {
      const token = await SecureStore.getItemAsync(AUTH_TOKEN_KEY);
      const userData = await SecureStore.getItemAsync(USER_DATA_KEY);

      if (token && userData) {
        const parsedUser = JSON.parse(userData);
        setUser(parsedUser);
      }
    } catch (error) {
      console.log('Error checking auth state:', error);
      // Clear potentially corrupted data
      await clearAuthData();
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      setIsLoading(true);

      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));

      // For demo purposes, create a mock user
      const mockUser: User = {
        id: '1',
        name: 'Người dùng Demo',
        email: email,
        avatar: undefined,
        isPremium: false,
        createdAt: new Date(),
        preferences: {
          notifications: true,
          biometricAuth: true,
          language: 'vi',
          currency: 'VND',
        },
      };

      // Generate mock token
      const token = `mock_token_${Date.now()}`;

      // Store auth data securely
      await SecureStore.setItemAsync(AUTH_TOKEN_KEY, token);
      await SecureStore.setItemAsync(USER_DATA_KEY, JSON.stringify(mockUser));

      setUser(mockUser);
      return true;
    } catch (error) {
      console.log('Login error:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const loginWithBiometric = async (): Promise<boolean> => {
    try {
      setIsLoading(true);

      // Check if we have stored user data from previous login
      const userData = await SecureStore.getItemAsync(USER_DATA_KEY);
      
      if (userData) {
        const parsedUser = JSON.parse(userData);
        
        // Generate new token for biometric login
        const token = `biometric_token_${Date.now()}`;
        await SecureStore.setItemAsync(AUTH_TOKEN_KEY, token);
        
        setUser(parsedUser);
        return true;
      } else {
        // No previous user data, biometric login not possible
        return false;
      }
    } catch (error) {
      console.log('Biometric login error:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async (): Promise<void> => {
    try {
      setIsLoading(true);
      await clearAuthData();
      setUser(null);
    } catch (error) {
      console.log('Logout error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const clearAuthData = async () => {
    try {
      await SecureStore.deleteItemAsync(AUTH_TOKEN_KEY);
      await SecureStore.deleteItemAsync(USER_DATA_KEY);
    } catch (error) {
      console.log('Error clearing auth data:', error);
    }
  };

  const updateUser = (userData: Partial<User>) => {
    if (user) {
      const updatedUser = { ...user, ...userData };
      setUser(updatedUser);
      
      // Update stored user data
      SecureStore.setItemAsync(USER_DATA_KEY, JSON.stringify(updatedUser))
        .catch(error => console.log('Error updating stored user data:', error));
    }
  };

  const value: AuthContextType = {
    user,
    isAuthenticated,
    isLoading,
    login,
    loginWithBiometric,
    logout,
    updateUser,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}