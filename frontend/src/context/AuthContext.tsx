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
  login: (correo: string, password: string) => Promise<'admin' | 'practicante' | 'usuario'>;
  logout: () => void;
  saveTratamientoDatos: () => Promise<void>;
  saveSociodemografico: (data: SociodemograficoPayload) => Promise<void>;
  saveConsentimiento: () => Promise<void>;
  setRegistrationStep: (step: number) => void;
  role: 'admin' | 'practicante' | 'usuario' | null;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'));
  const [isLoading, setIsLoading] = useState(true);
  const [registrationStep, setRegistrationStep] = useState(1);

  const isAuthenticated = !!token && !!user;
  const role = user?.role ?? null;

  // Check auth status on mount
  useEffect(() => {
    const checkAuth = async () => {
      const storedToken = localStorage.getItem('token');
      if (!storedToken) {
        setIsLoading(false);
        return;
      }
      try {
        try {
          const me = await api.getMe();
          setUser({
            role: me.user.role,
            correo: me.user.email,
            profileId: me.user.profileId,
            id: me.user.id,
          });
          setRegistrationStep(5);
          setToken(storedToken);
        } catch {
          const res = await api.checkStatus();
          const legacyUser = res.user as AuthUser;
          const detectedRole = legacyUser.role || 'usuario';
          setUser({
            ...legacyUser,
            role: detectedRole,
          });
          setRegistrationStep(detectedRole === 'admin' || detectedRole === 'practicante' ? 5 : res.registrationStep);
          setToken(storedToken);
        }
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
    const incomingUser = res.user as AuthUser;
    const normalizedRole = incomingUser.role || 'usuario';
    setUser({
      ...incomingUser,
      role: normalizedRole,
    });

    if (normalizedRole === 'usuario') {
      try {
        const status = await api.checkStatus();
        setRegistrationStep(status.registrationStep);
      } catch {
        setRegistrationStep(2);
      }
    } else {
      setRegistrationStep(5);
    }

    return normalizedRole;
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
        role,
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
