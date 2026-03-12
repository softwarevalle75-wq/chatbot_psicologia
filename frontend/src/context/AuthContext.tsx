import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import type { AuthUser } from '../types';
import { api } from '../services/api';
import type { RegisterPayload, SociodemograficoPayload } from '../services/api';

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  registrationStep: number;
  register: (data: RegisterPayload) => Promise<void>;
  login: (correo: string, password: string) => Promise<void>;
  logout: () => void;
  saveTratamientoDatos: () => Promise<void>;
  saveSociodemografico: (data: SociodemograficoPayload) => Promise<void>;
  saveConsentimiento: () => Promise<void>;
  setRegistrationStep: (step: number) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'));
  const [isLoading, setIsLoading] = useState(true);
  const [registrationStep, setRegistrationStep] = useState(1);

  const isAuthenticated = !!token && !!user;

  // Check auth status on mount
  useEffect(() => {
    const checkAuth = async () => {
      const storedToken = localStorage.getItem('token');
      if (!storedToken) {
        setIsLoading(false);
        return;
      }
      try {
        const res = await api.checkStatus();
        setUser(res.user as AuthUser);
        setRegistrationStep(res.registrationStep);
        setToken(storedToken);
      } catch {
        localStorage.removeItem('token');
        setToken(null);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };
    checkAuth();
  }, []);

  const register = useCallback(async (data: RegisterPayload) => {
    const res = await api.register(data);
    localStorage.setItem('token', res.token);
    setToken(res.token);
    setUser(res.user as AuthUser);
    setRegistrationStep(2);
  }, []);

  const login = useCallback(async (correo: string, password: string) => {
    const res = await api.login(correo, password);
    localStorage.setItem('token', res.token);
    setToken(res.token);
    setUser(res.user as AuthUser);
    // After login, check which step they need to complete
    try {
      const status = await api.checkStatus();
      setRegistrationStep(status.registrationStep);
    } catch {
      setRegistrationStep(2);
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
    setRegistrationStep(1);
  }, []);

  const saveTratamientoDatos = useCallback(async () => {
    if (!user) return;
    await api.saveTratamientoDatos();
    setUser((prev) => prev ? { ...prev, autorizacionDatos: 'si' } : prev);
    setRegistrationStep(3);
  }, [user]);

  const saveSociodemografico = useCallback(async (data: SociodemograficoPayload) => {
    if (!user) return;
    await api.saveSociodemografico(data);
    setRegistrationStep(4);
  }, [user]);

  const saveConsentimiento = useCallback(async () => {
    if (!user) return;
    await api.saveConsentimiento();
    setUser((prev) => prev ? { ...prev, consentimientoInformado: 'si' } : prev);
    setRegistrationStep(5);
  }, [user]);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated,
        isLoading,
        registrationStep,
        register,
        login,
        logout,
        saveTratamientoDatos,
        saveSociodemografico,
        saveConsentimiento,
        setRegistrationStep,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
