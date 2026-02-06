/**
 * Phase 10 Week 4: Alerting Infrastructure
 * Database schema for alert rules, alerts, and budget tracking
 */

-- Alert Rules Table
CREATE TABLE IF NOT EXISTS alert_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  metric TEXT NOT NULL CHECK (metric IN ('error_rate', 'latency_p95', 'cost_spike', 'sla_violation', 'budget_exceeded')),
  operator TEXT NOT NULL CHECK (operator IN ('>', '<', '=', '!=')),
  threshold NUMERIC,
  window TEXT NOT NULL CHECK (window IN ('5m', '15m', '1h', '24h')),
  channels TEXT[] DEFAULT ARRAY['discord'],
  severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
  enabled BOOLEAN DEFAULT true,
  cooldown_minutes INT DEFAULT 5,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_alert_rules_user ON alert_rules(user_id, enabled);
CREATE INDEX idx_alert_rules_severity ON alert_rules(severity) WHERE enabled = true;

-- Alerts Table
CREATE TABLE IF NOT EXISTS alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id UUID NOT NULL REFERENCES alert_rules(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
  message TEXT NOT NULL,
  triggered_at TIMESTAMP DEFAULT NOW(),
  resolved_at TIMESTAMP,
  acknowledged_at TIMESTAMP,
  acknowledged_by UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_alerts_user_severity ON alerts(user_id, severity);
CREATE INDEX idx_alerts_triggered ON alerts(triggered_at DESC);
CREATE INDEX idx_alerts_resolved ON alerts(user_id, resolved_at) WHERE resolved_at IS NULL;

-- Cost Budgets Table
CREATE TABLE IF NOT EXISTS cost_budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  month TEXT NOT NULL,
  monthly_budget_usd NUMERIC NOT NULL,
  spent_amount_usd NUMERIC DEFAULT 0,
  alert_threshold_percent INT DEFAULT 80,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, month)
);

CREATE INDEX idx_cost_budgets_user_month ON cost_budgets(user_id, month);

-- SLA Compliance Tracking
CREATE TABLE IF NOT EXISTS sla_compliance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  period TEXT NOT NULL,
  target_uptime_percent NUMERIC DEFAULT 99.99,
  actual_uptime_percent NUMERIC,
  violated BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_sla_compliance_user_period ON sla_compliance(user_id, period);

-- Predefined Alert Rules Function
CREATE OR REPLACE FUNCTION create_default_alert_rules(p_user_id UUID)
RETURNS void AS $$
BEGIN
  INSERT INTO alert_rules (user_id, name, description, metric, operator, threshold, window, channels, severity, enabled)
  VALUES
    (p_user_id, 'High Error Rate', 'Error rate exceeds 5%', 'error_rate', '>', 5, '5m', ARRAY['discord'], 'critical', true),
    (p_user_id, 'High Latency', 'P95 latency exceeds 2000ms', 'latency_p95', '>', 2000, '15m', ARRAY['discord'], 'warning', true),
    (p_user_id, 'Cost Spike', 'Daily cost exceeds 120% of average', 'cost_spike', '>', 120, '24h', ARRAY['discord', 'email'], 'warning', true),
    (p_user_id, 'SLA Violation', 'Uptime drops below 99.99%', 'sla_violation', '=', 1, '1h', ARRAY['discord', 'email'], 'critical', true),
    (p_user_id, 'Budget Exceeded', 'Monthly budget exceeded', 'budget_exceeded', '>', 100, '24h', ARRAY['discord', 'email', 'sms'], 'critical', true);
END;
$$ LANGUAGE plpgsql;

-- Function to update cost budget
CREATE OR REPLACE FUNCTION update_cost_budget(p_user_id UUID, p_amount NUMERIC)
RETURNS void AS $$
BEGIN
  INSERT INTO cost_budgets (user_id, month, spent_amount_usd, monthly_budget_usd)
  VALUES (p_user_id, to_char(NOW(), 'YYYY-MM'), p_amount, 10000)
  ON CONFLICT (user_id, month) DO UPDATE
  SET spent_amount_usd = cost_budgets.spent_amount_usd + p_amount,
      updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON alert_rules TO authenticated;
GRANT SELECT, INSERT, UPDATE ON alerts TO authenticated;
GRANT SELECT, INSERT, UPDATE ON cost_budgets TO authenticated;
GRANT SELECT ON sla_compliance TO authenticated;
GRANT EXECUTE ON FUNCTION create_default_alert_rules TO authenticated;
GRANT EXECUTE ON FUNCTION update_cost_budget TO authenticated;
