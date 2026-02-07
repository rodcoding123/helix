/**
 * Deep Linking Support (helix:// URL scheme)
 *
 * Enables external applications and command-line tools to launch Helix
 * with pre-filled context (chat messages, settings sections, approvals, etc.)
 *
 * Phase J: Polish & Distribution
 */

export type DeepLinkTarget =
  | "chat"
  | "settings"
  | "approvals"
  | "agent"
  | "channel"
  | "talk-mode"
  | "command-palette";

export interface DeepLinkParams {
  target: DeepLinkTarget;
  message?: string;
  section?: string;
  agentId?: string;
  channelId?: string;
  requestId?: string;
  query?: string;
  [key: string]: string | undefined;
}

export class DeepLinkParser {
  /**
   * Parse helix:// URL into structured params
   */
  static parse(url: string): DeepLinkParams | null {
    try {
      const urlObj = new URL(url);

      if (urlObj.protocol !== "helix:") {
        return null;
      }

      const target = urlObj.hostname as DeepLinkTarget;
      const params: DeepLinkParams = { target };

      // Extract query parameters
      for (const [key, value] of urlObj.searchParams) {
        params[key] = value;
      }

      return params;
    } catch {
      return null;
    }
  }

  /**
   * Build helix:// URL from params
   */
  static build(params: DeepLinkParams): string {
    const { target, ...queryParams } = params;
    const url = new URL(`helix://${target}`);

    for (const [key, value] of Object.entries(queryParams)) {
      if (value) {
        url.searchParams.set(key, value);
      }
    }

    return url.toString();
  }

  /**
   * Validate deep link params
   */
  static validate(params: DeepLinkParams): { valid: boolean; error?: string } {
    if (!params.target) {
      return { valid: false, error: "Missing target" };
    }

    const validTargets: DeepLinkTarget[] = [
      "chat",
      "settings",
      "approvals",
      "agent",
      "channel",
      "talk-mode",
      "command-palette",
    ];

    if (!validTargets.includes(params.target)) {
      return { valid: false, error: `Invalid target: ${params.target}` };
    }

    // Target-specific validation
    switch (params.target) {
      case "settings":
        if (params.section && !isValidSettingsSection(params.section)) {
          return { valid: false, error: `Invalid settings section: ${params.section}` };
        }
        break;

      case "agent":
        if (!params.agentId) {
          return { valid: false, error: "agentId required for agent target" };
        }
        break;

      case "channel":
        if (!params.channelId) {
          return { valid: false, error: "channelId required for channel target" };
        }
        break;

      case "approvals":
        if (params.requestId && !isValidRequestId(params.requestId)) {
          return { valid: false, error: `Invalid requestId: ${params.requestId}` };
        }
        break;
    }

    return { valid: true };
  }
}

function isValidSettingsSection(section: string): boolean {
  const validSections = [
    "general",
    "appearance",
    "agents",
    "skills",
    "tools",
    "channels",
    "voice",
    "sessions",
    "memory",
    "devices",
    "models",
    "auth",
    "hooks",
    "advanced",
    "about",
  ];

  return validSections.includes(section);
}

function isValidRequestId(requestId: string): boolean {
  // UUID format or simple alphanumeric
  return /^[a-zA-Z0-9-]{8,}$/.test(requestId);
}

/**
 * Deep link command registry
 */
const deepLinkHandlers: Record<DeepLinkTarget, (params: DeepLinkParams) => void> = {
  chat: (params) => {
    // Navigate to chat, optionally pre-fill message
    if (params.message) {
      console.debug("[deeplink] Opening chat with message:", params.message);
      // Emit event: setPrefilledMessage(params.message)
    }
  },

  settings: (params) => {
    // Navigate to settings with specific section
    const section = params.section || "general";
    console.debug("[deeplink] Opening settings section:", section);
    // Navigate to /settings/:section
  },

  approvals: (params) => {
    // Open exec approvals dashboard, optionally focus specific request
    if (params.requestId) {
      console.debug("[deeplink] Opening approval:", params.requestId);
      // Focus specific approval request
    } else {
      console.debug("[deeplink] Opening all approvals");
    }
  },

  agent: (params) => {
    // Open agent detail view
    console.debug("[deeplink] Opening agent:", params.agentId);
    // Navigate to agent detail
  },

  channel: (params) => {
    // Open channel configuration
    console.debug("[deeplink] Opening channel:", params.channelId);
    // Navigate to channel settings
  },

  "talk-mode": (params) => {
    // Activate talk mode
    console.debug("[deeplink] Activating talk mode");
    // Emit event: activateTalkMode()
  },

  "command-palette": (params) => {
    // Open command palette with optional query
    const query = params.query || "";
    console.debug("[deeplink] Opening command palette with query:", query);
    // Show command palette, pre-fill search if query provided
  },
};

/**
 * Handle deep link navigation
 */
export function handleDeepLink(url: string): boolean {
  const params = DeepLinkParser.parse(url);

  if (!params) {
    return false;
  }

  const validation = DeepLinkParser.validate(params);
  if (!validation.valid) {
    console.warn("[deeplink] Invalid deep link:", validation.error);
    return false;
  }

  const handler = deepLinkHandlers[params.target];
  if (handler) {
    try {
      handler(params);
      return true;
    } catch (err) {
      console.error("[deeplink] Error handling deep link:", err);
      return false;
    }
  }

  return false;
}

/**
 * Example deep link URLs:
 *
 * helix://chat?message=Hello%20world
 * helix://settings?section=agents
 * helix://settings?section=auth
 * helix://approvals?requestId=req-12345
 * helix://agent?agentId=agent-abc
 * helix://channel?channelId=discord
 * helix://talk-mode
 * helix://command-palette?query=install%20skill
 */
