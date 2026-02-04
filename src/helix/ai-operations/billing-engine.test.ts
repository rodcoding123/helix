import { describe, it, expect, beforeEach } from 'vitest';
import { BillingEngine } from './billing-engine.js';

describe('BillingEngine', () => {
  let billingEngine: BillingEngine;

  beforeEach(() => {
    billingEngine = new BillingEngine();
  });

  it('should record operation costs', () => {
    billingEngine.recordOperation('user1', 'gpt-4', 0.5);
    const usage = billingEngine.getMonthlyUsage('user1');
    expect(usage.totalCost).toBe(0.5);
  });

  it('should apply 10% tax to costs', () => {
    billingEngine.recordOperation('user1', 'gpt-4', 100.0);
    const usage = billingEngine.getMonthlyUsage('user1');
    expect(usage.tax).toBe(10.0); // 100 * 0.10
    expect(usage.totalAmount).toBe(110.0); // 100 + 10
  });

  it('should accumulate costs for multiple operations', () => {
    billingEngine.recordOperation('user1', 'gpt-4', 25.0);
    billingEngine.recordOperation('user1', 'claude-3', 75.0);
    const usage = billingEngine.getMonthlyUsage('user1');
    expect(usage.totalCost).toBe(100.0);
  });

  it('should track costs per operation type', () => {
    billingEngine.recordOperation('user1', 'gpt-4', 40.0);
    billingEngine.recordOperation('user1', 'claude-3', 60.0);
    const usage = billingEngine.getMonthlyUsage('user1');
    expect(usage.costByType['gpt-4']).toBe(40.0);
    expect(usage.costByType['claude-3']).toBe(60.0);
  });

  it('should generate invoices with correct totals', () => {
    billingEngine.recordOperation('user1', 'gpt-4', 100.0);
    const invoice = billingEngine.generateInvoice('user1');
    expect(invoice).toBeDefined();
    expect(invoice.subtotal).toBe(100.0);
    expect(invoice.tax).toBe(10.0);
    expect(invoice.totalAmount).toBe(110.0);
    expect(invoice.status).toBe('pending');
  });

  it('should mark invoices as paid', () => {
    billingEngine.recordOperation('user1', 'gpt-4', 100.0);
    const invoice = billingEngine.generateInvoice('user1');
    billingEngine.markInvoiceAsPaid(invoice.id);
    const updatedInvoice = billingEngine.generateInvoice('user1');
    expect(updatedInvoice.status).toBe('paid');
  });

  it('should track invoices per user', () => {
    billingEngine.recordOperation('user1', 'gpt-4', 50.0);
    billingEngine.recordOperation('user2', 'gpt-4', 75.0);
    const invoice1 = billingEngine.generateInvoice('user1');
    const invoice2 = billingEngine.generateInvoice('user2');
    expect(invoice1.totalAmount).toBe(55.0);
    expect(invoice2.totalAmount).toBe(82.5);
  });

  it('should clear all billing data', () => {
    billingEngine.recordOperation('user1', 'gpt-4', 100.0);
    billingEngine.clear();
    const usage = billingEngine.getMonthlyUsage('user1');
    expect(usage.totalCost).toBe(0);
  });
});
