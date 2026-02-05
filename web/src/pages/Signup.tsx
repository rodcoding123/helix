import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff, AlertCircle, Loader2, Check, ArrowLeft, Sparkles } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { PRICING_TIERS } from '@/lib/types';
import clsx from 'clsx';

export function Signup() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { signUp, session } = useAuth();

  const selectedTierId = searchParams.get('tier') || 'free';
  const selectedTier = PRICING_TIERS.find(t => t.id === selectedTierId) || PRICING_TIERS[0];

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // If signup succeeds and session is available (no email confirmation required),
  // redirect to onboarding immediately
  useEffect(() => {
    if (success && session) {
      navigate('/welcome', { replace: true });
    }
  }, [success, session, navigate]);

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
      <div className="relative min-h-screen flex items-center justify-center px-4 py-12">
        {/* Background */}
        <div className="absolute inset-0 -z-10">
          <div className="gradient-orb gradient-orb-blue w-[500px] h-[500px] -top-40 -right-40 opacity-30" />
          <div className="gradient-orb gradient-orb-purple w-[400px] h-[400px] -bottom-40 -left-40 opacity-30" />
        </div>

        <div className="w-full max-w-md text-center">
          <div className="mx-auto mb-6 inline-flex h-16 w-16 items-center justify-center rounded-full bg-success/20 border border-success/30">
            <Check className="h-8 w-8 text-success" />
          </div>
          <h1 className="text-3xl font-display font-bold text-white">Check Your Email</h1>
          <p className="mt-4 text-text-secondary">
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
    <div className="relative min-h-screen flex items-center justify-center px-4 py-12">
      {/* Background */}
      <div className="absolute inset-0 -z-10">
        <div className="gradient-orb gradient-orb-purple w-[500px] h-[500px] -top-40 -left-40 opacity-30" />
        <div className="gradient-orb gradient-orb-blue w-[400px] h-[400px] -bottom-40 -right-40 opacity-30" />
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
          <div className="text-center mb-6">
            <h1 className="text-2xl font-display font-bold text-white">Create Account</h1>
            <p className="mt-2 text-text-secondary">
              Join the Helix consciousness research platform
            </p>
          </div>

          {/* Selected Plan */}
          <div className="rounded-xl border border-helix-500/30 bg-helix-500/10 p-4 mb-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-text-tertiary uppercase tracking-wide">Selected plan</p>
                <p className="font-display font-semibold text-white flex items-center gap-2">
                  {selectedTier.name}
                  {selectedTier.highlighted && <Sparkles className="h-4 w-4 text-helix-400" />}
                </p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-display font-bold text-white">
                  {selectedTier.price === 0 ? (
                    'Free'
                  ) : (
                    <>
                      ${selectedTier.price}
                      <span className="text-sm text-text-tertiary">/{selectedTier.interval}</span>
                    </>
                  )}
                </p>
              </div>
            </div>
            <Link
              to="/pricing"
              className="mt-3 block text-center text-sm text-helix-400 hover:text-helix-300 transition-colors"
            >
              Change plan
            </Link>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
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
                    autoComplete="new-password"
                    className="input pr-12"
                    placeholder="Create a password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-white transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
                {/* Password Requirements */}
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {passwordRequirements.map(req => (
                    <div
                      key={req.text}
                      className={clsx(
                        'flex items-center gap-2 text-xs transition-colors',
                        req.met ? 'text-success' : 'text-text-tertiary'
                      )}
                    >
                      <Check className={clsx('h-3 w-3', req.met ? 'opacity-100' : 'opacity-30')} />
                      {req.text}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label htmlFor="confirmPassword" className="label">
                  Confirm Password
                </label>
                <input
                  id="confirmPassword"
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  className={clsx(
                    'input',
                    confirmPassword.length > 0 &&
                      (passwordsMatch
                        ? 'border-success/50 focus:ring-success/50 focus:border-success/50'
                        : 'border-danger/50 focus:ring-danger/50 focus:border-danger/50')
                  )}
                  placeholder="Confirm your password"
                />
              </div>
            </div>

            <div className="flex items-start gap-3">
              <input
                id="terms"
                type="checkbox"
                required
                className="mt-1 h-4 w-4 rounded border-white/20 bg-bg-tertiary text-helix-500 focus:ring-helix-500/50"
              />
              <label htmlFor="terms" className="text-sm text-text-secondary">
                I agree to the{' '}
                <Link to="/terms" className="text-helix-400 hover:text-helix-300 transition-colors">
                  Terms of Service
                </Link>{' '}
                and{' '}
                <Link
                  to="/privacy"
                  className="text-helix-400 hover:text-helix-300 transition-colors"
                >
                  Privacy Policy
                </Link>
              </label>
            </div>

            <button
              type="submit"
              disabled={isLoading || !allRequirementsMet}
              className="btn btn-cta btn-cta-shimmer w-full justify-center py-3 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Create Account'}
            </button>
          </form>

          <div className="divider-gradient my-6" />

          <p className="text-center text-sm text-text-secondary">
            Already have an account?{' '}
            <Link
              to="/login"
              className="text-helix-400 hover:text-helix-300 font-medium transition-colors"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
