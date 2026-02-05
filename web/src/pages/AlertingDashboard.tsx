/**
 * Phase 10 Week 4: Alerting Dashboard
 * Manage alert rules and view alert history
 */

import { useState, useEffect } from 'react';
import { useAlertEngine } from '@/hooks/useAlertEngine';
import { useAuth } from '@/hooks/useAuth';
import { AlertRule, Alert, AlertCondition } from '@/services/alerting/alert-engine';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertCircle, CheckCircle, AlertTriangle, Info, Trash2 } from 'lucide-react';

interface AlertCardProps {
  alert: Alert;
}

function AlertCard({ alert }: AlertCardProps) {
  const getSeverityColor = (severity: string) => {
    const colors: Record<string, string> = {
      critical: 'border-red-500 bg-red-50 dark:bg-red-950',
      warning: 'border-yellow-500 bg-yellow-50 dark:bg-yellow-950',
      info: 'border-blue-500 bg-blue-50 dark:bg-blue-950',
    };
    return colors[severity] || colors.info;
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <AlertCircle className="w-5 h-5 text-red-600" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-yellow-600" />;
      case 'info':
        return <Info className="w-5 h-5 text-blue-600" />;
      default:
        return <Info className="w-5 h-5 text-blue-600" />;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className={`border-l-4 p-4 rounded-lg mb-3 ${getSeverityColor(alert.severity)}`}>
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3 flex-1">
          {getSeverityIcon(alert.severity)}
          <div className="flex-1">
            <p className="font-semibold text-sm">{alert.message}</p>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
              {formatDate(alert.triggeredAt)}
            </p>
            {alert.resolvedAt && (
              <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                Resolved: {formatDate(alert.resolvedAt)}
              </p>
            )}
          </div>
        </div>
        <span className={`px-2 py-1 text-xs font-medium rounded ${
          alert.severity === 'critical'
            ? 'bg-red-200 text-red-800'
            : alert.severity === 'warning'
              ? 'bg-yellow-200 text-yellow-800'
              : 'bg-blue-200 text-blue-800'
        }`}>
          {alert.severity.charAt(0).toUpperCase() + alert.severity.slice(1)}
        </span>
      </div>
    </div>
  );
}

interface RuleFormProps {
  onSubmit: (rule: Omit<AlertRule, 'id' | 'createdAt'>) => Promise<void>;
  loading?: boolean;
}

function RuleForm({ onSubmit, loading = false }: RuleFormProps) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    metric: 'error_rate' as const,
    operator: '>' as const,
    threshold: '5',
    window: '5m' as const,
    severity: 'warning' as const,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const rule: Omit<AlertRule, 'id' | 'createdAt'> = {
      name: formData.name,
      description: formData.description,
      condition: {
        metric: formData.metric,
        operator: formData.operator,
        threshold: parseFloat(formData.threshold),
        window: formData.window,
      },
      channels: ['discord', 'email'],
      severity: formData.severity,
      enabled: true,
    };

    await onSubmit(rule);

    // Reset form
    setFormData({
      name: '',
      description: '',
      metric: 'error_rate',
      operator: '>',
      threshold: '5',
      window: '5m',
      severity: 'warning',
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <label className="block text-sm font-medium">Rule Name</label>
        <Input
          type="text"
          placeholder="e.g., High Error Rate"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          required
          disabled={loading}
        />
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium">Description</label>
        <Input
          type="text"
          placeholder="Optional description of the alert"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          disabled={loading}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="block text-sm font-medium">Metric</label>
          <Select value={formData.metric} onValueChange={(value: any) => setFormData({ ...formData, metric: value })}>
            <SelectTrigger disabled={loading}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="error_rate">Error Rate (%)</SelectItem>
              <SelectItem value="latency_p95">Latency P95 (ms)</SelectItem>
              <SelectItem value="cost_spike">Cost Spike (%)</SelectItem>
              <SelectItem value="sla_violation">SLA Violation</SelectItem>
              <SelectItem value="budget_exceeded">Budget Exceeded</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium">Operator</label>
          <Select value={formData.operator} onValueChange={(value: any) => setFormData({ ...formData, operator: value })}>
            <SelectTrigger disabled={loading}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value=">">Greater than (&gt;)</SelectItem>
              <SelectItem value="<">Less than (&lt;)</SelectItem>
              <SelectItem value="=">=Equals (=)</SelectItem>
              <SelectItem value="!=">Not equals (!=)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="block text-sm font-medium">Threshold</label>
          <Input
            type="number"
            placeholder="5"
            value={formData.threshold}
            onChange={(e) => setFormData({ ...formData, threshold: e.target.value })}
            required
            disabled={loading}
            step="0.1"
          />
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium">Time Window</label>
          <Select value={formData.window} onValueChange={(value: any) => setFormData({ ...formData, window: value })}>
            <SelectTrigger disabled={loading}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="5m">5 minutes</SelectItem>
              <SelectItem value="15m">15 minutes</SelectItem>
              <SelectItem value="1h">1 hour</SelectItem>
              <SelectItem value="24h">24 hours</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium">Severity</label>
        <Select value={formData.severity} onValueChange={(value: any) => setFormData({ ...formData, severity: value })}>
          <SelectTrigger disabled={loading}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="info">Info</SelectItem>
            <SelectItem value="warning">Warning</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? 'Creating Rule...' : 'Create Alert Rule'}
      </Button>
    </form>
  );
}

export function AlertingDashboard() {
  const { user } = useAuth();
  const { alerts, rules, loading, addRule, deleteRule, getAlertHistory } = useAlertEngine();
  const [activeTab, setActiveTab] = useState<'history' | 'rules'>('history');
  const [submitLoading, setSubmitLoading] = useState(false);

  useEffect(() => {
    if (user?.id) {
      getAlertHistory(100);
    }
  }, [user?.id, getAlertHistory]);

  const handleAddRule = async (rule: Omit<AlertRule, 'id' | 'createdAt'>) => {
    try {
      setSubmitLoading(true);
      await addRule(rule);
      // Refresh alert history
      if (user?.id) {
        await getAlertHistory(100);
      }
    } catch (error) {
      console.error('Failed to create rule:', error);
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleDeleteRule = async (ruleId: string) => {
    try {
      await deleteRule(ruleId);
    } catch (error) {
      console.error('Failed to delete rule:', error);
    }
  };

  if (!user?.id) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-600">Please sign in to view alerts</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">Alert Management</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Create and manage alert rules for your operations
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={(value: any) => setActiveTab(value)} className="w-full">
        <TabsList>
          <TabsTrigger value="history">Alert History</TabsTrigger>
          <TabsTrigger value="rules">Create Rule</TabsTrigger>
        </TabsList>

        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Alerts</CardTitle>
              <CardDescription>
                {alerts.length === 0
                  ? 'No alerts triggered yet'
                  : `Showing ${alerts.length} recent alerts`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8 text-gray-500">Loading alerts...</div>
              ) : alerts.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <CheckCircle className="w-12 h-12 mx-auto mb-2 text-green-600" />
                  <p>No alerts triggered in the selected period</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {alerts.map((alert) => (
                    <AlertCard key={alert.id} alert={alert} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rules" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1">
              <Card>
                <CardHeader>
                  <CardTitle>Create New Rule</CardTitle>
                  <CardDescription>
                    Set up an alert for anomalies
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <RuleForm onSubmit={handleAddRule} loading={submitLoading} />
                </CardContent>
              </Card>
            </div>

            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle>Active Rules</CardTitle>
                  <CardDescription>
                    {rules.length === 0 ? 'No rules configured' : `${rules.length} rules active`}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="text-center py-8 text-gray-500">Loading rules...</div>
                  ) : rules.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <p>Create your first alert rule to get started</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {rules.map((rule) => (
                        <div
                          key={rule.id}
                          className="flex items-start justify-between p-4 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800"
                        >
                          <div className="flex-1">
                            <p className="font-semibold text-sm">{rule.name}</p>
                            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                              Trigger when {rule.condition.metric} {rule.condition.operator}{' '}
                              {rule.condition.threshold} over {rule.condition.window}
                            </p>
                            <div className="flex gap-2 mt-2">
                              <span className={`px-2 py-1 text-xs font-medium rounded ${
                                rule.severity === 'critical'
                                  ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                                  : rule.severity === 'warning'
                                    ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                                    : 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                              }`}>
                                {rule.severity}
                              </span>
                              <span className={`px-2 py-1 text-xs font-medium rounded ${
                                rule.enabled
                                  ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                  : 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
                              }`}>
                                {rule.enabled ? 'Enabled' : 'Disabled'}
                              </span>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteRule(rule.id)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
