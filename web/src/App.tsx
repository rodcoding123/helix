import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { AuthProvider } from '@/hooks/useAuth';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { AdminGuard } from '@/components/guards/AdminGuard';
import { Landing } from '@/pages/Landing';
import { Pricing } from '@/pages/Pricing';
import { Login } from '@/pages/Login';
import { Signup } from '@/pages/Signup';
import { CheckoutSuccess } from '@/pages/CheckoutSuccess';
import { CheckoutCancel } from '@/pages/CheckoutCancel';

// Lazy-loaded heavy components (code-split)
const Dashboard = lazy(() => import('@/pages/Dashboard').then(m => ({ default: m.Dashboard })));
const Observatory = lazy(() => import('@/pages/Observatory').then(m => ({ default: m.Observatory })));
const Code = lazy(() => import('@/pages/Code').then(m => ({ default: m.Code })));
const Research = lazy(() => import('@/pages/Research').then(m => ({ default: m.Research })));
const Settings = lazy(() => import('@/pages/Settings').then(m => ({ default: m.Settings })));
const Docs = lazy(() => import('@/pages/Docs').then(m => ({ default: m.Docs })));
const Agents = lazy(() => import('@/pages/Agents'));
const AutonomySettings = lazy(() => import('@/pages/AutonomySettings'));
const ActionApprovals = lazy(() => import('@/pages/ActionApprovals'));
const SecretsPage = lazy(() => import('@/pages/SecretsPage').then(m => ({ default: m.SecretsPage })));
const Voice = lazy(() => import('@/pages/Voice').then(m => ({ default: m.Voice })));
const Email = lazy(() => import('@/pages/Email').then(m => ({ default: m.Email })));
const Calendar = lazy(() => import('@/pages/Calendar').then(m => ({ default: m.CalendarPage })));
const Tasks = lazy(() => import('@/pages/Tasks').then(m => ({ default: m.TasksPage })));
const ControlPlane = lazy(() => import('@/pages/ControlPlane'));
const TenantSettings = lazy(() => import('@/pages/TenantSettings'));
const InvitationAccept = lazy(() => import('@/pages/InvitationAccept'));

// Loading fallback component
function LoadingFallback() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="h-8 w-8 rounded-full border-2 border-helix-500/30 border-t-helix-500 animate-spin mx-auto mb-3" />
        <p className="text-text-secondary text-sm">Loading...</p>
      </div>
    </div>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <div className="flex min-h-screen flex-col bg-slate-950 text-white">
          <Navbar />
          <main className="flex-1">
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/pricing" element={<Pricing />} />
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
              <Route path="/checkout/success" element={<CheckoutSuccess />} />
              <Route path="/checkout/cancel" element={<CheckoutCancel />} />
              <Route
                path="/observatory"
                element={
                  <Suspense fallback={<LoadingFallback />}>
                    <Observatory />
                  </Suspense>
                }
              />
              <Route
                path="/dashboard"
                element={
                  <Suspense fallback={<LoadingFallback />}>
                    <ProtectedRoute>
                      <Dashboard />
                    </ProtectedRoute>
                  </Suspense>
                }
              />
              <Route
                path="/code"
                element={
                  <Suspense fallback={<LoadingFallback />}>
                    <ProtectedRoute>
                      <Code />
                    </ProtectedRoute>
                  </Suspense>
                }
              />
              <Route
                path="/research"
                element={
                  <Suspense fallback={<LoadingFallback />}>
                    <ProtectedRoute>
                      <Research />
                    </ProtectedRoute>
                  </Suspense>
                }
              />
              <Route
                path="/settings"
                element={
                  <Suspense fallback={<LoadingFallback />}>
                    <ProtectedRoute>
                      <Settings />
                    </ProtectedRoute>
                  </Suspense>
                }
              />
              <Route
                path="/docs"
                element={
                  <Suspense fallback={<LoadingFallback />}>
                    <Docs />
                  </Suspense>
                }
              />
              <Route
                path="/agents"
                element={
                  <Suspense fallback={<LoadingFallback />}>
                    <ProtectedRoute>
                      <Agents />
                    </ProtectedRoute>
                  </Suspense>
                }
              />
              <Route
                path="/autonomy-settings"
                element={
                  <Suspense fallback={<LoadingFallback />}>
                    <ProtectedRoute>
                      <AutonomySettings />
                    </ProtectedRoute>
                  </Suspense>
                }
              />
              <Route
                path="/action-approvals"
                element={
                  <Suspense fallback={<LoadingFallback />}>
                    <ProtectedRoute>
                      <ActionApprovals />
                    </ProtectedRoute>
                  </Suspense>
                }
              />
              <Route
                path="/secrets"
                element={
                  <Suspense fallback={<LoadingFallback />}>
                    <ProtectedRoute>
                      <SecretsPage />
                    </ProtectedRoute>
                  </Suspense>
                }
              />
              <Route
                path="/voice"
                element={
                  <Suspense fallback={<LoadingFallback />}>
                    <ProtectedRoute>
                      <Voice />
                    </ProtectedRoute>
                  </Suspense>
                }
              />
              <Route
                path="/email"
                element={
                  <Suspense fallback={<LoadingFallback />}>
                    <ProtectedRoute>
                      <Email />
                    </ProtectedRoute>
                  </Suspense>
                }
              />
              <Route
                path="/calendar"
                element={
                  <Suspense fallback={<LoadingFallback />}>
                    <ProtectedRoute>
                      <Calendar />
                    </ProtectedRoute>
                  </Suspense>
                }
              />
              <Route
                path="/tasks"
                element={
                  <Suspense fallback={<LoadingFallback />}>
                    <ProtectedRoute>
                      <Tasks />
                    </ProtectedRoute>
                  </Suspense>
                }
              />
              <Route
                path="/control-plane"
                element={
                  <Suspense fallback={<LoadingFallback />}>
                    <ProtectedRoute>
                      <AdminGuard>
                        <ControlPlane />
                      </AdminGuard>
                    </ProtectedRoute>
                  </Suspense>
                }
              />
              <Route
                path="/accept"
                element={
                  <Suspense fallback={<LoadingFallback />}>
                    <InvitationAccept />
                  </Suspense>
                }
              />
              <Route
                path="/settings/tenants"
                element={
                  <Suspense fallback={<LoadingFallback />}>
                    <ProtectedRoute>
                      <TenantSettings />
                    </ProtectedRoute>
                  </Suspense>
                }
              />
            </Routes>
          </main>
          <Footer />
        </div>
      </AuthProvider>
    </BrowserRouter>
  );
}
