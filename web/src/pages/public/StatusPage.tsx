/**
 * Phase 10 Week 5: Public Status Page
 * Displays real-time system status and incident history
 */

import React, { useState, useEffect } from 'react';
import { getStatusService, SystemStatus } from '@/services/status/status-service';

export function StatusPage() {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [monthlyUptime, setMonthlyUptime] = useState<Array<{ date: string; uptime: number; incidents: number }>>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [subscribeMessage, setSubscribeMessage] = useState('');

  const statusService = getStatusService();

  useEffect(() => {
    // Load initial status
    const loadStatus = async () => {
      try {
        const currentStatus = await statusService.getStatus();
        setStatus(currentStatus);

        const monthly = await statusService.getMonthlyUptime();
        setMonthlyUptime(monthly);

        setLoading(false);
      } catch (error) {
        console.error('[StatusPage] Error loading status:', error);
        setLoading(false);
      }
    };

    loadStatus();

    // Subscribe to real-time updates
    const unsubscribe = statusService.subscribeToUpdates((updatedStatus) => {
      setStatus(updatedStatus);
    });

    return () => unsubscribe();
  }, []);

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();

    if (!email) {
      setSubscribeMessage('Please enter an email address');
      return;
    }

    // In production, send to backend to subscribe
    console.log('[StatusPage] Subscribing:', email);
    setSubscribeMessage('✓ Successfully subscribed to status updates');
    setEmail('');

    setTimeout(() => setSubscribeMessage(''), 3000);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'operational':
        return '#10b981'; // Green
      case 'degraded':
        return '#f59e0b'; // Amber
      case 'down':
      case 'major_outage':
        return '#ef4444'; // Red
      default:
        return '#6b7280'; // Gray
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'operational':
        return '✓';
      case 'degraded':
        return '⚠';
      case 'down':
      case 'major_outage':
        return '✕';
      default:
        return '?';
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
        <p>Loading status...</p>
      </div>
    );
  }

  if (!status) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
        <p>Unable to load status</p>
      </div>
    );
  }

  const statusIndicatorColor = getStatusColor(status.overall);

  return (
    <div
      style={{
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '40px 20px',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        backgroundColor: '#f9fafb',
        minHeight: '100vh',
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: '40px' }}>
        <h1 style={{ fontSize: '32px', fontWeight: 'bold', marginBottom: '8px', color: '#111827' }}>
          Helix Status
        </h1>
        <p style={{ fontSize: '16px', color: '#6b7280', marginBottom: '20px' }}>
          Real-time system status and incident reports
        </p>
        <p style={{ fontSize: '14px', color: '#9ca3af' }}>
          Last updated: {new Date(status.lastUpdated).toLocaleString()}
        </p>
      </div>

      {/* Current Status Banner */}
      <div
        style={{
          padding: '20px',
          marginBottom: '30px',
          backgroundColor: 'white',
          borderRadius: '8px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          borderLeft: `4px solid ${statusIndicatorColor}`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              fontSize: '28px',
              color: statusIndicatorColor,
            }}
          >
            {getStatusIcon(status.overall)}
          </div>
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: '#111827', margin: '0' }}>
              {status.overall === 'operational'
                ? 'All Systems Operational'
                : status.overall === 'degraded'
                  ? 'System Degradation'
                  : 'Major Outage'}
            </h2>
            <p style={{ fontSize: '14px', color: '#6b7280', margin: '4px 0 0 0' }}>
              90-day uptime: {status.uptime_90d.toFixed(2)}%
            </p>
          </div>
        </div>
      </div>

      {/* Components Grid */}
      <div style={{ marginBottom: '40px' }}>
        <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '16px', color: '#111827' }}>
          Component Status
        </h3>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
            gap: '16px',
          }}
        >
          {Object.entries(status.components).map(([key, component]) => {
            const displayName =
              {
                api_gateway: 'API Gateway',
                database: 'Database',
                webhooks: 'Webhook Service',
                background_jobs: 'Background Jobs',
                rate_limiting: 'Rate Limiting',
              }[key] || key;

            return (
              <div
                key={key}
                style={{
                  padding: '16px',
                  backgroundColor: 'white',
                  borderRadius: '8px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                  borderTop: `3px solid ${getStatusColor(component.status)}`,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h4 style={{ fontSize: '14px', fontWeight: '600', color: '#111827', margin: '0' }}>
                    {displayName}
                  </h4>
                  <span
                    style={{
                      display: 'inline-block',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      fontSize: '12px',
                      fontWeight: '600',
                      backgroundColor:
                        component.status === 'operational'
                          ? '#d1fae5'
                          : component.status === 'degraded'
                            ? '#fef3c7'
                            : '#fee2e2',
                      color:
                        component.status === 'operational'
                          ? '#065f46'
                          : component.status === 'degraded'
                            ? '#92400e'
                            : '#7f1d1d',
                    }}
                  >
                    {component.status.charAt(0).toUpperCase() + component.status.slice(1)}
                  </span>
                </div>
                {component.latency !== undefined && (
                  <p style={{ fontSize: '12px', color: '#6b7280', margin: '8px 0 0 0' }}>
                    Latency: {component.latency}ms
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Monthly Uptime Chart */}
      <div style={{ marginBottom: '40px' }}>
        <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '16px', color: '#111827' }}>
          30-Day Uptime
        </h3>
        <div
          style={{
            padding: '20px',
            backgroundColor: 'white',
            borderRadius: '8px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          }}
        >
          <div
            style={{
              display: 'flex',
              gap: '4px',
              height: '60px',
              alignItems: 'flex-end',
            }}
          >
            {monthlyUptime.map((day, index) => (
              <div
                key={index}
                style={{
                  flex: 1,
                  height: `${day.uptime}%`,
                  backgroundColor:
                    day.uptime >= 99.9
                      ? '#10b981'
                      : day.uptime >= 99
                        ? '#f59e0b'
                        : '#ef4444',
                  borderRadius: '2px',
                  position: 'relative',
                }}
                title={`${day.date}: ${day.uptime.toFixed(2)}% uptime`}
              />
            ))}
          </div>
          <p style={{ fontSize: '12px', color: '#6b7280', margin: '16px 0 0 0', textAlign: 'center' }}>
            Each bar represents one day's uptime percentage
          </p>
        </div>
      </div>

      {/* Incidents */}
      {status.incidents.length > 0 && (
        <div style={{ marginBottom: '40px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '16px', color: '#111827' }}>
            Recent Incidents
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {status.incidents.map((incident) => (
              <div
                key={incident.id}
                style={{
                  padding: '16px',
                  backgroundColor: 'white',
                  borderRadius: '8px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                  borderLeft: `4px solid ${getStatusColor(incident.severity)}`,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                  <div style={{ flex: 1 }}>
                    <h4 style={{ fontSize: '16px', fontWeight: '600', color: '#111827', margin: '0 0 8px 0' }}>
                      {incident.title}
                    </h4>
                    <p style={{ fontSize: '14px', color: '#6b7280', margin: '0 0 8px 0' }}>
                      {incident.description}
                    </p>
                    <p style={{ fontSize: '12px', color: '#9ca3af', margin: 0 }}>
                      Affected: {incident.affectedComponents.join(', ')}
                    </p>
                  </div>
                  <div style={{ textAlign: 'right', marginLeft: '16px' }}>
                    <span
                      style={{
                        display: 'inline-block',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: '600',
                        backgroundColor:
                          incident.severity === 'critical'
                            ? '#fee2e2'
                            : incident.severity === 'warning'
                              ? '#fef3c7'
                              : '#dbeafe',
                        color:
                          incident.severity === 'critical'
                            ? '#7f1d1d'
                            : incident.severity === 'warning'
                              ? '#92400e'
                              : '#1e40af',
                      }}
                    >
                      {incident.severity.toUpperCase()}
                    </span>
                  </div>
                </div>
                <p style={{ fontSize: '12px', color: '#9ca3af', margin: '12px 0 0 0' }}>
                  {incident.resolvedAt
                    ? `Resolved: ${new Date(incident.resolvedAt).toLocaleString()}`
                    : `Started: ${new Date(incident.startedAt).toLocaleString()}`}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {status.incidents.length === 0 && (
        <div
          style={{
            padding: '20px',
            backgroundColor: '#f0fdf4',
            borderRadius: '8px',
            marginBottom: '40px',
            textAlign: 'center',
          }}
        >
          <p style={{ fontSize: '14px', color: '#166534', margin: 0 }}>
            ✓ No recent incidents. All systems operating normally.
          </p>
        </div>
      )}

      {/* Subscribe Form */}
      <div
        style={{
          padding: '20px',
          backgroundColor: 'white',
          borderRadius: '8px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        }}
      >
        <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '12px', color: '#111827' }}>
          Subscribe to Updates
        </h3>
        <p style={{ fontSize: '14px', color: '#6b7280', marginBottom: '16px' }}>
          Get notified when we have significant service disruptions
        </p>
        <form onSubmit={handleSubscribe} style={{ display: 'flex', gap: '8px' }}>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com"
            style={{
              flex: 1,
              padding: '8px 12px',
              borderRadius: '4px',
              border: '1px solid #d1d5db',
              fontSize: '14px',
              fontFamily: 'inherit',
            }}
          />
          <button
            type="submit"
            style={{
              padding: '8px 16px',
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'background-color 0.2s',
            }}
            onMouseEnter={(e) => {
              (e.target as HTMLButtonElement).style.backgroundColor = '#2563eb';
            }}
            onMouseLeave={(e) => {
              (e.target as HTMLButtonElement).style.backgroundColor = '#3b82f6';
            }}
          >
            Subscribe
          </button>
        </form>
        {subscribeMessage && (
          <p style={{ fontSize: '12px', color: '#059669', marginTop: '8px', margin: '8px 0 0 0' }}>
            {subscribeMessage}
          </p>
        )}
      </div>
    </div>
  );
}
