/**
 * Billing Engine - Phase 6
 *
 * Tracks usage-based costs and generates monthly invoices.
 */

export type InvoiceStatus = 'unpaid' | 'paid' | 'overdue';

export interface Invoice {
  invoiceId: string;
  userId: string;
  createdAt: string;
  subtotal: number;
  tax: number;
  totalAmount: number;
  status: InvoiceStatus;
}

export interface MonthlyUsage {
  userId: string;
  totalCost: number;
  operationCount: number;
  costByOperation: Record<string, number>;
}

interface UsageRecord {
  operationType: string;
  cost: number;
  timestamp: string;
}

const TAX_RATE = 0.1; // 10%

export class BillingEngine {
  private usageRecords: Map<string, UsageRecord[]> = new Map();
  private invoices: Map<string, Invoice> = new Map();
  private invoiceCounter = 0;

  /**
   * Record operation cost
   */
  recordOperation(userId: string, operationType: string, costUsd: number): void {
    if (!this.usageRecords.has(userId)) {
      this.usageRecords.set(userId, []);
    }

    this.usageRecords.get(userId)!.push({
      operationType,
      cost: costUsd,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Get monthly usage summary
   */
  getMonthlyUsage(userId: string): MonthlyUsage {
    const records = this.usageRecords.get(userId) || [];
    const totalCost = records.reduce((sum, r) => sum + r.cost, 0);
    const costByOperation: Record<string, number> = {};

    for (const record of records) {
      costByOperation[record.operationType] =
        (costByOperation[record.operationType] || 0) + record.cost;
    }

    return {
      userId,
      totalCost,
      operationCount: records.length,
      costByOperation,
    };
  }

  /**
   * Generate monthly invoice
   */
  generateInvoice(userId: string): Invoice {
    const usage = this.getMonthlyUsage(userId);
    const subtotal = usage.totalCost;
    const tax = subtotal * TAX_RATE;
    const totalAmount = subtotal + tax;

    const invoice: Invoice = {
      invoiceId: `inv_${++this.invoiceCounter}`,
      userId,
      createdAt: new Date().toISOString(),
      subtotal,
      tax,
      totalAmount,
      status: 'unpaid',
    };

    this.invoices.set(invoice.invoiceId, invoice);

    // Clear usage records after invoice generation (monthly cycle)
    this.usageRecords.set(userId, []);

    return invoice;
  }

  /**
   * Mark invoice as paid
   */
  markInvoiceAsPaid(invoiceId: string): void {
    const invoice = this.invoices.get(invoiceId);
    if (invoice) {
      invoice.status = 'paid';
    }
  }

  /**
   * Get invoice by ID
   */
  getInvoice(invoiceId: string): Invoice | null {
    return this.invoices.get(invoiceId) || null;
  }

  /**
   * Get invoice history for user
   */
  getInvoiceHistory(userId: string): Invoice[] {
    const invoices: Invoice[] = [];
    for (const invoice of this.invoices.values()) {
      if (invoice.userId === userId) {
        invoices.push(invoice);
      }
    }
    return invoices.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  /**
   * Clear all billing data
   */
  clear(): void {
    this.usageRecords.clear();
    this.invoices.clear();
    this.invoiceCounter = 0;
  }
}
