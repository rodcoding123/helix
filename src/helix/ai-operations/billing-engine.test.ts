import { describe, it, expect, beforeEach } from 'vitest';
import { BillingEngine } from './billing-engine.js';

describe('BillingEngine', () => {
  let billing: BillingEngine;

  beforeEach(() => {
    billing = new BillingEngine();
  });

  describe('Usage Tracking', () => {
    it('records operation cost', () => {
      billing.recordOperation('user_123', 'email_analysis', 0.005);
      const costs = billing.getMonthlyUsage('user_123');
      expect(costs.totalCost).toBe(0.005);
      expect(costs.operationCount).toBe(1);
    });

    it('aggregates costs by operation type', () => {
      billing.recordOperation('user_123', 'email_analysis', 0.005);
      billing.recordOperation('user_123', 'video_analysis', 0.05);
      billing.recordOperation('user_123', 'email_analysis', 0.005);

      const costs = billing.getMonthlyUsage('user_123');
      expect(costs.totalCost).toBe(0.06);
      expect(costs.operationCount).toBe(3);
    });
  });

  describe('Invoice Generation', () => {
    it('generates monthly invoice', () => {
      billing.recordOperation('user_456', 'email_analysis', 0.005);
      billing.recordOperation('user_456', 'email_analysis', 0.005);
      billing.recordOperation('user_456', 'video_analysis', 0.05);

      const invoice = billing.generateInvoice('user_456');
      expect(invoice.userId).toBe('user_456');
      expect(invoice.totalAmount).toBeCloseTo(0.066);
      expect(invoice.status).toBe('unpaid');
    });

    it('calculates tax (10%)', () => {
      billing.recordOperation('user_789', 'email_analysis', 0.1);

      const invoice = billing.generateInvoice('user_789');
      expect(invoice.subtotal).toBe(0.1);
      expect(invoice.tax).toBeCloseTo(0.01);
      expect(invoice.totalAmount).toBeCloseTo(0.11);
    });

    it('tracks invoice status', () => {
      billing.recordOperation('user_101', 'email_analysis', 0.05);

      const invoice = billing.generateInvoice('user_101');
      expect(invoice.status).toBe('unpaid');

      billing.markInvoiceAsPaid(invoice.invoiceId);
      const updatedInvoice = billing.getInvoice(invoice.invoiceId);
      expect(updatedInvoice?.status).toBe('paid');
    });
  });

  describe('Cost Breakdown', () => {
    it('provides cost breakdown by operation type', () => {
      billing.recordOperation('user_111', 'email_analysis', 0.01);
      billing.recordOperation('user_111', 'email_analysis', 0.02);
      billing.recordOperation('user_111', 'video_analysis', 0.05);
      billing.recordOperation('user_111', 'audio_transcription', 0.001);

      const usage = billing.getMonthlyUsage('user_111');
      expect(usage.costByOperation.email_analysis).toBe(0.03);
      expect(usage.costByOperation.video_analysis).toBe(0.05);
      expect(usage.costByOperation.audio_transcription).toBe(0.001);
    });
  });

  describe('Invoice History', () => {
    it('tracks invoice history per user', () => {
      billing.recordOperation('user_222', 'email_analysis', 0.05);
      billing.generateInvoice('user_222');

      billing.recordOperation('user_222', 'email_analysis', 0.1);
      billing.generateInvoice('user_222');

      const history = billing.getInvoiceHistory('user_222');
      expect(history).toHaveLength(2);
      expect(history[0].totalAmount).toBeCloseTo(0.055); // 0.05 + tax
      expect(history[1].totalAmount).toBeCloseTo(0.11); // 0.1 + tax
    });
  });

  describe('Reset', () => {
    it('clears all billing data', () => {
      billing.recordOperation('user_333', 'email_analysis', 0.05);
      billing.clear();

      const usage = billing.getMonthlyUsage('user_333');
      expect(usage.totalCost).toBe(0);
      expect(usage.operationCount).toBe(0);
    });
  });
});
