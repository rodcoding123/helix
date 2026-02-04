/**
 * BillingEngine
 *
 * Monthly invoicing system that tracks usage-based costs, applies 10% tax,
 * and manages payment status.
 *
 * Phase 6, Task 3: Multi-Tenant Support & Advanced API Management
 * Created: 2026-02-04
 */

export type InvoiceStatus = 'pending' | 'paid' | 'failed';

export interface Invoice {
  id: string;
  userId: string;
  subtotal: number;
  tax: number;
  totalAmount: number;
  status: InvoiceStatus;
  createdAt: number;
}

interface UserBillingData {
  totalCost: number;
  tax: number;
  totalAmount: number;
  costByType: Record<string, number>;
}

const TAX_RATE = 0.1; // 10%

/**
 * BillingEngine - Manages monthly invoicing for users
 *
 * Responsibilities:
 * 1. Track operation costs per user
 * 2. Calculate tax at 10% rate
 * 3. Generate invoices with totals
 * 4. Track payment status
 * 5. Clear billing cycles
 */
export class BillingEngine {
  private billings: Map<string, UserBillingData> = new Map();
  private invoices: Map<string, Invoice> = new Map();
  private invoiceIdCounter = 0;

  /**
   * Record an operation cost for a user
   * @param userId User identifier
   * @param operationType Type of operation (e.g., 'gpt-4', 'claude-3')
   * @param costUsd Cost in USD
   */
  recordOperation(userId: string, operationType: string, costUsd: number): void {
    if (costUsd < 0) {
      throw new Error(`Cost must be non-negative, got: ${costUsd}`);
    }

    const billing = this.getOrCreateBilling(userId);

    // Update total cost
    billing.totalCost += costUsd;

    // Update cost by type
    if (!billing.costByType[operationType]) {
      billing.costByType[operationType] = 0;
    }
    billing.costByType[operationType] += costUsd;

    // Recalculate tax and total
    billing.tax = billing.totalCost * TAX_RATE;
    billing.totalAmount = billing.totalCost + billing.tax;
  }

  /**
   * Get monthly usage for a user
   * @param userId User identifier
   * @returns Monthly usage details (defensive copy to prevent mutation)
   */
  getMonthlyUsage(userId: string): UserBillingData {
    const billing = this.billings.get(userId);
    if (!billing) {
      return {
        totalCost: 0,
        tax: 0,
        totalAmount: 0,
        costByType: {},
      };
    }
    // Return a copy to prevent external mutation
    return {
      totalCost: billing.totalCost,
      tax: billing.tax,
      totalAmount: billing.totalAmount,
      costByType: { ...billing.costByType },
    };
  }

  /**
   * Generate an invoice for a user
   * @param userId User identifier
   * @returns Generated invoice
   */
  generateInvoice(userId: string): Invoice {
    const billing = this.getOrCreateBilling(userId);

    // Check if invoice already exists for this user
    const existingInvoice = Array.from(this.invoices.values()).find(inv => inv.userId === userId);

    if (existingInvoice) {
      // Update existing invoice with current totals
      existingInvoice.subtotal = billing.totalCost;
      existingInvoice.tax = billing.tax;
      existingInvoice.totalAmount = billing.totalAmount;
      return existingInvoice;
    }

    const invoiceId = `invoice_${this.invoiceIdCounter++}`;

    const invoice: Invoice = {
      id: invoiceId,
      userId,
      subtotal: billing.totalCost,
      tax: billing.tax,
      totalAmount: billing.totalAmount,
      status: 'pending',
      createdAt: Date.now(),
    };

    this.invoices.set(invoiceId, invoice);
    return invoice;
  }

  /**
   * Mark an invoice as paid
   * @param invoiceId Invoice identifier
   * @throws Error if invoice is not found
   */
  markInvoiceAsPaid(invoiceId: string): void {
    const invoice = this.invoices.get(invoiceId);
    if (!invoice) {
      throw new Error(`Invoice not found: ${invoiceId}`);
    }
    invoice.status = 'paid';
  }

  /**
   * Clear all billing data
   */
  clear(): void {
    this.billings.clear();
    this.invoices.clear();
    this.invoiceIdCounter = 0;
  }

  private getOrCreateBilling(userId: string): UserBillingData {
    if (!this.billings.has(userId)) {
      this.billings.set(userId, {
        totalCost: 0,
        tax: 0,
        totalAmount: 0,
        costByType: {},
      });
    }
    return this.billings.get(userId)!;
  }
}
