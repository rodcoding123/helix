/**
 * Security Headers Middleware
 * MEDIUM FIX 4.1: Add CORS, CSP, X-Frame-Options and other security headers
 * Implements OWASP recommendations for API security
 */

export interface SecurityHeadersOptions {
  // CORS
  allowedOrigins?: string[];
  allowedMethods?: string[];
  allowedHeaders?: string[];
  credentials?: boolean;
  maxAge?: number;

  // CSP
  scriptSrc?: string[];
  styleSrc?: string[];
  imgSrc?: string[];
  connectSrc?: string[];
  frameSrc?: string[];
  fontSrc?: string[];

  // Other headers
  hstsMaxAge?: number;
  enableFrameOptions?: boolean;
  enableXssProtection?: boolean;
  enableContentTypeSniffing?: boolean;
}

const DEFAULT_OPTIONS: SecurityHeadersOptions = {
  // CORS
  allowedOrigins: [
    'http://localhost:5173', // dev
    'http://localhost:3000', // dev
    'https://helix-project.org',
    'https://observatory.helix-project.org',
  ],
  allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true,
  maxAge: 86400, // 24 hours

  // CSP
  scriptSrc: ["'self'", "'unsafe-inline'"], // Adjust for production
  styleSrc: ["'self'", "'unsafe-inline'"],
  imgSrc: ["'self'", 'https:'],
  connectSrc: ["'self'", 'https://api.supabase.co', 'wss://'],
  frameSrc: ["'none'"],
  fontSrc: ["'self'"],

  // Other headers
  hstsMaxAge: 31536000, // 1 year
  enableFrameOptions: true,
  enableXssProtection: true,
  enableContentTypeSniffing: false,
};

/**
 * Build CSP header value
 */
function buildCSP(options: SecurityHeadersOptions): string {
  const directives: string[] = [];

  if (options.scriptSrc) {
    directives.push(`script-src ${options.scriptSrc.join(' ')}`);
  }
  if (options.styleSrc) {
    directives.push(`style-src ${options.styleSrc.join(' ')}`);
  }
  if (options.imgSrc) {
    directives.push(`img-src ${options.imgSrc.join(' ')}`);
  }
  if (options.connectSrc) {
    directives.push(`connect-src ${options.connectSrc.join(' ')}`);
  }
  if (options.frameSrc) {
    directives.push(`frame-src ${options.frameSrc.join(' ')}`);
  }
  if (options.fontSrc) {
    directives.push(`font-src ${options.fontSrc.join(' ')}`);
  }

  // Default to 'self' for unspecified directives
  directives.push("default-src 'self'");

  return directives.join('; ');
}

/**
 * Build CORS headers
 */
function buildCORSHeaders(
  origin: string | undefined,
  options: SecurityHeadersOptions
): Record<string, string> {
  const headers: Record<string, string> = {};

  // Check if origin is allowed
  if (origin && options.allowedOrigins?.includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
  }

  if (options.allowedMethods) {
    headers['Access-Control-Allow-Methods'] = options.allowedMethods.join(', ');
  }

  if (options.allowedHeaders) {
    headers['Access-Control-Allow-Headers'] = options.allowedHeaders.join(', ');
  }

  if (options.credentials) {
    headers['Access-Control-Allow-Credentials'] = 'true';
  }

  if (options.maxAge) {
    headers['Access-Control-Max-Age'] = String(options.maxAge);
  }

  return headers;
}

/**
 * Express/Fastify middleware for security headers
 */
export function securityHeadersMiddleware(customOptions?: Partial<SecurityHeadersOptions>) {
  const options = { ...DEFAULT_OPTIONS, ...customOptions };

  return (
    req: { headers: { origin?: string } },
    res: { setHeader: (key: string, value: string) => void; removeHeader: (key: string) => void },
    next: () => void
  ): void => {
    const origin = req.headers.origin;

    // CORS headers
    const corsHeaders = buildCORSHeaders(origin, options);
    Object.entries(corsHeaders).forEach(([key, value]) => {
      res.setHeader(key, value);
    });

    // Content Security Policy
    res.setHeader('Content-Security-Policy', buildCSP(options));

    // X-Frame-Options: Prevent clickjacking
    if (options.enableFrameOptions) {
      res.setHeader('X-Frame-Options', 'DENY');
    }

    // X-Content-Type-Options: Prevent MIME sniffing
    if (!options.enableContentTypeSniffing) {
      res.setHeader('X-Content-Type-Options', 'nosniff');
    }

    // X-XSS-Protection: Prevent XSS
    if (options.enableXssProtection) {
      res.setHeader('X-XSS-Protection', '1; mode=block');
    }

    // Strict-Transport-Security: HTTPS only
    if (options.hstsMaxAge) {
      res.setHeader(
        'Strict-Transport-Security',
        `max-age=${options.hstsMaxAge}; includeSubDomains`
      );
    }

    // Referrer-Policy: Control referrer information
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

    // Permissions-Policy: Control browser features
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=(), payment=()');

    // Remove server header
    res.removeHeader('Server');

    next();
  };
}

/**
 * Supabase Edge Function helper for security headers
 */
export function addSecurityHeaders(
  response: Response,
  options?: Partial<SecurityHeadersOptions>
): Response {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const headers = new Headers(response.headers);

  // CSP
  headers.set('Content-Security-Policy', buildCSP(opts));

  // X-Frame-Options
  if (opts.enableFrameOptions) {
    headers.set('X-Frame-Options', 'DENY');
  }

  // X-Content-Type-Options
  if (!opts.enableContentTypeSniffing) {
    headers.set('X-Content-Type-Options', 'nosniff');
  }

  // X-XSS-Protection
  if (opts.enableXssProtection) {
    headers.set('X-XSS-Protection', '1; mode=block');
  }

  // HSTS
  if (opts.hstsMaxAge) {
    headers.set('Strict-Transport-Security', `max-age=${opts.hstsMaxAge}; includeSubDomains`);
  }

  // Referrer-Policy
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Permissions-Policy
  headers.set('Permissions-Policy', 'geolocation=(), microphone=(), camera=(), payment=()');

  // CORS for Edge Functions
  const origin = response.headers.get('origin');
  if (origin && opts.allowedOrigins?.includes(origin)) {
    headers.set('Access-Control-Allow-Origin', origin);
    headers.set('Access-Control-Allow-Credentials', 'true');
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
