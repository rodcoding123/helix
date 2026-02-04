/**
 * Request Priority Queue - Phase 5
 *
 * Manages request execution order based on SLA tier, criticality, and age.
 * Prevents starvation of low-priority items through age-based bonus.
 */

export type SlaTier = 'premium' | 'standard';
export type Criticality = 'low' | 'medium' | 'high';

export interface QueueItem {
  operationId: string;
  userId: string;
  slaTier: SlaTier;
  criticality: Criticality;
  ageMinutes?: number;
  enqueuedAt?: number;
}

interface InternalQueueItem extends QueueItem {
  priority: number;
  enqueuedAt: number;
}

const SLA_TIER_WEIGHTS = {
  premium: 100,
  standard: 0,
};

const CRITICALITY_WEIGHTS = {
  high: 30,
  medium: 20,
  low: 10,
};

export class RequestPriorityQueue {
  private items: InternalQueueItem[] = [];

  /**
   * Enqueue item with calculated priority
   */
  enqueue(item: QueueItem): void {
    const priority = this.calculatePriority(item);
    const internalItem: InternalQueueItem = {
      ...item,
      priority,
      enqueuedAt: Date.now(),
    };

    // Insert in priority order (highest priority first)
    let inserted = false;
    for (let i = 0; i < this.items.length; i++) {
      if (priority > this.items[i].priority) {
        this.items.splice(i, 0, internalItem);
        inserted = true;
        break;
      }
    }

    if (!inserted) {
      this.items.push(internalItem);
    }
  }

  /**
   * Dequeue highest priority item
   */
  dequeue(): QueueItem | null {
    return this.items.shift() || null;
  }

  /**
   * Peek at highest priority item without removing
   */
  peek(): QueueItem | null {
    return this.items[0] || null;
  }

  /**
   * Get queue size
   */
  size(): number {
    return this.items.length;
  }

  /**
   * Calculate priority for item
   * Formula: (sla_tier * 100) + (criticality * 10) + age_bonus
   */
  calculatePriority(item: QueueItem): number {
    const slaTierWeight = SLA_TIER_WEIGHTS[item.slaTier];
    const criticalityWeight = CRITICALITY_WEIGHTS[item.criticality];
    const ageBonus = item.ageMinutes || 0;

    return slaTierWeight + criticalityWeight + ageBonus;
  }

  /**
   * Clear queue
   */
  clear(): void {
    this.items = [];
  }

  /**
   * Get all items in queue (for debugging)
   */
  getAllItems(): InternalQueueItem[] {
    return [...this.items];
  }
}
