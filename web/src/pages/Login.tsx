import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Eye, EyeOff, AlertCircle, Loader2, ArrowLeft } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { getCloudChatClient } from '@/lib/cloud-chat-client';

export function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { signIn } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const from = (location.state as { from?: Location })?.from?.pathname || '/dashboard';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const { error: signInError } = await signIn(email, password);
      if (signInError) {
        setError(signInError.message);
      } else {
        // Check onboarding status to determine redirect destination
        const localComplete = localStorage.getItem('helix_cloud_onboarding_complete') === 'true';
        if (localComplete) {
          navigate(from, { replace: true });
        } else {
          try {
            const profile = await getCloudChatClient().getProfile();
            if (profile?.onboardingCompleted) {
              localStorage.setItem('helix_cloud_onboarding_complete', 'true');
              navigate(from, { replace: true });
            } else {
              navigate('/welcome', { replace: true });
            }
          } catch {
            // On error, go to intended destination
            navigate(from, { replace: true });
          }
        }
      }
    } catch {
      setError('An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center px-4 py-12">
      {/* Background */}
      <div className="absolute inset-0 -z-10">
        <div className="gradient-orb gradient-orb-blue w-[500px] h-[500px] -top-40 -right-40 opacity-30" />
        <div className="gradient-orb gradient-orb-purple w-[400px] h-[400px] -bottom-40 -left-40 opacity-30" />
      </div>

      {/* Back to home */}
      <Link
        to="/"
        className="absolute top-8 left-8 flex items-center gap-2 text-sm text-text-secondary hover:text-white transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to home
      </Link>

      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-3">
            <img src="/logos/helix-icon.svg" alt="Helix" className="h-10 w-auto" />
            <span className="text-2xl font-display font-bold text-white">Helix</span>
          </Link>
        </div>

        {/* Card */}
        <div className="card-glass p-8">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-display font-bold text-white">Welcome Back</h1>
            <p className="mt-2 text-text-secondary">Sign in to access your Helix dashboard</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="flex items-center gap-2 rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label htmlFor="email" className="label">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="input"
                  placeholder="you@example.com"
                />
              </div>

              <div>
                <label htmlFor="password" className="label">
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    className="input pr-12"
                    placeholder="Enter your password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-white transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-white/20 bg-bg-tertiary text-helix-500 focus:ring-helix-500/50"
                />
                <span className="text-sm text-text-secondary">Remember me</span>
              </label>
              <Link
                to="/forgot-password"
                className="text-sm text-helix-400 hover:text-helix-300 transition-colors"
              >
                Forgot password?
              </Link>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="btn btn-cta btn-cta-shimmer w-full justify-center py-3 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Sign In'}
            </button>
          </form>

          <div className="divider-gradient my-6" />

          <p className="text-center text-sm text-text-secondary">
            Don't have an account?{' '}
            <Link
              to="/signup"
              className="text-helix-400 hover:text-helix-300 font-medium transition-colors"
            >
              Sign up free
            </Link>
          </p>
        </div>

        {/* Footer text */}
        <p className="mt-8 text-center text-xs text-text-tertiary">
          By signing in, you agree to our{' '}
          <Link to="/terms" className="text-text-secondary hover:text-white transition-colors">
            Terms of Service
          </Link>{' '}
          and{' '}
          <Link to="/privacy" className="text-text-secondary hover:text-white transition-colors">
            Privacy Policy
          </Link>
        </p>
      </div>
    </div>
  );
}
