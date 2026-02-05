/**
 * Phase 10 Week 4: React Hook for Alert Engine
 * Provides easy integration of alert system in React components
 */

import { useEffect, useState, useCallback } from 'react';
import { getAlertEngine, type Alert, type AlertRule } from '@/services/alerting/alert-engine';
import { useAuth } from './useAuth';

export function useAlertEngine() {
  const { user } = useAuth();
  const engine = getAlertEngine();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user?.id) return;

    const initializeEngine = async () => {
      try {
        setLoading(true);
        await engine.initialize(user.id);
        
        const alertHistory = await engine.getAlertHistory(user.id);
        setAlerts(alertHistory);
      } catch (error) {
        console.error('[useAlertEngine] Failed to initialize:', error);
      } finally {
        setLoading(false);
      }
    };

    initializeEngine();

    return () => {
      engine.stop();
    };
  }, [user?.id, engine]);

  const addRule = useCallback(
    async (rule: Omit<AlertRule, 'id' | 'createdAt'>) => {
      try {
        const newRule = await engine.addRule(rule);
        setRules((prev) => [...prev, newRule]);
        return newRule;
      } catch (error) {
        console.error('[useAlertEngine] Failed to add rule:', error);
        throw error;
      }
    },
    [engine]
  );

  const deleteRule = useCallback(
    async (ruleId: string) => {
      try {
        await engine.deleteRule(ruleId);
        setRules((prev) => prev.filter((r) => r.id !== ruleId));
      } catch (error) {
        console.error('[useAlertEngine] Failed to delete rule:', error);
        throw error;
      }
    },
    [engine]
  );

  const getAlertHistory = useCallback(
    async (limit: number = 50) => {
      try {
        const history = await engine.getAlertHistory(user?.id || '', limit);
        setAlerts(history);
        return history;
      } catch (error) {
        console.error('[useAlertEngine] Failed to get history:', error);
        throw error;
      }
    },
    [engine, user?.id]
  );

  return {
    alerts,
    rules,
    loading,
    addRule,
    deleteRule,
    getAlertHistory,
  };
}
