/**
 * ClawHub Registry Gateway Methods
 *
 * Provides access to the ClawHub skills marketplace with:
 * - Search and filtering
 * - Featured and trending skills
 * - Category browsing
 * - Installation tracking
 */

import { loadConfig } from "../../config/config.js";
import {
  ErrorCodes,
  errorShape,
} from "../protocol/index.js";
import type { GatewayRequestHandlers } from "./types.js";

const CLAWHUB_REGISTRY = {
  skills: [
    {
      name: "github-pr",
      description: "Create and manage GitHub pull requests with auto-review support",
      author: "openclaw",
      version: "2.1.0",
      latestVersion: "2.1.0",
      rating: 4.8,
      reviews: 240,
      downloads: 12500,
      category: "Development",
      tags: ["github", "automation", "review"],
      icon: "🐙",
      repository: "https://github.com/openclaw/skill-github-pr",
      license: "MIT",
      requirements: { minHelixVersion: "1.0.0", bins: ["git", "gh"] },
      created: 1609459200000,
      updated: 1707091200000,
      featured: true,
    },
    {
      name: "linear-issues",
      description: "Create and track Linear issues directly from conversations",
      author: "openclaw",
      version: "1.3.0",
      latestVersion: "1.4.0",
      rating: 4.6,
      reviews: 164,
      downloads: 8200,
      category: "Development",
      tags: ["linear", "project-management"],
      icon: "📋",
      repository: "https://github.com/openclaw/skill-linear",
      license: "MIT",
      created: 1612137600000,
      updated: 1707091200000,
    },
    {
      name: "slack-notify",
      description: "Send notifications to Slack channels and DMs",
      author: "community",
      version: "1.1.0",
      rating: 4.4,
      reviews: 140,
      downloads: 5600,
      category: "Communication",
      tags: ["slack", "notifications"],
      icon: "💬",
      repository: "https://github.com/openclaw/skill-slack-notify",
      license: "MIT",
      created: 1614556800000,
      updated: 1707091200000,
    },
    {
      name: "docker-manage",
      description: "Manage Docker containers, images, and compose stacks",
      author: "openclaw",
      version: "1.2.0",
      rating: 4.7,
      reviews: 200,
      downloads: 9800,
      category: "DevOps",
      tags: ["docker", "containers", "devops"],
      icon: "🐳",
      repository: "https://github.com/openclaw/skill-docker",
      license: "MIT",
      requirements: { bins: ["docker", "docker-compose"] },
      created: 1617235200000,
      updated: 1707091200000,
      featured: true,
    },
  ],
};

export const clawhubHandlers: GatewayRequestHandlers = {
  "clawhub.search": ({ params, respond }) => {
    const { query, category, tags, sortBy, limit, offset } = params as any;

    let results = [...CLAWHUB_REGISTRY.skills];

    if (query) {
      const q = query.toLowerCase();
      results = results.filter(
        (s: any) =>
          s.name.toLowerCase().includes(q) ||
          s.description.toLowerCase().includes(q) ||
          s.author.toLowerCase().includes(q)
      );
    }

    if (category) {
      results = results.filter((s: any) => s.category === category);
    }

    if (tags && tags.length > 0) {
      results = results.filter((s: any) =>
        tags.some((tag: string) => s.tags.includes(tag))
      );
    }

    const sortFn = (a: any, b: any) => {
      if (sortBy === "rating") return b.rating - a.rating;
      if (sortBy === "downloads") return b.downloads - a.downloads;
      if (sortBy === "recent") return b.created - a.created;
      if (sortBy === "updated") return b.updated - a.updated;
      return 0;
    };
    results.sort(sortFn);

    const start = offset ?? 0;
    const end = start + (limit ?? 20);
    const paginated = results.slice(start, end);

    respond(true, {
      total: results.length,
      skills: paginated,
      hasMore: end < results.length,
    }, undefined);
  },

  "clawhub.featured": ({ params, respond }) => {
    const { limit } = params as any;
    const featured = CLAWHUB_REGISTRY.skills.filter((s: any) => s.featured);
    const limited = featured.slice(0, limit ?? 12);

    respond(true, { skills: limited }, undefined);
  },

  "clawhub.trending": ({ params, respond }) => {
    const { limit } = params as any;
    const trending = [...CLAWHUB_REGISTRY.skills]
      .sort((a: any, b: any) => b.downloads - a.downloads)
      .slice(0, limit ?? 10);

    respond(true, { skills: trending }, undefined);
  },

  "clawhub.category": ({ params, respond }) => {
    const { category, limit, offset } = params as any;

    if (!category) {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "category required"));
      return;
    }

    const results = CLAWHUB_REGISTRY.skills.filter(
      (s: any) => s.category === category
    );

    const start = offset ?? 0;
    const end = start + (limit ?? 20);
    const paginated = results.slice(start, end);

    respond(true, {
      total: results.length,
      skills: paginated,
      hasMore: end < results.length,
    }, undefined);
  },

  "clawhub.stats": ({ respond }) => {
    const categories: any = {};
    for (const skill of CLAWHUB_REGISTRY.skills) {
      if (!categories[skill.category]) {
        categories[skill.category] = 0;
      }
      categories[skill.category]++;
    }

    respond(true, {
      totalSkills: CLAWHUB_REGISTRY.skills.length,
      categories,
      featured: CLAWHUB_REGISTRY.skills.filter((s: any) => s.featured).map((s: any) => s.name),
      lastUpdated: new Date().toISOString(),
    }, undefined);
  },
};
