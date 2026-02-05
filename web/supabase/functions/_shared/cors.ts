/**
 * Shared CORS Configuration for Supabase Edge Functions
 *
 * SECURITY: Restricts origins to known Helix domains only.
 * Uses ALLOWED_ORIGINS env var for flexibility in different environments.
 */

/**
 * Default allowed origins for production
 * Add new domains here as needed
 */
const DEFAULT_ALLOWED_ORIGINS = [
  // Production domains
  'https://helix-project.org',
  'https://www.helix-project.org',
  'https://observatory.helix-project.org',
  'https://app.helix-project.org',
  // Supabase hosted
  'https://helix-observatory.vercel.app',
  // Development
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
  'http://127.0.0.1:3000',
];

/**
 * Get allowed origins from environment or use defaults
 */
function getAllowedOrigins(): string[] {
  const envOrigins = Deno.env.get('ALLOWED_ORIGINS');
  if (envOrigins) {
    return envOrigins.split(',').map(o => o.trim()).filter(Boolean);
  }
  return DEFAULT_ALLOWED_ORIGINS;
}

/**
 * Check if an origin is allowed
 */
export function isOriginAllowed(origin: string | null): boolean {
  if (!origin) return false;

  const allowed = getAllowedOrigins();
  return allowed.includes(origin);
}

/**
 * Get CORS headers for a request
 * Returns appropriate headers based on the request's Origin
 */
export function getCorsHeaders(req: Request, additionalHeaders: string[] = []): Record<string, string> {
  const origin = req.headers.get('origin');
  const baseHeaders = [
    'authorization',
    'x-client-info',
    'apikey',
    'content-type',
    ...additionalHeaders,
  ];

  // Only set Access-Control-Allow-Origin if origin is allowed
  if (origin && isOriginAllowed(origin)) {
    return {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Headers': baseHeaders.join(', '),
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Max-Age': '86400', // 24 hours
    };
  }

  // For disallowed origins, don't set CORS headers
  // The browser will block the request
  return {
    'Access-Control-Allow-Headers': baseHeaders.join(', '),
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  };
}

/**
 * Handle CORS preflight request
 */
export function handleCorsPreflightRequest(req: Request, additionalHeaders: string[] = []): Response {
  const corsHeaders = getCorsHeaders(req, additionalHeaders);
  return new Response('ok', { headers: corsHeaders });
}

/**
 * Create a JSON response with CORS headers
 */
export function corsJsonResponse(
  req: Request,
  body: unknown,
  status: number = 200,
  additionalHeaders: string[] = []
): Response {
  const corsHeaders = getCorsHeaders(req, additionalHeaders);
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

/**
 * Create an error response with CORS headers
 */
export function corsErrorResponse(
  req: Request,
  error: string,
  status: number = 500,
  additionalHeaders: string[] = []
): Response {
  return corsJsonResponse(req, { error }, status, additionalHeaders);
}
