/**
 * ClawHub API Client
 *
 * Fetches skill metadata, versions, and availability from the ClawHub registry.
 * Supports search, filtering, pagination, and dependency resolution.
 */

export interface ClawHubSkill {
  name: string;
  description: string;
  author: string;
  authorUrl?: string;
  version: string;
  latestVersion?: string;
  rating: number;
  reviews: number;
  downloads: number;
  category: ClawHubCategory;
  tags: string[];
  icon?: string;
  repository?: string;
  license?: string;
  requirements?: {
    minHelixVersion?: string;
    bins?: string[];
    os?: string[];
  };
  created: number;
  updated: number;
  featured?: boolean;
  deprecated?: boolean;
}

export type ClawHubCategory =
  | "Development"
  | "Communication"
  | "Productivity"
  | "Automation"
  | "AI"
  | "Integration"
  | "Utility";

export interface ClawHubSearchOptions {
  query?: string;
  category?: ClawHubCategory;
  tags?: string[];
  sortBy?: "rating" | "downloads" | "recent" | "updated";
  limit?: number;
  offset?: number;
}

export interface ClawHubSearchResult {
  total: number;
  skills: ClawHubSkill[];
  hasMore: boolean;
}

export interface ClawHubStats {
  totalSkills: number;
  categories: Record<ClawHubCategory, number>;
  featured: string[];
}

class ClawHubClient {
  private baseUrl: string;
  private timeout: number = 10000;

  constructor(baseUrl?: string) {
    // Default to clawhub.com, can be overridden for local development
    this.baseUrl = baseUrl || "https://registry.clawhub.com/api/v1";
  }

  /**
   * Search skills in the ClawHub registry
   */
  async search(options: ClawHubSearchOptions = {}): Promise<ClawHubSearchResult> {
    const params = new URLSearchParams();

    if (options.query) params.append("q", options.query);
    if (options.category) params.append("category", options.category);
    if (options.tags?.length) params.append("tags", options.tags.join(","));
    if (options.sortBy) params.append("sort", options.sortBy);
    params.append("limit", String(options.limit || 20));
    params.append("offset", String(options.offset || 0));

    return this.fetch<ClawHubSearchResult>(`/skills/search?${params}`);
  }

  /**
   * Get featured skills
   */
  async getFeatured(limit: number = 12): Promise<ClawHubSkill[]> {
    const result = await this.fetch<{ skills: ClawHubSkill[] }>(
      `/skills/featured?limit=${limit}`
    );
    return result.skills;
  }

  /**
   * Get skills by category
   */
  async getByCategory(
    category: ClawHubCategory,
    limit: number = 20,
    offset: number = 0
  ): Promise<ClawHubSearchResult> {
    return this.fetch<ClawHubSearchResult>(
      `/skills/category/${encodeURIComponent(category)}?limit=${limit}&offset=${offset}`
    );
  }

  /**
   * Get specific skill details
   */
  async getSkill(name: string): Promise<ClawHubSkill> {
    return this.fetch<ClawHubSkill>(`/skills/${encodeURIComponent(name)}`);
  }

  /**
   * Get skill version history
   */
  async getVersionHistory(
    name: string,
    limit: number = 10
  ): Promise<{ versions: Array<{ version: string; date: number; notes?: string }> }> {
    return this.fetch(`/skills/${encodeURIComponent(name)}/versions?limit=${limit}`);
  }

  /**
   * Get registry statistics
   */
  async getStats(): Promise<ClawHubStats> {
    return this.fetch<ClawHubStats>("/stats");
  }

  /**
   * Check if a skill is installed locally
   */
  async checkInstalled(names: string[]): Promise<Record<string, boolean>> {
    return this.fetch<Record<string, boolean>>("/skills/installed", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ names }),
    });
  }

  /**
   * Get trending skills this week
   */
  async getTrending(limit: number = 10): Promise<ClawHubSkill[]> {
    const result = await this.fetch<{ skills: ClawHubSkill[] }>(
      `/skills/trending?limit=${limit}&period=week`
    );
    return result.skills;
  }

  /**
   * Get skills by author
   */
  async getByAuthor(author: string, limit: number = 20): Promise<ClawHubSkill[]> {
    const result = await this.fetch<{ skills: ClawHubSkill[] }>(
      `/skills/author/${encodeURIComponent(author)}?limit=${limit}`
    );
    return result.skills;
  }

  /**
   * Generic fetch wrapper with error handling and timeout
   */
  private async fetch<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          "X-Client": "helix-desktop",
          ...options.headers,
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error(`Skill not found: ${path}`);
        }
        if (response.status === 429) {
          throw new Error("Rate limited - please try again later");
        }
        throw new Error(`ClawHub API error: ${response.status} ${response.statusText}`);
      }

      return response.json() as Promise<T>;
    } catch (error) {
      if (error instanceof TypeError && error.message.includes("fetch")) {
        throw new Error("Failed to connect to ClawHub registry - check your internet connection");
      }
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error("ClawHub registry request timed out");
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

// Singleton instance
let instanceRef: ClawHubClient | null = null;

/**
 * Get or create the ClawHub client instance
 */
export function getClawHubClient(baseUrl?: string): ClawHubClient {
  if (!instanceRef) {
    instanceRef = new ClawHubClient(baseUrl);
  }
  return instanceRef;
}

/**
 * Reset the client instance (useful for testing)
 */
export function resetClawHubClient(): void {
  instanceRef = null;
}
