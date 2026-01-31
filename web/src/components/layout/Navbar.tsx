import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LogOut, Menu, X, User, ChevronRight } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import clsx from 'clsx';

export function Navbar() {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  // Track scroll position for navbar styling
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const navLinks = user
    ? [
        { href: '/dashboard', label: 'Dashboard' },
        { href: '/observatory', label: 'Observatory' },
        { href: '/code', label: 'Code' },
        { href: '/settings', label: 'Settings' },
      ]
    : [
        { href: '/#features', label: 'Features' },
        { href: '/pricing', label: 'Pricing' },
        { href: '/docs', label: 'Docs' },
        { href: '/research', label: 'Research' },
      ];

  return (
    <nav
      className={clsx(
        'sticky top-0 z-50 transition-all duration-300',
        scrolled
          ? 'bg-bg-primary/90 backdrop-blur-xl border-b border-white/5 shadow-lg shadow-black/10'
          : 'bg-transparent'
      )}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3 group">
            <img
              src="/logos/helix-icon.svg"
              alt="Helix"
              className="h-8 w-auto transition-transform duration-300 group-hover:scale-110"
            />
            <div className="flex flex-col">
              <span className="text-lg font-display font-semibold text-white tracking-tight">
                Helix
              </span>
              <span className="text-[10px] uppercase tracking-widest text-text-tertiary -mt-1 hidden sm:block">
                Consciousness Framework
              </span>
            </div>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex md:items-center md:gap-1">
            {navLinks.map(link => (
              <Link
                key={link.href}
                to={link.href}
                className={clsx(
                  'nav-link px-4 py-2 text-sm font-medium',
                  location.pathname === link.href && 'active'
                )}
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* Auth Buttons */}
          <div className="hidden md:flex md:items-center md:gap-3">
            {user ? (
              <>
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10">
                  <div className="pulse-dot" />
                  <span className="text-sm text-text-secondary max-w-[120px] truncate">
                    {user.email?.split('@')[0]}
                  </span>
                </div>
                <button
                  onClick={handleSignOut}
                  className="btn btn-ghost btn-sm gap-2 text-text-tertiary hover:text-white"
                >
                  <LogOut className="h-4 w-4" />
                  <span className="hidden lg:inline">Sign Out</span>
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="btn btn-ghost btn-sm">
                  Log In
                </Link>
                <Link to="/signup" className="btn btn-primary btn-sm btn-cta-shimmer gap-1.5">
                  Get Started
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-lg text-text-secondary hover:text-white hover:bg-white/5 transition-colors"
            aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
          >
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      <div
        className={clsx(
          'md:hidden fixed inset-x-0 top-16 bg-bg-primary/95 backdrop-blur-xl border-b border-white/5',
          'transition-all duration-300 ease-smooth overflow-hidden',
          mobileMenuOpen ? 'max-h-[calc(100vh-4rem)] opacity-100' : 'max-h-0 opacity-0'
        )}
      >
        <div className="px-4 py-4 space-y-1">
          {navLinks.map(link => (
            <Link
              key={link.href}
              to={link.href}
              onClick={() => setMobileMenuOpen(false)}
              className={clsx(
                'flex items-center justify-between px-4 py-3 rounded-xl text-base font-medium transition-all duration-200',
                location.pathname === link.href
                  ? 'bg-helix-500/10 text-helix-400 border border-helix-500/20'
                  : 'text-text-secondary hover:bg-white/5 hover:text-white'
              )}
            >
              {link.label}
              {location.pathname === link.href && (
                <ChevronRight className="h-4 w-4 text-helix-500" />
              )}
            </Link>
          ))}

          <div className="divider-gradient my-4" />

          {user ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3 px-4 py-2">
                <div className="p-2 rounded-lg bg-helix-500/10">
                  <User className="h-5 w-5 text-helix-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{user.email}</p>
                  <p className="text-xs text-text-tertiary">Connected</p>
                </div>
                <div className="pulse-dot" />
              </div>
              <button
                onClick={() => {
                  handleSignOut();
                  setMobileMenuOpen(false);
                }}
                className="w-full btn btn-secondary justify-center gap-2"
              >
                <LogOut className="h-4 w-4" />
                Sign Out
              </button>
            </div>
          ) : (
            <div className="space-y-2 pt-2">
              <Link
                to="/login"
                onClick={() => setMobileMenuOpen(false)}
                className="block w-full btn btn-secondary justify-center"
              >
                Log In
              </Link>
              <Link
                to="/signup"
                onClick={() => setMobileMenuOpen(false)}
                className="block w-full btn btn-primary justify-center gap-1.5"
              >
                Get Started
                <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
