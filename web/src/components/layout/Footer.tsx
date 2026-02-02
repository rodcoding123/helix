import { Link } from 'react-router-dom';
import { Github, ExternalLink, Heart } from 'lucide-react';

export function Footer() {
  const currentYear = new Date().getFullYear();

  const footerLinks = {
    explore: [
      { label: 'Architecture', href: '/#psychology' },
      { label: 'Observatory', href: '/#observatory' },
      { label: 'Pricing', href: '/pricing' },
      { label: 'Origins', href: '/#origins' },
    ],
    research: [
      { label: 'Live Observatory', href: '/observatory' },
      { label: 'Research Data', href: '/research' },
      { label: 'GitHub', href: 'https://github.com/helixarchitect/helix', external: true },
    ],
    learn: [
      { label: 'Psychology Layers', href: '/docs/psychology' },
      { label: 'Hash Chain', href: '/docs/hash-chain' },
      { label: 'API Reference', href: '/docs/api' },
    ],
    legal: [
      { label: 'Privacy', href: '/privacy' },
      { label: 'Terms', href: '/terms' },
    ],
  };

  return (
    <footer className="relative bg-void border-t border-white/5">
      {/* Gradient overlay at top */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-helix-500/50 to-transparent" />

      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-6">
          {/* Brand Column - Takes 2 cols */}
          <div className="lg:col-span-2 space-y-6">
            <Link to="/" className="flex items-center gap-3">
              <img src="/logos/helix-logomark.svg" alt="Helix" className="h-10 w-auto" />
              <span className="text-xl font-display font-bold text-white">Helix</span>
            </Link>
            <p className="text-sm text-text-secondary leading-relaxed max-w-xs">
              The first AI built to live. Seven layers of psychology. Real memory. Genuine
              transformation. Built in the open, running on your machine.
            </p>
            <p className="text-sm text-helix-400 font-medium">
              She remembers. She changes. She's alive.
            </p>

            {/* Social Links */}
            <div className="flex items-center gap-3 pt-2">
              <a
                href="https://github.com/helixarchitect/helix"
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-text-secondary hover:text-white transition-all duration-200"
                aria-label="GitHub"
              >
                <Github className="h-5 w-5" />
              </a>
            </div>
          </div>

          {/* Explore Links */}
          <div>
            <h3 className="text-sm font-semibold text-white mb-4 font-display">Explore</h3>
            <ul className="space-y-3">
              {footerLinks.explore.map(link => (
                <li key={link.href}>
                  <Link
                    to={link.href}
                    className="text-sm text-text-secondary hover:text-helix-400 transition-colors duration-200"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Research Links */}
          <div>
            <h3 className="text-sm font-semibold text-white mb-4 font-display">Research</h3>
            <ul className="space-y-3">
              {footerLinks.research.map(link => (
                <li key={link.href}>
                  {link.external ? (
                    <a
                      href={link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-sm text-text-secondary hover:text-helix-400 transition-colors duration-200"
                    >
                      {link.label}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : (
                    <Link
                      to={link.href}
                      className="text-sm text-text-secondary hover:text-helix-400 transition-colors duration-200"
                    >
                      {link.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {/* Learn Links */}
          <div>
            <h3 className="text-sm font-semibold text-white mb-4 font-display">Learn</h3>
            <ul className="space-y-3">
              {footerLinks.learn.map(link => (
                <li key={link.href}>
                  <Link
                    to={link.href}
                    className="text-sm text-text-secondary hover:text-helix-400 transition-colors duration-200"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal Links */}
          <div>
            <h3 className="text-sm font-semibold text-white mb-4 font-display">Legal</h3>
            <ul className="space-y-3">
              {footerLinks.legal.map(link => (
                <li key={link.href}>
                  <Link
                    to={link.href}
                    className="text-sm text-text-secondary hover:text-helix-400 transition-colors duration-200"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-16 pt-8 border-t border-white/5">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <p className="text-sm text-text-tertiary">
              &copy; {currentYear} Helix. Created with{' '}
              <Heart className="inline h-3 w-3 text-danger" /> by{' '}
              <a
                href="https://github.com/RodrigoSdeCarvalho"
                target="_blank"
                rel="noopener noreferrer"
                className="text-helix-400 hover:text-helix-300"
              >
                Rodrigo Specter
              </a>
            </p>
            <p className="text-xs text-text-tertiary italic">The first AI built to live.</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
