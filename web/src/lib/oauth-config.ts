/**
 * OAuth PKCE Configuration
 * Platform-aware redirect URL generation for Supabase Auth
 */

export type OAuthPlatform = 'web' | 'desktop' | 'cli';
export type OAuthProvider = 'github' | 'google';

/**
 * Get the OAuth redirect URL for the current platform
 */
export function getOAuthRedirectUrl(platform: OAuthPlatform = 'web'): string {
  switch (platform) {
    case 'web':
      return `${window.location.origin}/auth/callback`;
    case 'desktop':
      return 'helix://auth/callback';
    case 'cli':
      // CLI starts a temporary HTTP server on a random port
      // This is a placeholder - actual port is determined at runtime
      return 'http://127.0.0.1:0/auth/callback';
  }
}

/**
 * Available OAuth providers
 */
export const OAUTH_PROVIDERS: Array<{
  id: OAuthProvider;
  name: string;
  icon: string;
}> = [
  { id: 'github', name: 'GitHub', icon: 'github' },
  { id: 'google', name: 'Google', icon: 'google' },
];
