export declare function isLoopbackAddress(ip: string | undefined): boolean;
export declare function parseForwardedForClientIp(forwardedFor?: string): string | undefined;
export declare function isTrustedProxyAddress(ip: string | undefined, trustedProxies?: string[]): boolean;
export declare function resolveGatewayClientIp(params: {
    remoteAddr?: string;
    forwardedFor?: string;
    realIp?: string;
    trustedProxies?: string[];
}): string | undefined;
export declare function isLocalGatewayAddress(ip: string | undefined): boolean;
/**
 * Resolves gateway bind host with SECURE fallback strategy.
 *
 * SECURITY FIX (CVE-2025-59951 pattern): Fail-closed binding
 * No automatic fallback to 0.0.0.0 when intended binding fails.
 *
 * Modes:
 * - loopback: 127.0.0.1 (REQUIRED - fails if unavailable)
 * - lan: 0.0.0.0 (EXPLICIT - user requested network exposure)
 * - tailnet: Tailnet IPv4, fallback to 127.0.0.1 (NOT 0.0.0.0)
 * - auto: 127.0.0.1, then 0.0.0.0 ONLY if explicitly enabled
 * - custom: User-specified IP (FAILS if unavailable)
 *
 * @returns The bind address to use (never null)
 * @throws Error if binding mode cannot be satisfied
 */
export declare function resolveGatewayBindHost(bind: import("../config/config.js").GatewayBindMode | undefined, customHost?: string): Promise<string>;
/**
 * Test if we can bind to a specific host address.
 * Creates a temporary server, attempts to bind, then closes it.
 *
 * @param host - The host address to test
 * @returns True if we can successfully bind to this address
 */
export declare function canBindToHost(host: string): Promise<boolean>;
export declare function resolveGatewayListenHosts(bindHost: string, opts?: {
    canBindToHost?: (host: string) => Promise<boolean>;
}): Promise<string[]>;
export declare function isLoopbackHost(host: string): boolean;
//# sourceMappingURL=net.d.ts.map