import { ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Navigate } from 'react-router-dom';
import { Loader2, Lock } from 'lucide-react';

interface AdminGuardProps {
  children: ReactNode;
  fallback?: ReactNode;
}

/**
 * AdminGuard - Protects routes from unauthorized access
 * Only allows users with admin role to pass through
 */
export function AdminGuard({ children, fallback }: AdminGuardProps) {
  const { user, loading } = useAuth();

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-helix-500 animate-spin mx-auto mb-4" />
          <p className="text-slate-400">Authenticating...</p>
        </div>
      </div>
    );
  }

  // Not authenticated
  if (!user) {
    return fallback || <Navigate to="/login" replace />;
  }

  // Check admin role
  // Supports multiple admin detection methods:
  // 1. user_metadata.admin_role === 'admin'
  // 2. user_metadata.is_admin === true
  // 3. Email ends with @helix.ai (for Rodrigo and other admins)
  const isAdmin =
    user.user_metadata?.admin_role === 'admin' ||
    user.user_metadata?.is_admin === true ||
    user.email?.endsWith('@helix.ai') ||
    false;

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center max-w-md">
          <Lock className="w-16 h-16 text-red-600 mx-auto mb-4" />
          <h1 className="text-4xl font-bold text-red-600 mb-4">Access Denied</h1>
          <p className="text-slate-300 mb-2">
            You don't have permission to access the Control Plane.
          </p>
          <p className="text-slate-500 text-sm mb-8">
            Only administrators can access this resource. Contact an administrator for access.
          </p>
          <a
            href="/"
            className="inline-block px-6 py-3 bg-helix-500 text-white rounded-lg hover:bg-helix-600 transition-colors font-medium"
          >
            Return to Dashboard
          </a>
        </div>
      </div>
    );
  }

  // Authorized admin
  return <>{children}</>;
}
