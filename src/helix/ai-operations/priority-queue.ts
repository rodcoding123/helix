/**
 * Request Priority Queue - Phase 5
 *
 * Manages operation execution order based on SLA tier and criticality.
 * Implements aging mechanism to prevent starvation of low-priority items.
 */

export type SlaTier = 'premium' | 'standard';
export type Criticality = 'low' | 'medium' | 'high';

export interface QueueItem {
  operationId: string;
  userId: string;
  slaTier: SlaTier;
  criticality: Criticality;
  enqueuedAt?: number;
  ageMinutes?: number;
}

interface InternalQueueItem extends QueueItem {
  priority: number;
  enqueuedAt: number;
}

const SLA_TIER_WEIGHT = 100;
const CRITICALITY_WEIGHTS = { low: 10, medium: 20, high: 30 };
const AGE_BONUS_PER_MINUTE = 1;

export class RequestPriorityQueue {
  private items: InternalQueueItem[] = [];

  /**
   * Enqueue an item with calculated priority
   */
  enqueue(item: QueueItem): void {
    const enqueuedAt = Date.now();
    const priority = this.calculatePriority(item);

    const internalItem: InternalQueueItem = {
      ...item,
      priority,
      enqueuedAt,
    };

    // Insert in sorted order (highest priority first)
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
    if (this.items.length === 0) {
      return null;
    }

    const item = this.items.shift();
    return item || null;
  }

  /**
   * Peek at highest priority item without removing
   */
  peek(): QueueItem | null {
    if (this.items.length === 0) {
      return null;
    }

    return this.items[0];
  }

  /**
   * Get current queue size
   */
  size(): number {
    return this.items.length;
  }

  /**
   * Clear all items
   */
  clear(): void {
    this.items = [];
  }

  /**
   * Calculate priority for an item
   * Priority = (SLA Tier Weight) + (Criticality Weight) + (Age Bonus)
   */
  calculatePriority(item: QueueItem): number {
    const tierWeight = item.slaTier === 'premium' ? SLA_TIER_WEIGHT : 0;
    const criticalityWeight = CRITICALITY_WEIGHTS[item.criticality];
    const ageBonus = (item.ageMinutes || 0) * AGE_BONUS_PER_MINUTE;

    return tierWeight + criticalityWeight + ageBonus;
  }
}
