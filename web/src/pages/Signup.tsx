import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff, AlertCircle, Loader2, Check } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { PRICING_TIERS } from '@/lib/types';

export function Signup() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { signUp } = useAuth();

  const selectedTierId = searchParams.get('tier') || 'free';
  const selectedTier = PRICING_TIERS.find(t => t.id === selectedTierId) || PRICING_TIERS[0];

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const passwordRequirements = [
    { met: password.length >= 8, text: 'At least 8 characters' },
    { met: /[A-Z]/.test(password), text: 'One uppercase letter' },
    { met: /[a-z]/.test(password), text: 'One lowercase letter' },
    { met: /[0-9]/.test(password), text: 'One number' },
  ];

  const allRequirementsMet = passwordRequirements.every(r => r.met);
  const passwordsMatch = password === confirmPassword && confirmPassword.length > 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!allRequirementsMet) {
      setError('Please meet all password requirements');
      return;
    }

    if (!passwordsMatch) {
      setError('Passwords do not match');
      return;
    }

    setIsLoading(true);

    try {
      const { error: signUpError } = await signUp(email, password);
      if (signUpError) {
        setError(signUpError.message);
      } else {
        setSuccess(true);
      }
    } catch {
      setError('An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  }

  if (success) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12">
        <div className="w-full max-w-md text-center">
          <div className="mx-auto mb-6 inline-flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/20">
            <Check className="h-8 w-8 text-emerald-500" />
          </div>
          <h1 className="text-3xl font-bold text-white">Check Your Email</h1>
          <p className="mt-4 text-slate-400">
            We've sent a confirmation link to <strong className="text-white">{email}</strong>. Click
            the link to activate your account.
          </p>
          <button onClick={() => navigate('/login')} className="btn btn-primary mt-8">
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-white">Create Account</h1>
          <p className="mt-2 text-slate-400">Join the Helix Observatory research platform</p>
        </div>

        {/* Selected Plan */}
        <div className="mt-6 rounded-lg border border-helix-500/30 bg-helix-500/10 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-400">Selected plan</p>
              <p className="font-semibold text-white">{selectedTier.name}</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-white">
                ${selectedTier.price}
                <span className="text-sm text-slate-400">/{selectedTier.interval}</span>
              </p>
            </div>
          </div>
          <Link
            to="/pricing"
            className="mt-3 block text-center text-sm text-helix-400 hover:text-helix-300"
          >
            Change plan
          </Link>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 space-y-6">
          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-300">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="mt-1 block w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 text-white placeholder-slate-500 focus:border-helix-500 focus:outline-none focus:ring-1 focus:ring-helix-500"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-300">
                Password
              </label>
              <div className="relative mt-1">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  className="block w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 pr-12 text-white placeholder-slate-500 focus:border-helix-500 focus:outline-none focus:ring-1 focus:ring-helix-500"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              {/* Password Requirements */}
              <div className="mt-3 space-y-2">
                {passwordRequirements.map(req => (
                  <div
                    key={req.text}
                    className={`flex items-center gap-2 text-xs ${
                      req.met ? 'text-emerald-500' : 'text-slate-500'
                    }`}
                  >
                    <Check className={`h-3 w-3 ${req.met ? 'opacity-100' : 'opacity-30'}`} />
                    {req.text}
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-300">
                Confirm Password
              </label>
              <input
                id="confirmPassword"
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                required
                autoComplete="new-password"
                className={`mt-1 block w-full rounded-lg border bg-slate-900 px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-1 ${
                  confirmPassword.length > 0
                    ? passwordsMatch
                      ? 'border-emerald-500 focus:border-emerald-500 focus:ring-emerald-500'
                      : 'border-red-500 focus:border-red-500 focus:ring-red-500'
                    : 'border-slate-700 focus:border-helix-500 focus:ring-helix-500'
                }`}
                placeholder="••••••••"
              />
            </div>
          </div>

          <div className="flex items-start gap-2">
            <input
              id="terms"
              type="checkbox"
              required
              className="mt-1 h-4 w-4 rounded border-slate-700 bg-slate-900 text-helix-500 focus:ring-helix-500"
            />
            <label htmlFor="terms" className="text-sm text-slate-400">
              I agree to the{' '}
              <Link to="/terms" className="text-helix-400 hover:text-helix-300">
                Terms of Service
              </Link>{' '}
              and{' '}
              <Link to="/privacy" className="text-helix-400 hover:text-helix-300">
                Privacy Policy
              </Link>
            </label>
          </div>

          <button
            type="submit"
            disabled={isLoading || !allRequirementsMet}
            className="btn btn-primary w-full justify-center py-3 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Create Account'}
          </button>

          <p className="text-center text-sm text-slate-400">
            Already have an account?{' '}
            <Link to="/login" className="text-helix-400 hover:text-helix-300">
              Sign in
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
