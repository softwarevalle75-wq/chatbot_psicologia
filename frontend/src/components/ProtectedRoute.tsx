import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import type { ReactNode } from 'react';

interface ProtectedRouteProps {
  children: ReactNode;
}

/**
 * Routes user to the correct registration step if they haven't completed all 4 steps.
 * registrationStep: 1 = needs registration, 2 = needs data treatment, 
 * 3 = needs sociodemographic, 4 = needs consent, 5 = all done.
 */
export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, registrationStep } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen w-screen bg-gradient-to-br from-blue-400 via-blue-500 to-indigo-400">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-white/30 border-t-white rounded-full animate-spin" />
          <span className="text-white font-medium text-sm">Cargando...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Redirect to the appropriate registration step
  const stepRoutes: Record<number, string> = {
    2: '/registro/tratamiento-datos',
    3: '/registro/sociodemografico',
    4: '/registro/consentimiento',
  };

  if (registrationStep < 5 && stepRoutes[registrationStep]) {
    return <Navigate to={stepRoutes[registrationStep]} replace />;
  }

  return <>{children}</>;
}
