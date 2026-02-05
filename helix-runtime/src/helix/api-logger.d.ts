/**
 * HELIX API LOGGER
 * Pre-flight and response logging for API calls
 *
 * CRITICAL: logApiPreFlight MUST complete BEFORE the API request is sent.
 * This ensures Discord has the log before Claude receives the prompt.
 */
import type { ApiPreFlightLog } from "./types.js";
/**
 * Log API request BEFORE it is sent
 * This function MUST complete before the API call starts
 */
export declare function logApiPreFlight(logData: ApiPreFlightLog): Promise<string>;
/**
 * Log API error
 */
export declare function logApiError(requestId: string, error: string, statusCode?: number): Promise<void>;
/**
 * Get API statistics
 */
export declare function getApiStats(): {
    requestCount: number;
    pendingCount: number;
};
//# sourceMappingURL=api-logger.d.ts.map